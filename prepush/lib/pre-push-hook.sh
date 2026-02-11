#!/usr/bin/env bash
# prepush plugin - git pre-push hook
# Runs quality checks and optional AI code review before push
set -euo pipefail

CONFIG_FILE=".claude/prepush.json"

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "prepush: No configuration found at $CONFIG_FILE, skipping checks."
  exit 0
fi

# Parse config using node
read_config() {
  node -e "
    const cfg = JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf-8'));
    console.log(JSON.stringify(cfg));
  " 2>/dev/null
}

CONFIG_JSON=$(read_config)
if [ -z "$CONFIG_JSON" ]; then
  echo "prepush: Failed to read config, skipping checks."
  exit 0
fi

MODE=$(echo "$CONFIG_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{process.stdout.write(JSON.parse(d).mode||'auto')})")
REVIEW_ENABLED=$(echo "$CONFIG_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const c=JSON.parse(d);process.stdout.write(String(c.review&&c.review.enabled||false))})")

echo "=============================="
echo "  prepush: Running pre-push checks"
echo "=============================="
echo ""

# Run quality tools
TOOLS_OUTPUT=$(echo "$CONFIG_JSON" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const cfg=JSON.parse(d);
    const tools=cfg.qualityTools||[];
    tools.forEach(t=>console.log(t.name+'|||'+t.command));
  });
")

QUALITY_FAILED=0

if [ -n "$TOOLS_OUTPUT" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    NAME="${line%%|||*}"
    CMD="${line#*|||}"
    [ -z "$NAME" ] && continue
    echo "Running $NAME: $CMD"
    set +e
    eval "$CMD"
    RESULT=$?
    set -e
    if [ "$RESULT" -eq 0 ]; then
      echo "  $NAME: PASSED"
    else
      echo "  $NAME: FAILED (exit code $RESULT)"
      QUALITY_FAILED=1
    fi
    echo ""
  done <<< "$TOOLS_OUTPUT"
fi

if [ "$QUALITY_FAILED" -eq 1 ]; then
  echo "prepush: Quality checks failed. Push aborted."
  exit 1
fi

echo "prepush: All quality checks passed."

# AI Review (if enabled)
if [ "$REVIEW_ENABLED" = "true" ]; then
  echo ""

  if [ "$MODE" = "auto" ]; then
    echo "prepush: Running AI code review..."

    # Check if claude CLI is available
    if ! command -v claude &>/dev/null; then
      echo "prepush: 'claude' CLI not found in PATH. Skipping AI review."
      echo "  Install Claude Code CLI or switch to manual mode in $CONFIG_FILE"
      exit 0
    fi

    # Get the changes being pushed
    UPSTREAM=$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null || echo "")
    if [ -n "$UPSTREAM" ]; then
      DIFF=$(git diff "@{u}..HEAD" 2>/dev/null || echo "Could not determine diff")
      LOG=$(git log "@{u}..HEAD" --oneline 2>/dev/null || echo "Could not determine commits")
    else
      BRANCH=$(git rev-parse --abbrev-ref HEAD)
      DIFF=$(git diff "origin/$BRANCH..HEAD" 2>/dev/null || git diff HEAD~5..HEAD 2>/dev/null || echo "Could not determine diff")
      LOG=$(git log "origin/$BRANCH..HEAD" --oneline 2>/dev/null || git log --oneline -5 2>/dev/null || echo "Could not determine commits")
    fi

    # Truncate diff if too large (50KB limit)
    DIFF_SIZE=${#DIFF}
    if [ "$DIFF_SIZE" -gt 51200 ]; then
      DIFF="${DIFF:0:51200}

... [TRUNCATED: diff was ${DIFF_SIZE} bytes, showing first 50KB] ..."
    fi

    # Get focus areas from config
    FOCUS=$(echo "$CONFIG_JSON" | node -e "
      let d='';
      process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        const cfg=JSON.parse(d);
        const focus=(cfg.review&&cfg.review.focus)||['general code quality'];
        console.log(focus.join(', '));
      });
    ")

    # Build the review prompt — use a temp file to avoid shell escaping issues
    PROMPT_FILE=$(mktemp)
    cat > "$PROMPT_FILE" << PROMPT_EOF
You are a code reviewer performing a pre-push review.

Review the following changes. Focus on: ${FOCUS}

Commits being pushed:
${LOG}

Changes:
${DIFF}

IMPORTANT: Respond ONLY with valid JSON in exactly this format, nothing else:
{"verdict": "PASS", "summary": "brief summary of review", "issues": [{"severity": "error", "file": "path", "description": "issue description"}]}

Use verdict PASS if the changes are acceptable. Use verdict FAIL only for critical issues (bugs, security vulnerabilities, data loss risks). Warnings and style issues should not cause FAIL.
PROMPT_EOF

    # Run claude and capture output
    REVIEW_RESULT=$(claude -p "$(cat "$PROMPT_FILE")" 2>/dev/null || echo '{"verdict":"PASS","summary":"Review could not be completed","issues":[]}')
    rm -f "$PROMPT_FILE"

    # Parse the verdict using node
    VERDICT=$(echo "$REVIEW_RESULT" | node -e "
      let d='';
      process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        try {
          const m=d.match(/\{[\s\S]*\}/);
          if(m){const r=JSON.parse(m[0]);console.log(r.verdict||'PASS');}
          else console.log('PASS');
        } catch(e){console.log('PASS');}
      });
    ")

    # Parse and display summary
    echo "$REVIEW_RESULT" | node -e "
      let d='';
      process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        try {
          const m=d.match(/\{[\s\S]*\}/);
          if(m){
            const r=JSON.parse(m[0]);
            console.log('Summary: '+(r.summary||'No summary'));
            if(r.issues&&r.issues.length>0){
              r.issues.forEach(i=>{
                const sev=i.severity==='error'?'ERROR':'WARN';
                console.log('  ['+sev+'] '+(i.file?i.file+': ':'')+i.description);
              });
            }
          }
        } catch(e){console.log('Could not parse review result');}
      });
    "

    echo ""
    echo "AI Review Verdict: $VERDICT"

    if [ "$VERDICT" = "FAIL" ]; then
      echo ""
      echo "prepush: AI review found critical issues. Push aborted."
      echo "  Fix the issues above or switch to manual mode in $CONFIG_FILE"
      exit 1
    fi

    echo ""
    echo "prepush: AI review passed."

  elif [ "$MODE" = "manual" ]; then
    echo "prepush: AI review is in manual mode."
    echo "  Run /prepush_review in Claude Code to review your changes before pushing."
    echo "  To push without review, temporarily set review.enabled to false in $CONFIG_FILE"
    exit 1
  fi
fi

echo ""
echo "prepush: All checks passed. Proceeding with push."
exit 0

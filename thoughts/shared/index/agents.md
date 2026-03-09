# Domain: Agents
> Last updated: 2026-02-27

## Key Files
- roach/agents/codebase-locator.md    — find WHERE files live (tools: Ripgrep, Glob, LS, JetBrains)
- roach/agents/codebase-analyzer.md  — analyze HOW code works (tools: Read, Ripgrep, Glob, LS, JetBrains)
- roach/agents/codebase-pattern-finder.md — find similar patterns/examples in codebase
- roach/agents/code-reviewer.md       — review code against plan and standards
- roach/agents/thoughts-locator.md    — discover relevant docs in thoughts/ directory
- roach/agents/thoughts-analyzer.md   — extract insights from specific thoughts documents
- roach/agents/web-search-researcher.md — research external documentation via web search

## How It Works
Agents are markdown files with YAML frontmatter (name, description, tools, model).
They run as Task subagents dispatched by the main agent or commands.
codebase-locator and codebase-analyzer both invoke `using-codebase-index` before any searches.

## Where to Look
- To add a new agent → create roach/agents/<name>.md
- To see index-aware agents → check for "Check the Index" section in codebase-locator.md and codebase-analyzer.md
- To dispatch agents → use Task tool with subagent_type matching agent name

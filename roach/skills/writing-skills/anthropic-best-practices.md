# Anthropic Skill-Authoring Guidance — Summary

Summary as of 2026-10-07, not a copy. The live docs win wherever they differ:
- Skill authoring best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Claude Code skills: https://code.claude.com/docs/en/skills
- Prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices

## Only add what Claude lacks

> "Claude is already very smart. Only add context Claude doesn't already have."

Claude Code's skills page adds: "every line is a recurring token cost." Claude Code best practices: "If Claude already does something correctly without the instruction, delete it or convert it to a hook." When reviewing a skill, ask: "Does the Skill avoid over-explaining?"

## Match freedom to fragility

Degrees of freedom: a "Narrow bridge with cliffs" (fragile, exact sequence matters) gets low freedom and exact instructions; an "Open field" gets high freedom and trust in Claude's judgment. Anthropic's context-engineering post puts it as finding the right altitude — between hardcoded brittle logic and vague guidance — and notes that "smarter models require less prescriptive engineering".

## Progressive disclosure

SKILL.md is the overview; detailed reference lives in separate files Claude reads only when needed. After compaction, Claude Code re-attaches only the first 5,000 tokens of each invoked skill (25,000 combined), so put load-bearing rules early.

## Evaluations first

"Build evaluations first": know the failure before writing the fix. This is the RED step in writing-skills.

## Dial back aggressive language

> "Claude Opus 4.5 and Claude Opus 4.6 are also more responsive to the system prompt than previous models. If your prompts were designed to reduce undertriggering on tools or skills, these models may now overtrigger. The fix is to dial back any aggressive language. Where you might have said "CRITICAL: You MUST use this tool when...", you can use more normal prompting like "Use this tool when..."."

Also: "Instructions like "If in doubt, use [tool]" will cause overtriggering." And from Claude Code best practices: "If you emphasize many lines, none of them stands out."

## Old skills are often too prescriptive

> "Skills developed for prior models are often too prescriptive for Claude Fable 5 and can degrade output quality. Review and consider removing older instructions if default performance is better."

Anthropic's Claude 5 context-engineering post: "Overall, we found that we were overconstraining Claude Code, both through our system prompt and in our CLAUDE.md files and skills." Its advice for skills: "Avoid making them overconstrained, except in highly important areas."

On Opus 5, explicit "double-check your work" steps backfire: it "verifies its own work without being told to", and such instructions "cause over-verification."

## Explain the why

> "Providing context or motivation behind your instructions, such as explaining to Claude why such behavior is important, can help Claude better understand your goals"

Claude "is smart enough to generalize from the explanation." The Claude Code skills page pulls the other way — "State what to do rather than narrating how or why" — so give a one-clause reason for rules that aren't obvious, and none for what Claude already knows.

## `context: fork` semantics

- "the subagent receives only the skill content as its prompt"; the main conversation sees only the skill's description and the fork's final result, never the body.
- "The subagent does not see your conversation history. The skill's instructions must stand on their own."
- AskUserQuestion is "not currently available in subagents spawned via the Agent tool", so a forked skill can't ask the user anything.

Put any invocation contract (required arguments) in the description, and keep skills that need the conversation or user input inline.

## Description length

`description` is capped at 1024 characters, and description plus `when_to_use` "is truncated at 1,536 characters in the skill listing." Put the triggering conditions first.

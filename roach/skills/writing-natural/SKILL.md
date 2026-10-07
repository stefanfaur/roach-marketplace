---
name: writing-natural
description: Use when writing any natural language — documentation, READMEs, changelogs, summaries, skill content, command content, or any prose that will be read by humans.
---

# Writing Natural Language

Write with the composition rules of Strunk's *Elements of Style*. They keep a voice while cutting the slack out of it.

## Apply While Writing

- **Make the paragraph the unit of composition** (Rule 8): one topic per paragraph, opened by a sentence that names it (Rule 9).
- **Use the active voice** (Rule 10): "The hook injects the skill", not "The skill is injected by the hook".
- **Put statements in positive form** (Rule 11): say what is, not what isn't — "trivial", not "not important".
- **Use definite, specific, concrete language** (Rule 12): name the file, the number, the command.
- **Omit needless words** (Rule 13): "because", not "due to the fact that"; cut "very", "really", "in order to".
- **Express co-ordinate ideas in similar form** (Rule 15): parallel items in a list share a grammatical shape.
- **Keep related words together** (Rule 16): don't park a clause between subject and verb.
- **Keep summaries in one tense** (Rule 17).
- **Place the emphatic words at the end** (Rule 18): end the sentence on the point.

For the full rule text, its examples, or a usage question ("which/that", "due to", "while"), look up the section in `${CLAUDE_PLUGIN_ROOT}/lib/elements-of-style.md` — grep for `### Rule <n>` or the word, and read only that section. The file is long; reading all of it costs more than it returns.

## The Other Approach

roach ships two skills for the same job. writing-simply covers the same prose this skill does, using ASD-STE100 Simplified Technical English instead of the Elements of Style. It strips voice for plainness and ships a linter that scores the result.

The two conflict sentence by sentence, so pick one per document. This skill keeps a voice and puts the emphatic word last. Use writing-simply when the text must be plain, uniform, and checkable, or when the user asks for plain language or for AI slop removed.

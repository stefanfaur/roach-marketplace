---
name: writing-simply
description: Use when writing any natural language that will be read by humans: documentation, READMEs, changelogs, summaries, PR descriptions, release notes, error messages, or skill content. Applies when plain controlled prose is wanted over prose with a voice. Also use when asked to remove AI slop, stop text from sounding like AI, write in plain language, or apply ASD-STE100 Simplified Technical English (STE).
---

# Writing Simply

Write prose in ASD-STE100 Simplified Technical English. STE is a controlled language written for aircraft maintenance manuals, where a misread sentence kills someone. It strips voice on purpose. That is why it removes AI slop: slop is voice with nothing behind it.

This applies to prose only. It does not apply to code, identifiers, or command syntax.

## The Other Approach

roach ships two skills for the same job. Both cover the full range of prose written for humans. They differ in method, not in scope.

| | writing-simply | writing-natural |
|---|---|---|
| Standard | ASD-STE100 | Elements of Style |
| Voice | removed on purpose | kept and sharpened |
| Emphasis | condition first, 20-word cap | emphatic word last |
| Check | `ste-lint.py`, a score | human judgment |

The two conflict sentence by sentence, so pick one per document and apply it throughout. Follow the user or the project when either states a preference. Choose this skill when the text must be plain, uniform, and checkable. Choose writing-natural when the text carries an argument and the rhythm matters.

## When NOT to Use

Prose that needs a voice: essays, marketing copy, conference talks, anything persuasive. STE strips voice on purpose, so it removes the thing that work depends on.

## Rules

**Words**
- One name for one thing. Do not call the same item by two names.
- Use the short common word: start (not begin/commence/initiate), use (not utilize/leverage), help (not facilitate), make sure (not ensure), before (not prior to), after (not subsequent to), about (not regarding/concerning), get (not obtain/acquire), show (not demonstrate), also (not additionally/furthermore/moreover).
- One meaning for each word. "fall" means to move down, not to decrease.
- No marketing adjectives: seamless, robust, powerful, cutting-edge, effortless, world-class, next-generation, revolutionary.
- American spelling.

**Verbs**
- Active voice. "the parser reads the file", not "the file is read by the parser".
- Use a verb for an action. "analyze the log", not "perform an analysis of the log".
- No stacked auxiliaries. Not "it is important to note that this may help to improve". Write "this improves X".
- No "-ing" main verb where a simple tense works.

**Sentences**
- One instruction per sentence. Max 20 words for an instruction, max 25 for a description.
- No contractions. Keep the articles: a, an, the, this, these.

**Punctuation**
- No semicolons. Write two sentences.
- STE does not ban the em dash. The linter still counts em dashes and reports the count outside the score. A high count marks AI prose even when every rule passes.

**Structure**
- One topic per paragraph, max six sentences.
- For steps, use a numbered vertical list. One action per item, imperative form.
- Put a condition before its command. "If the build fails, check the log", not "Check the log if the build fails".

Write only the requested text. No preamble, no summary, no closing remarks.

## Modes

- **strict.** Procedures, runbooks, safety text, error messages. Apply every rule and both length caps.
- **STE-flavored.** General prose such as READMEs, PR descriptions, and docs. Apply the sentence, paragraph, active-voice, and no-phrasal-verb discipline. Relax the dictionary lockdown so the text keeps enough range to read naturally.

Default to STE-flavored. Use strict when a misread sentence causes real damage.

## Self-Lint

Run this pass over every draft before you return it:

1. Any sentence over 20 words? Split it.
2. Any semicolon? Replace it with a period.
3. Any contraction? Expand it.
4. Any passive voice with a known actor? Make it active.
5. Any "-ing" main verb, nominalization ("perform an analysis"), or phrasal verb ("spin up")? Replace it with a plain verb.
6. Same thing named two ways? Pick one name.

**When the prose goes into a file, check it with the linter:**

```bash
uv run --no-project ${CLAUDE_PLUGIN_ROOT}/skills/writing-simply/ste-lint.py path/to/draft.md
```

The score is violations per 100 words. Lower is cleaner. The linter also reads stdin, so pipe chat prose through it when you want a number.

Lint the draft, apply the rules, then lint it again. The delta between the two scores is the signal, not the absolute value. A short text scores noisily: one violation in a 20-word notice reads as 5.00.

## What This Cannot Fix

The linter covers the mechanical subset of STE, which is where the slop lives. Full STE also needs judgment a checker cannot supply. It cannot pick the right technical noun. It cannot tell you whether a sentence makes good sense at all.

This skill fixes the FORM of slop. It cannot make a hollow paragraph true. A text that scores 0.00 and says nothing is still worthless.

## Source

Distilled from ASD-STE100 Issue 9. The standard is free at https://asd-ste100.org and is copyrighted, so do not paste it in full.

Skill and linter adapted from [woosal1337/blog, ep01-the-cure-for-ai-slop](https://github.com/woosal1337/blog/tree/main/videos/ep01-the-cure-for-ai-slop) by Ege Çelebi (MIT). The author ran a cross-model test on six writing tasks. STE cut linter violations by 74% on Claude and 50% on GPT. It beat both a banned-words list and Orwell's six rules.

---
date: 2026-03-11T14:51:15.470Z
git_branch: main
git_commit: bfd42e4
repository: roach-marketplace
cwd: /Users/stefanfaur/Desktop/work/ai-tools/roach-marketplace
title: "example.com - health check - verify page loads and extract title"
description: "Navigate to example.com, confirm the page loads, and extract the page title."
domain: example.com
---

## Steps

1. Navigate to `https://example.com`
2. Wait for network idle (full page load)
3. Verify the URL contains "example.com"
4. Extract the page title — confirmed as **"Example Domain"**
5. Extract the current URL — confirmed as `https://example.com/`

## Authentication

No authentication required.

## Gotchas

- The replay runner closes the browser after all steps complete; follow-on `get title` commands issued in a separate batch will not see the live page. Always include `get title` inside the same batch as `open`.
- The page has no interactive elements (confirmed via `snapshot -i`), so element-ref-based interactions are not applicable.

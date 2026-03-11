---
date: 2026-03-11T14:47:35.851Z
git_branch: main
git_commit: bfd42e4
repository: roach-marketplace
cwd: /Users/stefanfaur/Desktop/work/ai-tools/roach-marketplace
title: "example.com - health check: verify page loads, extract title and heading, take screenshot"
description: "Health check workflow for example.com: navigates to the page, extracts the page title and h1 heading, and saves a screenshot."
domain: example.com
---

## Steps

1. Navigate to `https://example.com` and wait for networkidle.
2. Take a snapshot (`snapshot -i`) to confirm the page rendered and see interactive elements. Expect a single "Learn more" link (ref=e1).
3. Extract `get title` → returns "Example Domain".
4. Extract `get url` → returns "https://example.com/".
5. Extract the h1 heading via `snapshot -s "h1"` → heading "Example Domain" [ref=e1] [level=1].
6. Take a screenshot and save to `thoughts/shared/browser/example-com--health-check.png`.

## Authentication

No authentication required. example.com is a public IANA domain.

## Gotchas

- The default `snapshot -i` only surfaces interactive elements (the "Learn more" link). To get the heading text, use `snapshot -s "h1"` to scope the snapshot to the h1 element.
- The page is very lightweight and loads instantly; `wait --load networkidle` completes in well under one second.
- The agent-browser socket directory `~/.agent-browser` must be writable. In sandboxed environments this path is blocked — run with sandbox disabled.

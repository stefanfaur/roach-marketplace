---
date: 2026-03-11T14:49:28.868Z
git_branch: main
git_commit: bfd42e4
repository: roach-marketplace
cwd: /Users/stefanfaur/Desktop/work/ai-tools/roach-marketplace
title: "httpbin.org - fill and submit the pizza order form"
description: "Fill all fields in the httpbin sample pizza order form and submit it. Verifies the POST response echoes back the submitted data."
domain: httpbin.org
---

## Steps

1. Navigate to `https://httpbin.org/forms/post` and wait for networkidle.
2. Snapshot the page to get element refs — the form exposes refs e1-e13 (name, tel, email, size radios, topping checkboxes, delivery time, comments, submit button).
3. Fill text fields: Customer name (e1), Telephone (e2), E-mail (e3).
4. Select pizza size by clicking the desired radio (e4=Small, e5=Medium, e6=Large).
5. Check desired toppings (e7=Bacon, e8=Extra Cheese, e9=Onion, e10=Mushroom).
6. Fill delivery time using semantic label locator: `find label "Preferred delivery time:" fill "12:00"` — must use HH:MM format (e.g. "12:00"), NOT bare digits like "1200".
7. Fill delivery instructions using semantic label locator: `find label "Delivery instructions:" fill "..."`.
8. Click the Submit order button (e13), wait for networkidle.
9. Page navigates to `https://httpbin.org/post` and shows a JSON echo of all submitted form fields.
10. Verify URL contains `httpbin.org/post` and the JSON body contains `"custname"`, `"custtel"`, `"custemail"`, `"size"`, `"topping"`, `"delivery"`, `"comments"` keys with the submitted values.

## Authentication

No authentication required.

## Gotchas

- The delivery time field is `<input type="time" step="900" min="11:00" max="21:00">`. Filling it with bare digits like "1200" causes a "Malformed value" error. Always use HH:MM format (e.g. "12:00"). Valid range is 11:00 to 21:00 in 15-minute steps.
- After filling text fields and clicking radios/checkboxes, element refs for the time and comments fields (e11, e12) may become stale. Use semantic `find label "..."` locators for those two fields to avoid "Element not found" failures.
- The result page (`/post`) has no interactive elements; use `get url` or `screenshot` to verify the submission.
- The replay file is at `thoughts/shared/browser/httpbin--form-submit.replay.json`.

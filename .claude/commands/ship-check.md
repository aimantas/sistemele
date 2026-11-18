---
description: Run all checks and report delivery state precisely
---

1. `git status` — list changed files; flag anything unrelated or secret-looking.
2. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Paste failures in full.
3. If UI changed: verify in the browser at desktop and 375px width.
4. Report: what passed, what failed, and the delivery state reached (uncommitted / committed / pushed / deployed / verified). Do not commit, push or deploy unless asked.

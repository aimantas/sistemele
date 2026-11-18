---
description: Add a dashboard template from existing widgets and metrics
argument-hint: <name> — <who it is for>
---

Create a dashboard template: $ARGUMENTS

1. List available widget types (module `client/index.tsx` files, `src/app/dashboard/core-widgets.tsx`) and metric keys (module `server/index.ts` `metrics`).
2. Append a template to `src/app/dashboard/templates.ts` with id, name, a one-sentence description and 6–10 cards. KPI cards go first in a row of four `{ w: 1, h: 1 }`.
3. Only reference existing types/keys. `npm run typecheck`.
4. Verify in the browser: Customize → Templates → apply → Save layout.

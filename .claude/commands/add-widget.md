---
description: Add a dashboard widget (and its data endpoint or metric if needed)
argument-hint: <module> <what the widget shows>
---

Add a dashboard widget: $ARGUMENTS

Follow docs/dashboard.md exactly:
1. Decide: is it one number (→ a server `metric`, no client code) or a list/chart (→ a widget component)?
2. If new data is needed, add a service + route in the module's server folder with a test.
3. Add the component to `src/modules/<module>/client/widgets.tsx` and register it with a stable `type` (`<module>.<kebab-name>`), a description and `defaultSize` in `client/index.tsx` using `React.lazy`.
4. Add it to the most relevant template in `src/app/dashboard/templates.ts` if it is generally useful.
5. `npm run check`, then verify in the browser: Customize → Add card, drag, resize, Save layout, reload, and 375px width.

# Dashboard: widgets, metrics, templates

The dashboard (`/app`) is a dnd-kit grid: 4 columns desktop, 2 tablet, 1 phone.
Card size `{ w: 1–4, h: 1–2 }`. Layouts are saved per user (`PUT /api/dashboard/layout`).

## KPI metric (no client code)

In the module's `server/index.ts`:

```ts
metrics: [{
  key: "<module>.<snake_name>",          // stable
  label: "Short label",
  description: "One sentence: what is counted and over which period.",
  format: "money" | "number" | "percent", // percent = ratio 0..1
  async compute(ctx) { return { value, hint: "context line" }; },
}]
```

It appears in Customize → Add card → Numbers and in the `core_metrics` MCP tool.

## Widget

1. `src/modules/<module>/client/widgets.tsx`: `export function XWidget({ config, size }: WidgetProps)`; data via the module's hooks; `Spinner` while loading; one-line empty state; links to the full screen; no page headings.
2. Register in `client/index.tsx`:

   ```ts
   { type: "<module>.<kebab-name>", title, description, defaultSize: { w: 2, h: 1 },
     component: lazy(() => import("./widgets").then((m) => ({ default: m.XWidget }))) }
   ```

3. Never rename `type` later — saved layouts reference it.
4. Need new data? Add a service + route (and test), not a client-side computation over all records.

## Template

Append to `src/app/dashboard/templates.ts` (`id`, `name`, `description`,
`widgets: [{ type, size, config? }]`). KPI cards: `{ type: "core.metric", size: { w: 1, h: 1 }, config: { metric: "<metric key>" } }`.
Cards for disabled modules are skipped automatically. The first template is the default layout.

## Verify

Run the app, open `/app` → Customize: the card can be added, dragged, resized,
saved and survives a reload; it renders at 375px width.

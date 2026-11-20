# Design system

The admin panel and the public site share one design system: **shadcn/ui
components on shadcn token names**, Inter, light by default (the admin panel
has a dark mode switch). Open **`/app/design`** in a running copy (or on the demo) to see every
token and component live. `DESIGN.md` records the visual rules; this page is
the how-to.

```text
src/app/styles.css         tokens (light + dark), Tailwind @theme mapping, base styles
src/worker/site/styles.css same tokens between /* tokens:start */ and /* tokens:end */, site classes
src/shared/branding.ts     Settings → Brand: primary colour, surfaces, corners → CSS overrides
src/app/ui/                the component kit (shadcn/ui, owned code)
src/lib/utils.ts           cn() = clsx + tailwind-merge
components.json            shadcn CLI config (aliases point at src/app/ui)
src/app/pages/DesignSystemPage.tsx   the /app/design reference page
tests/tokens.test.ts       keeps the site token copy equal to the panel tokens
```

## Tokens

Use the token, never a raw colour or a Tailwind palette colour (`bg-zinc-100`,
`text-[#333]`). Every token has a Tailwind name: `--card` → `bg-card`,
`--muted-foreground` → `text-muted-foreground`, `--border` → `border-border`.

| Token | Use |
| --- | --- |
| `background` / `foreground` | Page ground and body text |
| `card` / `card-foreground` | Cards, tables, inputs |
| `popover` | Menus, command palette, dialogs |
| `primary` / `primary-foreground` | The one primary action, links, focus, active nav icon. Comes from Settings → Brand |
| `secondary`, `muted`, `accent` | Quiet fills: secondary buttons, table header, hover and selected rows |
| `muted-foreground` | Secondary text, labels, meta |
| `border`, `input` | Dividers and card edges; control borders |
| `ring` | Focus ring (primary at 55%) |
| `destructive` | Delete, void, overdue, errors |
| `success`, `warning`, `info` | Status: paid/won, due soon/sent, neutral notices. Use as text or `bg-x/10` fills |
| `sidebar-*` | Admin sidebar |
| `chart-1…5` | Charts, `chart-1` is the brand |

Tints are opacity steps of a token: `bg-primary/10`, `bg-destructive/10`,
`text-foreground/80`. Radius is one variable (`--radius`, 10px by default)
with `rounded-sm/md/lg/xl` derived from it; controls use `rounded-md`, cards
`rounded-xl`. Shadows: `shadow-xs` on controls and cards, `shadow-sm` on raised
cards, `shadow-lg` on dialogs and menus only.

### Light by default, dark on request

Everything is light by default; the system's dark setting is ignored. The
admin panel has a dark mode switch (the moon in the sidebar footer and on
`/app/design`): it puts `.dark` on `<html>` and remembers the choice in that
browser (`src/app/lib/theme.ts`). The public site is always light.

- Light tokens live in `:root`, dark ones in `.dark` (`src/app/styles.css`, the
  shadcn convention). `dark:` utilities follow the class.
- Dark mode keeps its own neutral surfaces and uses the brand at the same hue
  and saturation, lightened to 5:1 contrast.
- When you add a token, add it to both blocks in `src/app/styles.css` and, if
  the public site uses it, to the marked block in `src/worker/site/styles.css`.
  `npm test` fails when the copies differ or when anything switches on
  `prefers-color-scheme` again.

### Logo

The default mark is `public/favicon.svg`: a wheel of six modules around a hub
on a brand-colour tile, one module tinted (the one you add). Rules and
examples are on `/app/design#brand`.

- **Square logo = mark.** Settings → Brand accepts any SVG. A square one is
  treated as a mark: the site header, the admin panel, the sign-in page and
  quotes and invoices set the business name beside it in Inter
  (`logoIsMark()` in `src/shared/branding.ts`, `BrandLockup` in the panel and
  the site layout).
- **Wide logo = full logo.** It already carries the name and shows alone.
- Don't bake the name into a square SVG as text: SVG text in an `<img>` cannot
  use the site's font.

### Brand settings

Settings → Brand changes `--primary` (light and dark), the light surfaces
(`cool`, `warm`, `white`) and `--radius` (`sharp`, `soft`, `round`) at runtime
through `themeCss()` in `src/shared/branding.ts`. Add presets there
(`BRAND_PRESETS`, `SURFACES`, `CORNERS`), not in components.

## Components

Import everything from `@/app/ui`:

| Need | Component |
| --- | --- |
| Actions | `Button` (`variant`: default, outline, secondary, ghost, destructive, link; `size`: sm, default, lg, icon, icon-sm; `loading`, `icon`, `asChild`), `ButtonLink`, `IconButton` (needs a `label`) |
| Forms | `Field` (label, hint, error; render prop gives the input id), `Input`, `Textarea`, `Select` (native), `CheckboxField`, `MoneyInput`, `FormError` |
| Layout | `PageHeader` (title, description, actions), `Card` + `CardHeader` (title, description, actions) + `CardContent` + `CardFooter`, `DetailList` |
| Data | `Table` + `TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (or the short `Th`, `Td`, `Tr`), `Badge` (`tone`: neutral, brand, success, warning, danger, info, outline) |
| Overlays | `Dialog` (open, onClose, title, description, footer, size), `ConfirmDialog`; Radix primitives `DialogRoot`, `DialogContent` … for custom cases |
| Feedback | `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `Alert`, `useToast` |

The kit is owned code: shadcn/ui copies components into the repository. To
add one:

```bash
npx shadcn@latest add tooltip
```

It lands in `src/app/ui/` (see `components.json`). Then:

1. Check it only uses token classes (the shadcn defaults do).
2. Export it from `src/app/ui/index.ts`.
3. Show it on `/app/design` (`src/app/pages/DesignSystemPage.tsx`) with a real example from the product, not lorem ipsum.

Prefer composing existing pieces over a new component. A module-specific piece
(a pipeline card, a line-items editor) stays in that module's `client/` folder
and is built from the kit.

## Public site

The public site is server-rendered HTML with inline CSS and no client
JavaScript, so it cannot use the React kit. It uses the same tokens and mirrors
the kit in plain classes: `.button` / `.button.primary`, `.card`, `.badge`,
`.form` inputs, `.notice`, `.code` and `.terminal`, `.window`. The starter home
adds `.lp-*` classes (hero, logo strip, steps, feature rows, module index).
Keep new site classes in `src/worker/site/styles.css` and reuse the tokens.

## Rules

1. **Use the kit.** No one-off buttons, inputs or cards.
2. **Tokens only.** No hex, no Tailwind palette colours, no inline colour styles. The brand comes from Settings.
3. **One primary action per screen**, top right in the page header. Everything else is outline, secondary or ghost.
4. **Lines before shadows.** Borders structure the page; shadows lift cards slightly and float dialogs and menus.
5. **Numbers are tabular** (`tabular` class) and right-aligned in tables.
6. **Status is a badge** with a tone; the same tone means the same thing in every module.
7. **Every state:** loading, empty (says what to do next), error (with retry), success (toast), at phone and desktop width.
8. **Accessible by default:** visible focus ring, 4.5:1 text contrast, labelled icon buttons, dialogs trap focus and close on Escape (Radix), drag and drop also works with the keyboard.
9. **Sentence case** for labels, headings and buttons; buttons are named after the result ("Create invoice", not "Submit").

## Checklist for a new screen

- [ ] Built from `@/app/ui`, no raw colours (`npm test` checks for the retired palette names)
- [ ] Page header with one primary action
- [ ] Loading, empty, error states
- [ ] Checked at 375 px and desktop (and in the panel's dark mode if it is an admin screen)
- [ ] New component shown on `/app/design`

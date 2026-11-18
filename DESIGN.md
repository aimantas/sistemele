---
name: Sistemėlė
description: Calm, structured operations UI for small businesses. Warm paper, ink text, one green accent for decisive actions.
colors:
  paper: "#f6f5f1"
  surface: "#ffffff"
  sunken: "#efeee9"
  ink: "#16191d"
  ink-soft: "#424a54"
  muted: "#646d77"
  line: "#e2e1dc"
  line-strong: "#c4c3bc"
  brand: "#1f5f4a"
  brand-hover: "#184c3b"
  brand-soft: "#e5efe9"
  danger: "#b42318"
  warning: "#a15c07"
  success: "#1d7348"
  info: "#2556a8"
typography:
  family: "system-ui stack (no web font download)"
  body: "15px / 1.5"
  page-title: "24px / 600"
  card-title: "14–16px / 600"
  label: "12px uppercase / 600 / 0.04em tracking"
  numbers: "tabular-nums everywhere money or quantities appear"
rounded:
  control: "8px"
  panel: "12px"
  pill: "999px"
spacing: "4px grid; cards 16–20px padding; page gutter 16px phone, 32px desktop"
---

# Design

The dashboard is a work tool used every day. It should feel calm, dense enough
to scan, and obvious about the next action.

## Rules

1. **One primary action per screen**, in brand green, top right of the page header. Everything else is secondary or ghost.
2. **Structure with lines, not shadows.** 1px `line` borders, white `surface` cards on `paper`. Shadows only on floating layers (dialogs, menus, drag overlay).
3. **Numbers are tabular** (`tabular` class) and right-aligned in tables.
4. **Status is a badge** with a tone: neutral (draft), info, warning (sent/due soon), success (paid/won/accepted), danger (overdue/declined/void).
5. **Every list has loading, empty and error states** (`Spinner`, `EmptyState`, `ErrorState`). Empty states say what to do next.
6. **Forms**: labels above fields, server messages under the field (`Field` + `fieldError`), a single submit button named after the result ("Create invoice", not "Submit").
7. **Destructive actions confirm** with `ConfirmDialog` and say what happens and what stays.
8. **Mobile**: hide secondary table columns below `md`, keep the primary identifier, amount and status. No horizontal page scroll; wide tables scroll inside their card.
9. **Accessibility**: visible focus ring (3px brand at 40%), 4.5:1 contrast for text, icons have labels, dialogs use native `<dialog>`, drag and drop also works with the keyboard (dnd-kit keyboard sensor).
10. **Copy**: short sentences, concrete nouns, no "Oops", no exclamation marks, no marketing words inside the app.

## Changing the brand

**Without code — Settings → Brand** (owners and admins):

- **Logo**: choose an `.svg` file or paste SVG markup. It is read in the browser and stored as text in D1 (no file uploads, no R2). The server strips scripts, event handlers, `foreignObject` and external references, then serves it at `/brand/logo.svg` with a sandboxing CSP. It is only ever displayed through `<img>`. Shown in the dashboard sidebar, sign-in page, public site header and on quotes and invoices (screen, customer link and print).
- **Brand colour**: six presets or any hex colour. Hover, soft tint and text-on-brand colours are derived (`src/shared/branding.ts`); the page warns when the colour is too light for text (WCAG 4.5:1).
- **Background**: warm paper, cool grey or plain white.
- **Corners**: sharp, soft or round.

The dashboard loads `/brand/theme` (CSS variables that override the `@theme`
tokens); public pages inline the same variables. Changes apply on save.

**In code**: the defaults are the tokens in `src/app/styles.css` (`@theme`) and
the variables at the top of `src/worker/site/styles.css`. Add presets in
`BRAND_PRESETS`, surfaces in `SURFACES`, corner styles in `CORNERS`. Replace
`public/favicon.svg` for the browser tab icon. Component code never hard-codes colours.

## Public site

Server-rendered, no client JavaScript, inline CSS. Same palette. Content lives
in `src/worker/site/content.ts`; business details come from Settings.

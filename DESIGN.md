---
name: Sistemėlė
description: The category-standard admin panel and landing for AI-native projects. Cool neutral ground, Inter, one brand green, shadcn/ui tokens, light by default.
colors:
  background: "oklch(0.985 0.002 264)"
  foreground: "oklch(0.205 0.006 264)"
  card: "oklch(1 0 0)"
  muted: "oklch(0.962 0.003 264)"
  muted-foreground: "oklch(0.51 0.012 264)"
  accent: "oklch(0.955 0.004 264)"
  border: "oklch(0.915 0.004 264)"
  input: "oklch(0.88 0.006 264)"
  primary: "#1f5f4a"
  primary-foreground: "oklch(0.99 0 0)"
  destructive: "oklch(0.545 0.2 27)"
  success: "oklch(0.5 0.12 155)"
  warning: "oklch(0.55 0.13 62)"
  info: "oklch(0.5 0.15 258)"
  sidebar: "oklch(0.975 0.003 264)"
  dark-background: "oklch(0.155 0.004 264)"
  dark-card: "oklch(0.19 0.005 264)"
  dark-foreground: "oklch(0.97 0.002 264)"
  dark-muted-foreground: "oklch(0.71 0.012 264)"
  dark-primary: "#319574"
  dark-primary-foreground: "oklch(0.16 0.01 165)"
typography:
  display:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5.2vw + 0.75rem, 4.5rem)"
    fontWeight: 680
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 1.8vw + 1rem, 2.25rem)"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  page-title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"cv11\", \"ss01\""
  body-site:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "13px"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "999px"
spacing:
  control-height: "36px"
  card-padding: "20px"
  page-gutter-phone: "16px"
  page-gutter-desktop: "40px"
  site-wrap: "1180px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "20px"
  badge:
    rounded: "{rounded.md}"
    padding: "2px 8px"
    typography: "{typography.label}"
  nav-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "32px"
---

# Design System: Sistemėlė

## Overview

**Creative North Star: "The Well-Made Tool"**

Sistemėlė looks like the tools its audience already trusts: Linear's density
and restraint, Resend's quiet confidence. It is deliberately category-standard.
A developer opening the demo should feel at home in a second, and an agent
adding a screen should have nothing to invent. Character comes from precision,
not decoration: exact spacing, tabular numbers, crisp 1px lines, a single
brand colour used sparingly, and real product screenshots instead of
illustrations.

The admin panel is an Operate surface: dense enough to scan, calm, obvious
about the next action. The public starter home is a Persuade surface built
from the same tokens: a large tight headline, the product itself as the hero
image, ruled rows instead of feature-card grids. Both are light by default;
only the admin panel offers dark, by an explicit switch.

**Key Characteristics:**

- shadcn/ui token names and components, owned in `src/app/ui`.
- Cool neutral ground (hue 264, near-zero chroma), white cards, one brand green.
- Inter Variable, self-hosted; one family, weight and size carry hierarchy.
- Lines structure; shadows only lift slightly or float.
- Light by default; the admin panel has a dark mode switch (`.dark` class). The public site is always light.
- The mark: a wheel of six modules around a hub on a brand tile, one module tinted. The name is set beside it in Inter, never drawn into the logo.
- Brand colour, surfaces and corners are runtime settings, never hard-coded.

## Colors

A near-monochrome cool-grey system with one brand accent and four status hues.

### Primary

- **Forest Green** (`#1f5f4a`; dark `#319574`): the one primary action per screen, links, focus ring (at 55%), the active nav icon, the brand logo tile. Settings → Brand replaces it; dark mode keeps its hue and saturation and lightens it until it reaches 5:1 on the dark ground, so the primary still reads as active.

### Neutral

- **Cool Paper** (`oklch(0.985 0.002 264)`): page ground. Settings → Brand can switch it to warm or white.
- **Card White** (`oklch(1 0 0)`; dark `oklch(0.19 0.005 264)`): cards, tables, inputs, popovers.
- **Graphite** (`oklch(0.205 0.006 264)`): body text and strong icons.
- **Slate Meta** (`oklch(0.51 0.012 264)`; dark `oklch(0.71 …)`): secondary text, labels, table headers.
- **Mist** (`oklch(0.962 0.003 264)`): quiet fills, table header, secondary buttons.
- **Hairline** (`oklch(0.915 0.004 264)`; dark `oklch(1 0 0 / 9%)`): every divider and card edge.
- **Control Edge** (`oklch(0.88 0.006 264)`): input and outline-button borders.

### Status

- **Success** (`oklch(0.5 0.12 155)`): paid, won, accepted, in stock.
- **Warning** (`oklch(0.55 0.13 62)`): sent, due soon, low stock.
- **Destructive** (`oklch(0.545 0.2 27)`): overdue, void, delete, errors.
- **Info** (`oklch(0.5 0.15 258)`): new, neutral notices.

Status colours appear as text or as `/10` tints behind text (badges, alerts),
never as large fills.

### Named Rules

**The One Voice Rule.** Primary green marks one action per screen plus links
and focus. If two things on a screen are green buttons, one of them is wrong.

**The Token Rule.** Components use token classes (`bg-card`,
`text-muted-foreground`), never hex values or Tailwind palette colours.
`tests/tokens.test.ts` enforces the shared token copy and the retired names.

## Typography

**Font:** Inter Variable (self-hosted, latin + latin-ext, OFL) with the system
UI stack as fallback. Features `cv11` and `ss01` on.
**Mono:** the platform monospace stack, only for code, commands and paths.

**Character:** one neutral grotesque, tightened at large sizes. Hierarchy comes
from size and weight steps (400 / 500 / 600 / 650), never from a second family.

### Hierarchy

- **Display** (680, clamp up to 4.5rem, 1.04, -0.04em): the landing headline only.
- **Headline** (650, clamp up to 2.25rem, 1.12, -0.03em): landing section titles, public page titles.
- **Page title** (600, 24px, -0.015em): admin page headers.
- **Title** (600, 14px): card titles, table identifiers.
- **Body** (400, 14px / 1.5 in the panel; 16px / 1.6 on the site, max ~62ch).
- **Label** (500, 12px, sentence case): field labels, meta, badges, table heads.

### Named Rules

**The Tabular Rule.** Money and quantities use `tabular-nums` and align right
in tables.

**The Sentence Case Rule.** Labels, headings, buttons and nav groups are
sentence case. No uppercase tracking labels, no eyebrows above headings.
Printed documents (quotes, invoices) keep their small uppercase column heads.

## Layout

The admin panel is a 240px sidebar plus a content column (16px gutters on
phones, 40px on desktop); below `lg` the sidebar becomes a top bar with a
sheet. Cards stack in grids that drop to one column on phones; secondary table
columns hide below `md` and wide tables scroll inside their card, never the
page. The dashboard is a 4 / 2 / 1 column card grid.

The public site centres a 1180px wrap with 16px minimum gutters. Sections are
separated by a 1px hairline and generous vertical padding (56–96px). The
landing alternates full-width product screenshots in browser frames with
two-column text/visual rows; lists are ruled rows (module index, blog posts),
not card grids.

## Elevation & Depth

Flat by default with three shadow steps tinted by `--shadow-color`.

### Shadow Vocabulary

- **xs** (`0 1px 2px 0 hsl(var(--shadow-color) / 0.05)`): controls and resting cards.
- **sm** (`0 1px 2px 0 … / 0.06, 0 1px 3px 0 … / 0.08`): raised cards, hover.
- **lg** (`0 4px 6px -2px … / 0.06, 0 16px 32px -8px … / 0.16`): dialogs, menus, command palette, landing screenshots.

### Named Rules

**The Lines Before Shadows Rule.** Borders structure the page. A shadow lifts a
card a pixel or floats an overlay; it never separates sections.

## Shapes

One radius variable (`--radius`, 10px soft by default; 4px sharp, 16px round
via Settings → Brand). Controls and badges use `md` (radius − 2px), cards and
browser frames `xl` (radius + 4px), pills and step numbers `full`. Every
edge is a 1px hairline.

## Components

- **Buttons** (`Button`): default (primary fill), outline (card fill, control edge, xs shadow), secondary (mist fill), ghost, destructive, link. Sizes sm 32px, default 36px, lg 40px, icon. `loading` swaps the icon for a spinner and disables the button. Icon-only buttons are `IconButton` with a label.
- **Inputs** (`Input`, `Textarea`, `Select`): card fill, control edge, 36px, focus shows a 3px ring at the brand colour. Labels above, hints and server messages below.
- **Cards** (`Card`): card fill, hairline edge, xl radius, xs shadow; `CardHeader` is a ruled row with title, description and actions.
- **Tables**: inside a card; header row on mist with 12px muted labels; 1px row rules; hover tints rows with muted at 50%.
- **Badges**: md radius, 12px 500, tone tints (`bg-success/10 text-success`); `outline` for archived.
- **Dialogs** (Radix): popover fill, lg shadow, black/50 overlay, focus trap, Escape closes, footer actions right-aligned.
- **Sidebar nav**: 32px items, muted text, active item on `sidebar-accent` with the icon in primary.
- **Brand lockup** (`BrandLockup`): a square logo is a mark, 28–30px, with the business name beside it in Inter 650 at a gap of a third of the mark; a wide logo shows alone. Clear space is a quarter of the mark; smallest sizes are 16px (favicon) and 24px (interface).
- **Edit this page** (public site, demo and local development only): a dashed brand-tinted card at the end of the page naming the admin screen and the repository files behind it.
- **Empty states**: dashed hairline box, icon in a mist tile, one sentence on what to do, one action.

## Do's and Don'ts

**Do**

- Build screens from `@/app/ui`; add missing pieces with `npx shadcn@latest add` and show them on `/app/design`.
- Show the product: real light-mode screenshots over illustrations.
- Keep one primary action per screen, top right.
- Check every screen at 375px and desktop; admin screens also in dark mode.

**Don't**

- Don't recolour, rotate, stretch or add effects to the mark, or drop its tile; don't draw the business name into it as SVG text.
- Don't switch the public site to dark or bring back `prefers-color-scheme`; dark is the admin panel's opt-in.
- Don't hard-code colours, fonts or radii; Settings → Brand must keep working.
- Don't use eyebrows/kickers, gradient text, glow halos, hard offset shadows or emoji icons.
- Don't build same-size icon-card grids for features; use ruled rows or a product shot.
- Don't add a second typeface or a monospace "developer" costume for prose.

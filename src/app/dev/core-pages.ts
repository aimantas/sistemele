import type { DevPage } from "@/modules/types.client";

/** Developer panel notes for the core admin pages (paths under /app). Module pages live in each module's client/index.tsx. */
export const coreDevPages: DevPage[] = [
  {
    path: "",
    title: "Dashboard",
    summary: "A grid of KPI cards and module widgets that each person arranges and saves for themselves.",
    files: [
      { path: "src/app/dashboard/DashboardPage.tsx", note: "Grid, Customize mode, add/resize/remove cards" },
      { path: "src/app/dashboard/core-widgets.tsx", note: "KPI, Getting started, Quick actions, Note" },
      { path: "src/app/dashboard/templates.ts", note: "Starting layouts" },
      { path: "src/app/dashboard/registry.ts", note: "Widget registry: core and module widgets" },
      { path: "docs/dashboard.md", note: "Recipes and prompts for widgets and metrics" },
    ],
    tools: ["core_metrics"],
    prompts: [
      "Add a dashboard widget that shows revenue per month for the last 12 months as a bar chart, from issued invoices, with loading and empty states.",
      "Add a KPI metric “Average deal value” (money) to the CRM module so it appears in Customize → Add card.",
      "Add a dashboard template for a sales lead with leads, pipeline, open tasks and quotes awaiting an answer.",
      "Make the Getting started card disappear for good once every step is done.",
    ],
  },
  {
    path: "settings",
    title: "Settings: business",
    summary: "Company details, bank account, VAT rate, numbering and payment terms used on quotes and invoices.",
    files: [
      { path: "src/app/pages/SettingsPages.tsx", note: "Business form and the settings layout" },
      { path: "src/shared/business.ts", note: "Business profile schema and defaults" },
      { path: "src/worker/core/routes.ts", note: "GET/PUT /api/settings/business" },
    ],
    tools: ["core_business_profile"],
    prompts: [
      "Add a second bank account to the business settings and let each invoice choose which one to show.",
      "Add a default quote validity (days) to business settings and use it when a new quote is created.",
    ],
  },
  {
    path: "settings/brand",
    title: "Settings: brand",
    summary: "Logo (SVG), brand colour, page background and corners; applied to the admin panel, public site and documents.",
    files: [
      { path: "src/app/pages/BrandSettingsPage.tsx", note: "The brand form and live preview" },
      { path: "src/shared/branding.ts", note: "Presets, contrast maths, themeCss(), logoIsMark()" },
      { path: "src/worker/site/brand.ts", note: "/brand/logo.svg, /brand/theme, /brand/info.json" },
      { path: "docs/design-system.md", note: "Tokens, logo rules, light and dark" },
    ],
    prompts: [
      "Add a “Font” brand setting with three self-hosted choices (Inter, Geist, IBM Plex Sans) applied through a CSS variable.",
      "Let owners upload a separate square logo mark for the favicon and keep the wide logo for headers.",
    ],
  },
  {
    path: "settings/team",
    title: "Settings: team",
    summary: "People who can sign in, their roles (owner, admin, member) and invitations.",
    files: [
      { path: "src/app/pages/SettingsPages.tsx", note: "Team list and invite form" },
      { path: "src/worker/core/routes.ts", note: "Team and invitation endpoints" },
      { path: "src/shared/auth.ts", note: "Roles and roleAtLeast()" },
      { path: "docs/security.md", note: "Sign-in, roles and sessions" },
    ],
    tools: ["core_list_team"],
    prompts: [
      "Add a “viewer” role that can read everything but change nothing, enforced on the server and in the MCP tools.",
      "Show each person's last sign-in time on the team list.",
    ],
  },
  {
    path: "settings/api",
    title: "Settings: API tokens",
    summary: "Tokens for AI agents and scripts, each limited to a role; used with the MCP endpoint and the JSON API.",
    files: [
      { path: "src/app/pages/SettingsPages.tsx", note: "Token list and create dialog" },
      { path: "src/worker/auth/", note: "Token hashing and lookup" },
      { path: "src/worker/mcp/", note: "The /mcp endpoint and core tools" },
      { path: "docs/ai-agents.md", note: "Connecting agents over MCP" },
    ],
    prompts: [
      "Add an optional expiry date to API tokens and reject expired tokens on the server.",
      "Show when each API token was last used and from which tool.",
    ],
  },
  {
    path: "settings/email",
    title: "Settings: email",
    summary: "Resend status and the log of every email the system sent.",
    files: [
      { path: "src/app/pages/SettingsPages.tsx", note: "Email status and log" },
      { path: "src/worker/email/", note: "renderEmail layout and sendEmail (Resend)" },
      { path: "docs/email.md", note: "Setup and templates" },
    ],
    prompts: [
      "Add a “Send a test email” button that sends the layout to the signed-in person.",
      "Let owners edit the footer text used in every email.",
    ],
  },
  {
    path: "settings/audit",
    title: "Settings: audit log",
    summary: "Who changed what and when, for every write in every module.",
    files: [
      { path: "src/app/pages/SettingsPages.tsx", note: "Audit list and filters" },
      { path: "src/worker/context.ts", note: "ctx.audit()" },
    ],
    prompts: ["Add filters by person and by date range to the audit log, and a CSV export for owners."],
  },
  {
    path: "settings/modules",
    title: "Settings: modules",
    summary: "Which modules are enabled in this copy and what each one adds.",
    files: [
      { path: "sistemele.config.ts", note: "Enabled modules" },
      { path: "src/modules/server.ts", note: "Server module registry" },
      { path: "src/modules/client.ts", note: "Client module registry" },
      { path: "docs/modules.md", note: "The module contract" },
    ],
    prompts: [
      "Create a new “bookings” module with npm run module:new: a bookings table, list and calendar pages, MCP tools, a widget and tests, following the CRM module's shape.",
      "Create a “suppliers” module linked to catalog products, with purchase orders that add stock when received.",
    ],
  },
];

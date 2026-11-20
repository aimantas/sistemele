import type { DevPage } from "@/modules/types.client";

/** Developer panel notes and agent prompts for the CRM pages (dev mode). */
export const crmDev: DevPage[] = [
  {
    path: "crm/leads",
    title: "Leads",
    summary: "The leads inbox: website messages and manual leads, worked from new to qualified, then converted.",
    files: [
      { path: "src/modules/crm/client/LeadsPage.tsx", note: "Status tabs, filters, the table" },
      { path: "src/modules/crm/client/LeadForm.tsx", note: "New and edit lead form" },
      { path: "src/modules/crm/server/leads.ts", note: "Lead services: list, create, update, convert" },
      { path: "src/modules/crm/shared/schema.ts", note: "Zod schemas and statuses" },
      { path: "migrations/0007_crm_leads_stages.sql", note: "The leads table" },
      { path: "tests/crm.test.ts", note: "Lead tests" },
    ],
    tools: ["crm_list_leads", "crm_create_lead", "crm_update_lead", "crm_convert_lead"],
    prompts: [
      "Add a “budget” field to leads: migration, Zod schema, the lead form, a column in the leads table, the crm_create_lead and crm_update_lead tool inputs, and tests.",
      "Add a CSV export of the leads list that respects the current filters and is limited to owners and admins.",
      "Email the lead owner when a new website lead is assigned to them, using renderEmail and ctx.waitUntil.",
      "Show how many days each open lead has been waiting and sort the Open tab by it.",
    ],
  },
  {
    path: "crm/leads/:id",
    title: "Lead",
    summary: "One lead: details, timeline of calls, emails, meetings and tasks, status, owner, follow-up and conversion.",
    files: [
      { path: "src/modules/crm/client/LeadDetailPage.tsx", note: "Details, timeline, Work this lead panel" },
      { path: "src/modules/crm/client/parts.tsx", note: "Shared CRM pieces (timeline, badges)" },
      { path: "src/modules/crm/server/leads.ts", note: "Update, disqualify and convert" },
      { path: "src/modules/crm/server/service.ts", note: "Activities and tasks" },
    ],
    tools: ["crm_get_lead", "crm_update_lead", "crm_add_activity", "crm_convert_lead"],
    prompts: [
      "Add a “Schedule a call” quick action that creates a task for tomorrow at 10:00 and logs it on the timeline.",
      "Show the original website message (form fields and page it came from) at the top of the timeline.",
      "When a lead is converted, show links to the new contact and deal on the lead page.",
    ],
  },
  {
    path: "crm/contacts",
    title: "Contacts",
    summary: "People and companies you work with, searchable, with their deals and activity.",
    files: [
      { path: "src/modules/crm/client/ContactsPage.tsx", note: "List, search, new contact" },
      { path: "src/modules/crm/client/ContactForm.tsx", note: "Contact form" },
      { path: "src/modules/crm/server/service.ts", note: "Contact services" },
      { path: "migrations/0002_crm.sql", note: "Contacts, deals and activities tables" },
    ],
    tools: ["crm_list_contacts", "crm_create_contact", "crm_update_contact"],
    prompts: [
      "Add tags to contacts (many per contact) with a tag filter on the contacts list and in crm_list_contacts.",
      "Add a CSV import for contacts with a preview step, duplicate detection by email and an audit entry.",
    ],
  },
  {
    path: "crm/contacts/:id",
    title: "Contact",
    summary: "One contact: details, deals, quotes, invoices and the activity timeline.",
    files: [
      { path: "src/modules/crm/client/ContactDetailPage.tsx", note: "Contact page" },
      { path: "src/modules/crm/client/parts.tsx", note: "Timeline and shared parts" },
      { path: "src/modules/crm/server/service.ts", note: "Contact and activity services" },
    ],
    tools: ["crm_get_contact", "crm_update_contact", "crm_add_activity"],
    prompts: [
      "Show the contact's open quotes and unpaid invoices on the contact page, reading them through the quotes and invoices APIs.",
      "Add a “Merge into…” action that merges a duplicate contact, moving deals and activities.",
    ],
  },
  {
    path: "crm/pipeline",
    title: "Pipeline",
    summary: "Deals on a drag-and-drop board of your own stages, with open and weighted value.",
    files: [
      { path: "src/modules/crm/client/PipelinePage.tsx", note: "The board, deal dialog, lost reason" },
      { path: "src/modules/crm/server/service.ts", note: "Deal services and moves" },
      { path: "src/modules/crm/server/stages.ts", note: "Stages and win probability" },
    ],
    tools: ["crm_list_deals", "crm_create_deal", "crm_update_deal", "crm_move_deal"],
    prompts: [
      "Add a filter by expected close month to the pipeline and show each column's weighted value.",
      "Highlight deals with no activity for 14 days and add a “Stale deals” dashboard widget.",
    ],
  },
  {
    path: "crm/stages",
    title: "Pipeline stages",
    summary: "Your sales process: add, rename, reorder and remove open stages, each with a win probability.",
    files: [
      { path: "src/modules/crm/client/StagesPage.tsx", note: "Stage editor" },
      { path: "src/modules/crm/server/stages.ts", note: "Stage services and rules" },
    ],
    tools: ["crm_list_stages", "crm_create_stage", "crm_update_stage"],
    prompts: ["Add a colour to each pipeline stage, chosen from the design system's chart colours, and use it on the board."],
  },
  {
    path: "crm/tasks",
    title: "Tasks",
    summary: "Follow-ups across leads, contacts and deals, overdue first.",
    files: [
      { path: "src/modules/crm/client/TasksPage.tsx", note: "Task list" },
      { path: "src/modules/crm/server/service.ts", note: "Activities and tasks" },
    ],
    tools: ["crm_list_open_tasks", "crm_add_activity"],
    prompts: [
      "Send each person a morning email with their tasks due today, from a Cron Trigger, skipping people with none.",
      "Add “Snooze to tomorrow” and “Snooze a week” actions to tasks.",
    ],
  },
];

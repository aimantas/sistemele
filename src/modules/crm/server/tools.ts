import { z } from "zod";
import { defineTool } from "@/modules/types.server";
import {
  activityInputSchema,
  contactInputSchema,
  contactPatchSchema,
  DEAL_STATUSES,
  dealInputSchema,
  dealPatchSchema,
  LEAD_FILTERS,
  leadConvertSchema,
  leadInputSchema,
  leadPatchSchema,
  leadSourceIds,
  stageInputSchema,
  stagePatchSchema,
} from "../shared/schema";
import * as leads from "./leads";
import * as crm from "./service";
import * as stages from "./stages";

const owner = z.string().optional().describe('A user id from core_list_team, "me" or "none" (unassigned).');

/** CRM tools for AI agents (MCP). Each wraps a service function. Money is in cents. */
export const crmTools = [
  // Leads
  defineTool({
    name: "crm_list_leads",
    title: "List leads",
    description:
      "Lists leads (people who asked or might buy, before there is a deal), newest first, with counts per status. `status`: open (default: new, contacted, qualified), new, contacted, qualified, disqualified, converted or all. `due: true` keeps open leads whose follow-up date is today or earlier. Returns { items, total, counts }.",
    input: z.object({ status: z.enum(LEAD_FILTERS).default("open"), ownerId: owner, source: z.enum(leadSourceIds).optional(), query: z.string().max(100).optional(), due: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) }),
    readOnly: true,
    run: ({ query, ...filters }, ctx) => leads.listLeads(ctx, { ...filters, q: query }),
  }),
  defineTool({
    name: "crm_get_lead",
    title: "Get lead",
    description: "Returns one lead with its timeline and `matchingContact` (an existing contact with the same email that converting will reuse).",
    input: z.object({ leadId: z.string() }),
    readOnly: true,
    run: ({ leadId }, ctx) => leads.getLeadDetail(ctx, leadId),
  }),
  defineTool({
    name: "crm_create_lead",
    title: "Create lead",
    description: `Adds a lead. Search first with crm_list_leads (status all) to avoid duplicates. \`source\`: ${leadSourceIds.join(", ")}. \`valueCents\` is the estimated deal value. \`followUpOn\` is YYYY-MM-DD. Without \`ownerId\` you own it; pass null to leave it unassigned.`,
    input: leadInputSchema,
    run: (input, ctx) => leads.createLead(ctx, input),
  }),
  defineTool({
    name: "crm_update_lead",
    title: "Update lead",
    description:
      "Changes the given lead fields only: details, `ownerId`, `followUpOn`, or `status` (new, contacted, qualified, disqualified). Disqualifying needs `disqualifyReason`. Logging a call, email or meeting with crm_add_activity marks a new lead contacted on its own. Converted leads cannot change.",
    input: z.object({ leadId: z.string(), changes: leadPatchSchema }),
    run: ({ leadId, changes }, ctx) => leads.updateLead(ctx, leadId, changes),
  }),
  defineTool({
    name: "crm_convert_lead",
    title: "Convert lead",
    description:
      "Turns a lead into a customer: reuses `contactId` or a contact with the same email, otherwise creates one; opens a deal unless `createDeal` is false (title defaults to the company or name, value to the lead's estimate, stage to the first open stage — see crm_list_stages). Returns { lead, contact, deal }.",
    input: leadConvertSchema.extend({ leadId: z.string() }),
    run: ({ leadId, ...input }, ctx) => leads.convertLead(ctx, leadId, input),
  }),

  // Contacts
  defineTool({
    name: "crm_list_contacts",
    title: "List contacts",
    description: "Lists customers, newest activity first. Filter with `query` (name, email, company, phone) or `tag`. Returns { items, total }.",
    input: z.object({ query: z.string().max(100).optional(), tag: z.string().max(40).optional(), limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) }),
    readOnly: true,
    run: ({ query, tag, limit, offset }, ctx) => crm.listContacts(ctx, { q: query, tag, limit, offset }),
  }),
  defineTool({
    name: "crm_get_contact",
    title: "Get contact",
    description: "Returns one contact with its deals, converted leads and timeline (notes, calls, tasks, system events such as quotes sent or invoices paid).",
    input: z.object({ contactId: z.string() }),
    readOnly: true,
    run: ({ contactId }, ctx) => crm.getContactDetail(ctx, contactId),
  }),
  defineTool({
    name: "crm_create_contact",
    title: "Create contact",
    description: "Creates a customer directly. For someone who has only asked, create a lead instead. Search first with crm_list_contacts to avoid duplicates. `kind` is person or company; `country` is a 2-letter ISO code.",
    input: contactInputSchema,
    run: (input, ctx) => crm.createContact(ctx, input),
  }),
  defineTool({
    name: "crm_update_contact",
    title: "Update contact",
    description: "Changes the given contact fields only. Pass `tags` as the full new list.",
    input: z.object({ contactId: z.string(), changes: contactPatchSchema }),
    run: ({ contactId, changes }, ctx) => crm.updateContact(ctx, contactId, changes),
  }),

  // Pipeline
  defineTool({
    name: "crm_list_stages",
    title: "List pipeline stages",
    description: "Lists pipeline stages in board order with `kind` (open, won, lost), win probability in basis points (2000 = 20%), deal count and value in cents. Stage ids are what deals use.",
    input: z.object({}),
    readOnly: true,
    run: async (_input, ctx) => ({ items: await stages.listStages(ctx) }),
  }),
  defineTool({
    name: "crm_create_stage",
    title: "Add pipeline stage",
    description: "Adds an open stage at the end of the open stages. `probabilityBps` is the win probability (5000 = 50%). Owners and admins only.",
    input: stageInputSchema,
    minRole: "admin",
    run: (input, ctx) => stages.createStage(ctx, input),
  }),
  defineTool({
    name: "crm_update_stage",
    title: "Update pipeline stage",
    description: "Renames a stage or changes its win probability (won and lost keep 100% and 0%). Owners and admins only.",
    input: z.object({ stageId: z.string(), changes: stagePatchSchema }),
    minRole: "admin",
    run: ({ stageId, changes }, ctx) => stages.updateStage(ctx, stageId, changes),
  }),
  defineTool({
    name: "crm_list_deals",
    title: "List deals",
    description: "Lists pipeline deals with stage label, probability and owner. Filter by `stage` id, `contactId`, `ownerId` or `status` (open, won, lost). Values are in cents.",
    input: z.object({ stage: z.string().optional(), contactId: z.string().optional(), ownerId: owner, status: z.enum(DEAL_STATUSES).optional() }),
    readOnly: true,
    run: async (input, ctx) => ({ items: await crm.listDeals(ctx, input) }),
  }),
  defineTool({
    name: "crm_create_deal",
    title: "Create deal",
    description: "Opens a deal for a contact. `valueCents` is the expected net value in cents. `stage` defaults to the first open stage (see crm_list_stages). Without `ownerId` you own it.",
    input: dealInputSchema,
    run: (input, ctx) => crm.createDeal(ctx, input),
  }),
  defineTool({
    name: "crm_update_deal",
    title: "Update deal",
    description: "Changes the given deal fields only: title, valueCents, expectedCloseDate (YYYY-MM-DD), ownerId, stage, lostReason (kept on lost deals).",
    input: z.object({ dealId: z.string(), changes: dealPatchSchema }),
    run: ({ dealId, changes }, ctx) => crm.updateDeal(ctx, dealId, changes),
  }),
  defineTool({
    name: "crm_move_deal",
    title: "Move deal",
    description: "Moves a deal to the end of another stage. Won and lost stages close it; pass `lostReason` when moving to lost.",
    input: z.object({ dealId: z.string(), stage: z.string(), lostReason: z.string().max(300).optional() }),
    run: ({ dealId, stage, lostReason }, ctx) => crm.updateDeal(ctx, dealId, { stage, lostReason }),
  }),

  // Timeline
  defineTool({
    name: "crm_add_activity",
    title: "Add note or task",
    description: "Adds a note, call, email, meeting or task to a lead's, contact's or deal's timeline. Tasks may have `dueAt` (YYYY-MM-DD). A call, email or meeting on a new lead marks it contacted.",
    input: activityInputSchema,
    run: (input, ctx) => crm.addActivity(ctx, input),
  }),
  defineTool({
    name: "crm_list_open_tasks",
    title: "List open tasks",
    description: "Lists tasks that are not done, earliest due date first.",
    input: z.object({}),
    readOnly: true,
    run: async (_input, ctx) => ({ items: await crm.listActivities(ctx, { openTasks: true }) }),
  }),
];

import { z } from "zod";
import { defineTool } from "@/modules/types.server";
import { activityInputSchema, contactInputSchema, contactPatchSchema, dealInputSchema, dealStageIds } from "../shared/schema";
import * as crm from "./service";

/** CRM tools for AI agents (MCP). Each wraps a service function. */
export const crmTools = [
  defineTool({
    name: "crm_list_contacts",
    title: "List contacts",
    description: "Lists customers and leads, newest activity first. Filter with `query` (name, email, company, phone) or `tag`. Returns { items, total }.",
    input: z.object({ query: z.string().max(100).optional(), tag: z.string().max(40).optional(), limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) }),
    readOnly: true,
    run: ({ query, tag, limit, offset }, ctx) => crm.listContacts(ctx, { q: query, tag, limit, offset }),
  }),
  defineTool({
    name: "crm_get_contact",
    title: "Get contact",
    description: "Returns one contact with its deals and timeline (notes, calls, tasks, system events such as quotes sent or invoices paid).",
    input: z.object({ contactId: z.string() }),
    readOnly: true,
    run: ({ contactId }, ctx) => crm.getContactDetail(ctx, contactId),
  }),
  defineTool({
    name: "crm_create_contact",
    title: "Create contact",
    description: "Creates a customer or lead. Search first with crm_list_contacts to avoid duplicates. `kind` is person or company; `country` is a 2-letter ISO code.",
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
  defineTool({
    name: "crm_list_deals",
    title: "List deals",
    description: `Lists pipeline deals. Stages: ${dealStageIds.join(", ")}. Values are in cents.`,
    input: z.object({ stage: z.enum(dealStageIds).optional(), contactId: z.string().optional() }),
    readOnly: true,
    run: async (input, ctx) => ({ items: await crm.listDeals(ctx, input) }),
  }),
  defineTool({
    name: "crm_create_deal",
    title: "Create deal",
    description: "Opens a deal for a contact. `valueCents` is the expected net value in cents.",
    input: dealInputSchema,
    run: (input, ctx) => crm.createDeal(ctx, input),
  }),
  defineTool({
    name: "crm_move_deal",
    title: "Move deal",
    description: "Moves a deal to another pipeline stage (won and lost close it).",
    input: z.object({ dealId: z.string(), stage: z.enum(dealStageIds) }),
    run: ({ dealId, stage }, ctx) => crm.moveDeal(ctx, dealId, { stage, position: Date.now() }),
  }),
  defineTool({
    name: "crm_add_activity",
    title: "Add note or task",
    description: "Adds a note, call, email, meeting or task to a contact's or deal's timeline. Tasks may have `dueAt` (YYYY-MM-DD).",
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

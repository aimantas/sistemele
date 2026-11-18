import { z } from "zod";
import { patchSchema } from "@/shared/zod";

/** CRM shapes shared by the API, MCP tools and the dashboard forms. */

const text = (max: number) => z.string().trim().max(max);
const isoDate = z.union([z.literal(""), z.iso.date()]).nullable();

// Pipeline stages (table `pipeline_stages`). Owners and admins edit them in
// Pipeline → Stages. Exactly one won and one lost stage always exist; open
// stages can be added, renamed, reordered and removed.

export const STAGE_KINDS = ["open", "won", "lost"] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

/** A sent quote moves the deal to this stage when it exists and the deal is in an earlier open stage. */
export const QUOTE_SENT_STAGE_ID = "proposal";

export interface Stage {
  /** Readable, permanent id derived from the first label: "negotiation". */
  id: string;
  label: string;
  kind: StageKind;
  /** Win probability in basis points (2000 = 20%). Won is 10000, lost 0. */
  probabilityBps: number;
  position: number;
  dealCount: number;
  valueCents: number;
}

export const stageInputSchema = z.object({
  label: text(60).min(1, "Enter a stage name."),
  probabilityBps: z.number().int().min(0, "Use 0–100%.").max(10_000, "Use 0–100%.").default(0),
});
export type StageInput = z.input<typeof stageInputSchema>;
export const stagePatchSchema = patchSchema(stageInputSchema);
export const stageOrderSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(30) });
export const stageDeleteSchema = z.object({ moveTo: z.string().min(1).optional() });

// Leads (table `leads`): people who asked or might buy, before there is a deal.

export const LEAD_STATUSES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "disqualified", label: "Disqualified" },
  { id: "converted", label: "Converted" },
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number]["id"];
/** Statuses a person sets by hand; "converted" is only set by converting. */
export const EDITABLE_LEAD_STATUSES = ["new", "contacted", "qualified", "disqualified"] as const;
export const OPEN_LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified"];
/** List filters: a status, "open" (new, contacted, qualified) or "all". */
export const LEAD_FILTERS = ["open", "new", "contacted", "qualified", "disqualified", "converted", "all"] as const;
export type LeadFilter = (typeof LEAD_FILTERS)[number];

export const LEAD_SOURCES = [
  { id: "website", label: "Website" },
  { id: "referral", label: "Referral" },
  { id: "outbound", label: "Outbound" },
  { id: "event", label: "Event" },
  { id: "social", label: "Social media" },
  { id: "ads", label: "Ads" },
  { id: "partner", label: "Partner" },
  { id: "other", label: "Other" },
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number]["id"];
export const leadSourceIds = LEAD_SOURCES.map((source) => source.id) as [LeadSource, ...LeadSource[]];

const leadFields = {
  name: text(200).min(1, "Enter a name."),
  email: z.union([z.literal(""), z.email("Enter a valid email.").max(254)]).default(""),
  phone: text(50).default(""),
  company: text(200).default(""),
  message: text(5000).default(""),
  source: z.enum(leadSourceIds).default("other"),
  valueCents: z.number().int().min(0).default(0),
  /** User id, or null for unassigned. Omit on create to assign the creator. */
  ownerId: z.string().max(80).nullable().optional(),
  followUpOn: isoDate.default(null),
};

export const leadInputSchema = z.object(leadFields);
export type LeadInput = z.input<typeof leadInputSchema>;
export const leadPatchSchema = patchSchema(leadInputSchema).extend({
  status: z.enum(EDITABLE_LEAD_STATUSES).optional(),
  disqualifyReason: text(300).optional(),
});
export type LeadPatch = z.input<typeof leadPatchSchema>;

export const leadConvertSchema = z.object({
  /** Attach to this contact. Without it, a contact with the same email is reused, otherwise one is created. */
  contactId: z.string().max(80).optional(),
  createDeal: z.boolean().default(true),
  dealTitle: text(200).optional(),
  /** Defaults to the lead's estimated value. */
  valueCents: z.number().int().min(0).optional(),
  /** An open stage id; defaults to the first open stage. */
  stage: z.string().max(60).optional(),
});
export type LeadConvertInput = z.input<typeof leadConvertSchema>;

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  source: LeadSource;
  status: LeadStatus;
  valueCents: number;
  ownerId: string | null;
  ownerName: string | null;
  followUpOn: string | null;
  disqualifyReason: string;
  contactId: string | null;
  contactName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDetail {
  lead: Lead;
  activities: Activity[];
  /** An existing contact with the same email; converting reuses it. */
  matchingContact: { id: string; name: string } | null;
}

// Contacts

export const contactInputSchema = z.object({
  kind: z.enum(["person", "company"]).default("company"),
  name: text(200).min(1, "Enter a name."),
  email: z.union([z.literal(""), z.email("Enter a valid email.").max(254)]).default(""),
  phone: text(50).default(""),
  companyName: text(200).default(""),
  companyCode: text(50).default(""),
  vatCode: text(50).default(""),
  address: text(300).default(""),
  city: text(100).default(""),
  postalCode: text(20).default(""),
  country: text(2).default(""),
  website: text(200).default(""),
  tags: z.array(text(40).min(1)).max(20).default([]),
  notes: text(5000).default(""),
});
export type ContactInput = z.input<typeof contactInputSchema>;
export const contactPatchSchema = patchSchema(contactInputSchema);

export interface Contact {
  id: string;
  kind: "person" | "company";
  name: string;
  email: string;
  phone: string;
  companyName: string;
  companyCode: string;
  vatCode: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  website: string;
  tags: string[];
  notes: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

// Deals

export const dealInputSchema = z.object({
  contactId: z.string().min(1, "Choose a contact."),
  title: text(200).min(1, "Enter a title."),
  valueCents: z.number().int().min(0).default(0),
  /** A stage id from pipeline_stages; defaults to the first open stage. */
  stage: z.string().max(60).optional(),
  expectedCloseDate: isoDate.default(null),
  /** User id, or null for unassigned. Omit on create to assign the creator. */
  ownerId: z.string().max(80).nullable().optional(),
  lostReason: text(300).default(""),
});
export type DealInput = z.input<typeof dealInputSchema>;
export const dealPatchSchema = patchSchema(dealInputSchema.omit({ contactId: true }));
export type DealPatch = z.input<typeof dealPatchSchema>;
export const dealMoveSchema = z.object({ stage: z.string().min(1).max(60), position: z.number().finite(), lostReason: text(300).optional() });
export type DealMove = z.input<typeof dealMoveSchema>;
export const DEAL_STATUSES = ["open", "won", "lost"] as const;

export interface Deal {
  id: string;
  contactId: string;
  contactName: string;
  title: string;
  valueCents: number;
  stage: string;
  stageLabel: string;
  stageKind: StageKind;
  probabilityBps: number;
  position: number;
  expectedCloseDate: string | null;
  ownerId: string | null;
  ownerName: string | null;
  lostReason: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

// Activities: the timeline of a lead, contact or deal.

export const ACTIVITY_KINDS = ["note", "call", "email", "meeting", "task"] as const;
/** Logging one of these on a new lead marks it contacted. */
export const CONTACT_ACTIVITY_KINDS = ["call", "email", "meeting"] as const;

export const activityInputSchema = z
  .object({
    contactId: z.string().nullable().default(null),
    dealId: z.string().nullable().default(null),
    leadId: z.string().nullable().default(null),
    kind: z.enum(ACTIVITY_KINDS).default("note"),
    body: text(5000).min(1, "Write something."),
    dueAt: z.union([z.literal(""), z.iso.date(), z.iso.datetime()]).nullable().default(null),
  })
  .refine((value) => value.contactId || value.dealId || value.leadId, { message: "Attach the activity to a lead, contact or deal.", path: ["contactId"] });
export type ActivityInput = z.input<typeof activityInputSchema>;

export interface Activity {
  id: string;
  contactId: string | null;
  dealId: string | null;
  leadId: string | null;
  kind: "note" | "call" | "email" | "meeting" | "task" | "system";
  body: string;
  dueAt: string | null;
  doneAt: string | null;
  authorName: string | null;
  contactName: string | null;
  leadName: string | null;
  createdAt: string;
}

export interface ContactDetail {
  contact: Contact;
  deals: Deal[];
  activities: Activity[];
  leads: Lead[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
}

/** Public contact form; each message becomes a lead. `website` is a honeypot and must stay empty. */
export const inquirySchema = z.object({
  name: text(120).min(1),
  email: z.email().max(254),
  phone: text(50).default(""),
  company: text(200).default(""),
  message: text(5000).min(1),
  website: z.string().max(0).optional().default(""),
  turnstileToken: z.string().max(4096).optional(),
});
export type InquiryInput = z.input<typeof inquirySchema>;

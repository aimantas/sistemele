import { z } from "zod";
import { patchSchema } from "@/shared/zod";

/** CRM shapes shared by the API, MCP tools and the dashboard forms. */

export const DEAL_STAGES = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const;
export type DealStage = (typeof DEAL_STAGES)[number]["id"];
export const dealStageIds = DEAL_STAGES.map((stage) => stage.id) as [DealStage, ...DealStage[]];
export const OPEN_STAGES: DealStage[] = ["lead", "qualified", "proposal"];

export const ACTIVITY_KINDS = ["note", "call", "email", "meeting", "task"] as const;

const text = (max: number) => z.string().trim().max(max);

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

export const dealInputSchema = z.object({
  contactId: z.string().min(1, "Choose a contact."),
  title: text(200).min(1, "Enter a title."),
  valueCents: z.number().int().min(0).default(0),
  stage: z.enum(dealStageIds).default("lead"),
  expectedCloseDate: z.union([z.literal(""), z.iso.date()]).nullable().default(null),
});
export type DealInput = z.input<typeof dealInputSchema>;
export const dealPatchSchema = patchSchema(dealInputSchema.omit({ contactId: true }));
export const dealMoveSchema = z.object({ stage: z.enum(dealStageIds), position: z.number().finite() });

export interface Deal {
  id: string;
  contactId: string;
  contactName: string;
  title: string;
  valueCents: number;
  stage: DealStage;
  position: number;
  expectedCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export const activityInputSchema = z
  .object({
    contactId: z.string().nullable().default(null),
    dealId: z.string().nullable().default(null),
    kind: z.enum(ACTIVITY_KINDS).default("note"),
    body: text(5000).min(1, "Write something."),
    dueAt: z.union([z.literal(""), z.iso.date(), z.iso.datetime()]).nullable().default(null),
  })
  .refine((value) => value.contactId || value.dealId, { message: "Attach the activity to a contact or a deal.", path: ["contactId"] });
export type ActivityInput = z.input<typeof activityInputSchema>;

export interface Activity {
  id: string;
  contactId: string | null;
  dealId: string | null;
  kind: "note" | "call" | "email" | "meeting" | "task" | "system";
  body: string;
  dueAt: string | null;
  doneAt: string | null;
  authorName: string | null;
  contactName: string | null;
  createdAt: string;
}

export interface ContactDetail {
  contact: Contact;
  deals: Deal[];
  activities: Activity[];
}

/** Public "request a quote" form. `website` is a honeypot and must stay empty. */
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

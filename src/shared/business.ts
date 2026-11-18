import { z } from "zod";
import { config } from "../../sistemele.config";

/** Seller details printed on quotes and invoices. Stored in settings under "business". */
export const businessProfileSchema = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: z.string().trim().max(200).default(""),
  companyCode: z.string().trim().max(50).default(""),
  vatCode: z.string().trim().max(50).default(""),
  address: z.string().trim().max(300).default(""),
  email: z.union([z.literal(""), z.email()]).default(""),
  phone: z.string().trim().max(50).default(""),
  website: z.string().trim().max(200).default(""),
  bankName: z.string().trim().max(100).default(""),
  iban: z.string().trim().max(50).default(""),
  currency: z.string().length(3).default(config.currency),
  defaultVatRateBps: z.number().int().min(0).max(10_000).default(config.business.defaultVatRateBps),
  invoicePrefix: z.string().trim().min(1).max(10).default(config.business.invoicePrefix),
  quotePrefix: z.string().trim().min(1).max(10).default(config.business.quotePrefix),
  paymentTermsDays: z.number().int().min(0).max(365).default(config.business.paymentTermsDays),
  invoiceFooter: z.string().trim().max(1000).default(""),
});

export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const defaultBusinessProfile: BusinessProfile = businessProfileSchema.parse({ name: config.business.name });

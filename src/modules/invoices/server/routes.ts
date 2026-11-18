import { Hono, type Context } from "hono";
import { getContext } from "@/worker/context";
import type { AppEnv } from "@/worker/env";
import { badRequest } from "@/worker/lib/errors";
import { readQuery } from "@/worker/lib/validate";
import { listQuerySchema, type InvoiceInput, type InvoicePatch, type IssueInput, type PaymentInput } from "../shared/schema";
import * as invoices from "./service";

/**
 * Raw JSON body, or {} when the request has none (action endpoints such as
 * /issue). Services validate it after their permission check.
 */
async function readBody<T>(c: Context<AppEnv>): Promise<T> {
  const text = await c.req.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest("Send a JSON body.");
  }
}

/** Mounted at /api/invoices (signed-in users). Thin: every rule lives in service.ts. */
export const invoicesApi = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await invoices.listInvoices(getContext(c), readQuery(c, listQuerySchema))))
  .post("/", async (c) => c.json(await invoices.createDraft(getContext(c), await readBody<InvoiceInput>(c)), 201))
  .post("/from-quote/:quoteId", async (c) => {
    try {
      return c.json(await invoices.createFromQuote(getContext(c), c.req.param("quoteId")), 201);
    } catch (error) {
      // The existing invoice's id lets the dashboard and scripts jump straight to it.
      if (error instanceof invoices.InvoiceExistsError) return c.json({ error: { code: error.code, message: error.message }, invoiceId: error.invoiceId }, 409);
      throw error;
    }
  })
  .get("/:id", async (c) => c.json(await invoices.getInvoice(getContext(c), c.req.param("id"))))
  .patch("/:id", async (c) => c.json(await invoices.updateDraft(getContext(c), c.req.param("id"), await readBody<InvoicePatch>(c))))
  .delete("/:id", async (c) => {
    await invoices.deleteDraft(getContext(c), c.req.param("id"));
    return c.json({ ok: true });
  })
  .post("/:id/issue", async (c) => c.json(await invoices.issueInvoice(getContext(c), c.req.param("id"), await readBody<IssueInput>(c))))
  .post("/:id/send", async (c) => c.json(await invoices.sendInvoice(getContext(c), c.req.param("id"))))
  .post("/:id/payments", async (c) => c.json(await invoices.recordPayment(getContext(c), c.req.param("id"), await readBody<PaymentInput>(c)), 201))
  .delete("/:id/payments/:paymentId", async (c) => c.json(await invoices.deletePayment(getContext(c), c.req.param("id"), c.req.param("paymentId"))))
  .post("/:id/void", async (c) => c.json(await invoices.voidInvoice(getContext(c), c.req.param("id"), await readBody<{ reason: string }>(c))));

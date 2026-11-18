import { Hono, type Context } from "hono";
import { z } from "zod";
import { getContext } from "@/worker/context";
import type { AppEnv } from "@/worker/env";
import { AppError, badRequest } from "@/worker/lib/errors";
import { enforceRateLimit } from "@/worker/lib/rate-limit";
import { readQuery } from "@/worker/lib/validate";
import { quoteListStatuses } from "../shared/schema";
import * as quotes from "./service";

const listQuerySchema = z.object({
  status: z.enum(quoteListStatuses).optional(),
  contactId: z.string().max(80).optional(),
  dealId: z.string().max(80).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().optional(),
  offset: z.coerce.number().int().optional(),
});

/**
 * JSON body; services validate the shape with Zod. With `optional`, an empty
 * body counts as `{}` so action endpoints accept a bare POST.
 */
async function jsonBody<T>(c: Context<AppEnv>, optional = false): Promise<T> {
  const text = await c.req.text();
  if (!text.trim() && optional) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest("Send a JSON body.");
  }
}

/** Mounted at /api/quotes (signed-in users). */
export const quotesApi = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await quotes.listQuotes(getContext(c), readQuery(c, listQuerySchema))))
  .post("/", async (c) => c.json(await quotes.createQuote(getContext(c), await jsonBody(c)), 201))
  .get("/:id", async (c) => c.json(await quotes.getQuote(getContext(c), c.req.param("id"))))
  .patch("/:id", async (c) => c.json(await quotes.updateQuote(getContext(c), c.req.param("id"), await jsonBody(c))))
  .delete("/:id", async (c) => {
    await quotes.deleteQuote(getContext(c), c.req.param("id"));
    return c.json({ ok: true });
  })
  .post("/:id/send", async (c) => c.json(await quotes.sendQuote(getContext(c), c.req.param("id"), await jsonBody(c, true))))
  .post("/:id/revise", async (c) => c.json(await quotes.reviseQuote(getContext(c), c.req.param("id"))))
  .post("/:id/mark", async (c) => c.json(await quotes.markQuote(getContext(c), c.req.param("id"), await jsonBody(c))))
  .post("/:id/duplicate", async (c) => c.json(await quotes.duplicateQuote(getContext(c), c.req.param("id")), 201));

function isFormPost(c: Context<AppEnv>): boolean {
  const type = c.req.header("content-type") ?? "";
  return type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data");
}

/**
 * The customer's answer. The quote page posts a plain HTML form (303 back to
 * /q/:token); agents and custom sites may POST JSON instead.
 */
function answer(status: "accepted" | "declined") {
  return async (c: Context<AppEnv>) => {
    const ctx = getContext(c);
    const token = c.req.param("token") ?? "";
    const form = isFormPost(c);
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    const back = `/q/${encodeURIComponent(token)}`;
    try {
      await enforceRateLimit(ctx.db, `quote-answer:${ip}`, 20, 3600);
      const { quote } = await quotes.answerByToken(ctx, token, status);
      return form ? c.redirect(`${back}?done=${status}`, 303) : c.json({ ok: true, status: quote.status, number: quote.number });
    } catch (error) {
      if (!form || !(error instanceof AppError)) throw error;
      if (error.code === "not_found") return c.redirect(back, 303);
      return c.redirect(`${back}?error=${error.code === "rate_limited" ? "rate_limited" : "closed"}`, 303);
    }
  };
}

/** Mounted at /api/public/quotes. No sign-in: the token is the permission. */
export const quotesPublicApi = new Hono<AppEnv>().post("/:token/accept", answer("accepted")).post("/:token/decline", answer("declined"));

import type { Context } from "hono";
import type { z } from "zod";
import { badRequest } from "./errors";

/** Parse and validate a JSON body. Zod errors become 422 responses. */
export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Send a JSON body.");
  }
  return schema.parse(body);
}

/** Parse and validate query parameters (all values arrive as strings). */
export function readQuery<S extends z.ZodType>(c: Context, schema: S): z.infer<S> {
  return schema.parse(c.req.query());
}

import { Hono, type Context } from "hono";
import { z } from "zod";
import { getContext } from "@/worker/context";
import type { AppEnv } from "@/worker/env";
import { readJson, readQuery } from "@/worker/lib/validate";
import { entryListQuerySchema } from "../shared/schema";
import * as content from "./service";

/** JSON body; services validate it with Zod. Malformed JSON becomes a 400. */
const body = (c: Context<AppEnv>) => readJson(c, z.any());

/** Mounted at /api/content (signed-in users and API tokens). */
export const contentApi = new Hono<AppEnv>()
  .get("/entries", async (c) => c.json(await content.listEntries(getContext(c), readQuery(c, entryListQuerySchema))))
  .post("/entries", async (c) => c.json(await content.createEntry(getContext(c), await body(c)), 201))
  .get("/entries/:id", async (c) => c.json(await content.getEntry(getContext(c), c.req.param("id"))))
  .patch("/entries/:id", async (c) => c.json(await content.updateEntry(getContext(c), c.req.param("id"), await body(c))))
  .post("/entries/:id/publish", async (c) => c.json(await content.publishEntry(getContext(c), c.req.param("id"), await body(c))))
  .post("/entries/:id/unpublish", async (c) => c.json(await content.unpublishEntry(getContext(c), c.req.param("id"))))
  .post("/entries/:id/archive", async (c) => c.json(await content.archiveEntry(getContext(c), c.req.param("id"))))
  .post("/entries/:id/restore", async (c) => c.json(await content.restoreEntry(getContext(c), c.req.param("id"))));

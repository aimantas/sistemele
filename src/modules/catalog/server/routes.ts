import { Hono, type Context } from "hono";
import { z } from "zod";
import { getContext } from "@/worker/context";
import type { AppEnv } from "@/worker/env";
import { readJson, readQuery } from "@/worker/lib/validate";
import { productListQuerySchema } from "../shared/schema";
import * as catalog from "./service";

/** JSON body; services validate it with Zod. Malformed JSON becomes a 400. */
const body = (c: Context<AppEnv>) => readJson(c, z.any());

/** Mounted at /api/catalog (signed-in users). */
export const catalogApi = new Hono<AppEnv>()
  .get("/products", async (c) => {
    const query = readQuery(c, productListQuerySchema);
    return c.json(await catalog.listProducts(getContext(c), { ...query, lowStock: query.lowStock === "1" }));
  })
  .post("/products", async (c) => c.json(await catalog.createProduct(getContext(c), await body(c)), 201))
  .get("/products/:id", async (c) => c.json(await catalog.getProductDetail(getContext(c), c.req.param("id"))))
  .patch("/products/:id", async (c) => c.json(await catalog.updateProduct(getContext(c), c.req.param("id"), await body(c))))
  .post("/products/:id/archive", async (c) => c.json(await catalog.archiveProduct(getContext(c), c.req.param("id"))))
  .post("/products/:id/restore", async (c) => c.json(await catalog.restoreProduct(getContext(c), c.req.param("id"))))
  .post("/products/:id/movements", async (c) => c.json(await catalog.recordMovement(getContext(c), c.req.param("id"), await body(c)), 201))

  .get("/movements", async (c) => {
    const query = readQuery(c, z.object({ productId: z.string().max(80).optional(), limit: z.coerce.number().int().optional() }));
    return c.json({ items: await catalog.listMovements(getContext(c), query) });
  });

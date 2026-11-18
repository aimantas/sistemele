import { z } from "zod";

type WithoutDefaults<T extends z.ZodRawShape> = { [K in keyof T]: T[K] extends z.ZodDefault<infer Inner> ? Inner : T[K] };

/**
 * PATCH schema from a create schema. Zod 4 still applies `.default()` inside
 * `.partial()`, which would reset every field the client did not send. This
 * strips defaults first, so a PATCH only touches the fields it contains.
 */
export function patchSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [key, field instanceof z.ZodDefault ? field.unwrap() : field]),
  ) as WithoutDefaults<T>;
  return z.object(shape).partial();
}

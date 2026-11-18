import { brandingSchema, defaultBranding, type Branding } from "@/shared/branding";
import { businessProfileSchema, defaultBusinessProfile, type BusinessProfile } from "@/shared/business";
import type { Db } from "./db";

export async function getSetting<T>(db: Db, key: string): Promise<T | null> {
  const row = await db.first<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function putSetting(db: Db, key: string, value: unknown, userId: string | null): Promise<void> {
  await db.run(
    `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    [key, JSON.stringify(value), userId],
  );
}

/** Seller profile with defaults from sistemele.config.ts filled in. */
export async function getBusinessProfile(db: Db): Promise<BusinessProfile> {
  const stored = await getSetting<unknown>(db, "business");
  const parsed = businessProfileSchema.safeParse({ ...defaultBusinessProfile, ...(stored as object | null) });
  return parsed.success ? parsed.data : defaultBusinessProfile;
}

/** Brand settings with defaults filled in. */
export async function getBranding(db: Db): Promise<Branding> {
  const stored = await getSetting<unknown>(db, "branding");
  const parsed = brandingSchema.safeParse({ ...defaultBranding, ...(stored as object | null) });
  return parsed.success ? parsed.data : defaultBranding;
}

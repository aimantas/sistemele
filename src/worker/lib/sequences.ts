import type { Db } from "./db";

/** Series name per prefix and year, e.g. "INV-2026". Numbers look like INV-2026-0001. */
export function seriesName(prefix: string, year: number): string {
  return `${prefix}-${year}`;
}

/**
 * Next number in a series via one atomic UPSERT … RETURNING. Use for documents
 * where a gap after a failed write is acceptable (quotes).
 */
export async function nextDocumentNumber(db: Db, prefix: string, year: number): Promise<string> {
  const name = seriesName(prefix, year);
  const row = await db.first<{ value: number }>(
    `INSERT INTO sequences (name, value) VALUES (?, 1)
     ON CONFLICT(name) DO UPDATE SET value = sequences.value + 1
     RETURNING value`,
    [name],
  );
  return `${name}-${String(row?.value ?? 1).padStart(4, "0")}`;
}

/**
 * Gap-free numbering for legal documents (invoices): put both statements in
 * the same `db.batch([...])` as the status change. D1 runs a batch as one
 * transaction, so a number is consumed only when the document is issued.
 */
export function gapFreeNumberStatements(
  db: Db,
  table: "invoices" | "quotes",
  id: string,
  prefix: string,
  year: number,
): D1PreparedStatement[] {
  const name = seriesName(prefix, year);
  return [
    db.prepare(
      `INSERT INTO sequences (name, value) VALUES (?, 1)
       ON CONFLICT(name) DO UPDATE SET value = sequences.value + 1`,
      [name],
    ),
    db.prepare(
      `UPDATE ${table} SET number = ? || '-' || printf('%04d', (SELECT value FROM sequences WHERE name = ?)) WHERE id = ?`,
      [name, name, id],
    ),
  ];
}

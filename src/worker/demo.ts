import { isDemo, type Env } from "./env";

/**
 * Public demo reset. The Cron Trigger in a demo deployment calls
 * resetDemoData(): every table is emptied (users and sessions too, so
 * visitors start fresh) and the fictional data in seed/*.sql is loaded again.
 * Seed dates are relative to "now", so the demo always looks current.
 * Only runs when DEMO_MODE is on; see docs/deployment.md.
 */

const seedFiles = import.meta.glob("../../seed/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Splits SQL into statements on `;`, ignoring semicolons inside quotes and `--` comments. */
export function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (quote) {
      current += char;
      if (char === quote) {
        // A doubled quote ('') is an escaped quote inside the string.
        if (sql[i + 1] === quote) current += sql[++i];
        else quote = null;
      }
      continue;
    }
    if (char === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      current += "\n";
      continue;
    }
    if (char === "'" || char === '"') quote = char;
    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

/** Seed statements in file order (01_core, 02_crm …). */
export function demoSeedStatements(): string[] {
  return Object.keys(seedFiles)
    .sort()
    .flatMap((file) => splitSql(seedFiles[file]));
}

/** Empties every application table and loads the demo data, in one transaction. */
export async function resetDemoData(db: D1Database): Promise<{ tables: number; statements: number }> {
  const tables = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name")
    .all<{ name: string }>();
  const seed = demoSeedStatements();
  await db.batch([
    db.prepare("PRAGMA defer_foreign_keys = on"),
    ...tables.results.map((table) => db.prepare(`DELETE FROM "${table.name.replace(/"/gu, '""')}"`)),
    ...seed.map((statement) => db.prepare(statement)),
  ]);
  return { tables: tables.results.length, statements: seed.length };
}

/** Cron Trigger handler: resets the demo; does nothing outside demo mode. */
export async function scheduledDemoReset(env: Env): Promise<void> {
  if (!isDemo(env)) return;
  const result = await resetDemoData(env.DB);
  console.info(`Demo reset: ${result.tables} tables emptied, ${result.statements} seed statements loaded.`);
}

/**
 * Thin, typed wrapper over D1. Write plain SQL with `?` placeholders.
 * Use `batch` for multi-statement writes that must succeed or fail together
 * (D1 runs a batch as one transaction).
 */
export type SqlValue = string | number | null;

export class Db {
  constructor(readonly d1: D1Database) {}

  prepare(sql: string, params: readonly SqlValue[] = []): D1PreparedStatement {
    return this.d1.prepare(sql).bind(...params);
  }

  async all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    const result = await this.prepare(sql, params).all<T>();
    return result.results;
  }

  async first<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    return (await this.prepare(sql, params).first<T>()) ?? null;
  }

  async value<T extends SqlValue>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    const row = await this.prepare(sql, params).first<Record<string, T>>();
    if (!row) return null;
    const [first] = Object.values(row);
    return first ?? null;
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<D1Result> {
    return this.prepare(sql, params).run();
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    if (statements.length === 0) return [];
    return this.d1.batch(statements);
  }
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

export function parseJsonColumn<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Escapes LIKE wildcards; use with `LIKE ? ESCAPE '\'`. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/gu, (char) => `\\${char}`)}%`;
}

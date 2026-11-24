export type DbError = { code?: string; message: string };

export type DbResult = { data: unknown; error: DbError | null };

export interface DbQuery extends PromiseLike<DbResult> {
  select(columns: string): DbQuery;
  insert(row: Record<string, unknown>): DbQuery;
  update(row: Record<string, unknown>): DbQuery;
  eq(column: string, value: string | number | boolean | null): DbQuery;
  gte(column: string, value: string): DbQuery;
  lt(column: string, value: string): DbQuery;
  in(column: string, values: string[]): DbQuery;
  or(filters: string): DbQuery;
  order(column: string, options?: { ascending?: boolean }): DbQuery;
  limit(count: number): DbQuery;
  maybeSingle(): Promise<DbResult>;
}

export interface Db {
  from(table: string): DbQuery;
}

export function isMissingRelation(
  error: DbError | null | undefined,
  relation: string,
) {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  if (code === "42P01" || code === "PGRST205") {
    return true;
  }
  const message = (error.message ?? "").toLowerCase();
  const name = relation.toLowerCase();
  return (
    message.includes(name) &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find"))
  );
}

export function isMissingColumn(error: DbError | null | undefined, column: string) {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (!message.includes(column.toLowerCase())) {
    return false;
  }
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

export function rowsOf<T>(result: DbResult): T[] {
  if (!result.data) {
    return [];
  }
  return (Array.isArray(result.data) ? result.data : [result.data]) as T[];
}

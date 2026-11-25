import {
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";

type DbError = { code?: string; message?: string } | null | undefined;

export function hostSchemaUnavailable() {
  const error = new Error(SERVICE_UNAVAILABLE_MESSAGE);
  error.name = "ServiceUnavailableError";
  return error;
}

export function isMissingColumn(error: DbError, column: string) {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  if (code !== "42703" && code !== "PGRST204") {
    return false;
  }
  return (error.message ?? "").toLowerCase().includes(column.toLowerCase());
}

export function isMissingRelation(error: DbError, relation: string) {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  if (code !== "42P01" && code !== "PGRST205") {
    return false;
  }
  return (error.message ?? "").toLowerCase().includes(relation.toLowerCase());
}

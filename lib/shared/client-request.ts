/**
 * Identificador del intento de un envío (SDD-0599). Lo genera el navegador y lo repite
 * en cada reintento: la base lo usa de candado para no crear dos filas por un envío.
 */
export const CLIENT_REQUEST_FIELD = "request_id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** El identificador del FormData. Sin él, o inválido, el envío va sin candado: un POST sin JavaScript no lo trae. */
export function readClientRequestId(formData: FormData): string | null {
  const value = formData.get(CLIENT_REQUEST_FIELD);
  return typeof value === "string" && UUID.test(value) ? value : null;
}

type DbError = { code?: string; message?: string } | null | undefined;

/** Otro intento con el mismo identificador ya creó la fila. El índice se distingue del choque de un correlativo por su nombre. */
export function isClientRequestConflict(error: DbError): boolean {
  return error?.code === "23505" && (error.message ?? "").includes("client_request_uidx");
}

/** La columna no existe: la base va sin 0512. El orden previsto es aplicarla antes, y esto evita romper si falla. */
export function isMissingClientRequestColumn(error: DbError): boolean {
  return (error?.code === "PGRST204" || error?.code === "42703") && (error.message ?? "").includes("client_request_id");
}

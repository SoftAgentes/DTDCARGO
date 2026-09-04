import { NextResponse } from "next/server";
import type { StructuredLogger } from "@/lib/observability/structured-logger";

type ApiErrorOptions = {
  logger?: StructuredLogger;
  event?: string;
  fields?: Record<string, unknown>;
  includeDetail?: boolean;
};

/**
 * Extrae un mensaje legible de un error desconocido. Cubre `Error` nativo
 * y `PostgrestError` de supabase-js (objeto plano con `.message`, NO es
 * instancia de Error).
 */
function detailOf(err: unknown): string | undefined {
  if (err == null) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(err);
}

/**
 * Respuesta JSON de error estándar para route handlers.
 *
 * Nunca filtra el mensaje crudo del error al cliente en producción: puede
 * exponer nombres de tablas/columnas, fragmentos de SQL o internals de
 * Node. Loguea el detalle real server-side (queda en los logs de Vercel) y
 * devuelve un `error` genérico. En desarrollo agrega `detail` para no
 * perder DX local.
 *
 * @param userMessage  Mensaje genérico y seguro para el cliente.
 * @param err          El error crudo (se loguea, no se filtra en prod).
 * @param status       HTTP status (default 500).
 * @param tag          Etiqueta para el log server-side (default "api").
 * @param options      Logger estructurado opcional para rutas correlacionadas.
 */
export function apiError(
  userMessage: string,
  err: unknown,
  status = 500,
  tag = "api",
  options: ApiErrorOptions = {},
): NextResponse {
  const detail = detailOf(err);
  if (options.logger) {
    options.logger.error(options.event ?? "api.failed", {
      ...options.fields,
      status,
      error: err,
    });
  } else {
    console.error(`[${tag}] ${userMessage}`, detail ?? err);
  }
  const body: { error: string; detail?: string } = { error: userMessage };
  const includeDetail = options.includeDetail ?? !options.logger;
  if (process.env.NODE_ENV !== "production" && detail && includeDetail) {
    body.detail = detail;
  }
  return NextResponse.json(body, { status });
}

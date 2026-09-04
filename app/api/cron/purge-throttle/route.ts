/**
 * /api/cron/purge-throttle — purga throttles públicos y del PIN móvil.
 *
 * La tabla acumula una fila por intento de anti-abuso por IP de TODOS los buckets
 * públicos (registro self-service, contacto, estimación, ocean-rate y
 * registro/check), namespaced por prefijo en la columna `ip`. Las ventanas de
 * throttle son ≤ 60 min, así que cualquier fila de más de 48 h ya no cuenta para
 * nada → la borramos para que la tabla no crezca sin límite. Diaria (vercel.json).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` — mismo patrón que
 * push-drain / ceo-brief. El secret SOLO por header (nunca query-param: terminan
 * en logs/referrers). Idempotente: si no hay filas viejas, borra 0 y devuelve ok.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { createRequestLogger } from "@/lib/observability/structured-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Retención: las ventanas de throttle son ≤ 60 min; 48 h es margen de sobra. */
const RETENTION_HOURS = 48;

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const logger = createRequestLogger(req, "cron.purge-throttle");
  const auth = authorize(req);
  if (!auth.ok) {
    logger.warn("cron.authorization_denied", {
      status: 403,
      authState:
        auth.reason === "CRON_SECRET no configurado"
          ? "not_configured"
          : "invalid",
    });
    return logger.withResponse(
      NextResponse.json({ error: auth.reason }, { status: 403 }),
    );
  }

  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - RETENTION_HOURS * 60 * 60 * 1000,
  ).toISOString();

  // .lt(...) es un filtro obligatorio: PostgREST rechaza un DELETE sin filtro.
  const { error, count } = await admin
    .from("portal_registro_throttle")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) {
    return logger.withResponse(
      apiError("No se pudo purgar el throttle.", error, 500, "purge-throttle", {
        logger,
        event: "cron.delete_failed",
        fields: { stage: "portal_throttle" },
      }),
    );
  }

  const { error: pinError, count: pinCount } = await admin
    .from("operario_pin_attempts")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (pinError) {
    return logger.withResponse(
      apiError(
        "No se pudo purgar el throttle de PIN.",
        pinError,
        500,
        "purge-pin-throttle",
        {
          logger,
          event: "cron.delete_failed",
          fields: {
            stage: "pin_throttle",
            deletedBeforeFailure: count ?? 0,
          },
        },
      ),
    );
  }

  const deleted = (count ?? 0) + (pinCount ?? 0);
  logger.info("cron.completed", {
    deleted,
    deletedPortalThrottle: count ?? 0,
    deletedPinAttempts: pinCount ?? 0,
    durationMs: Date.now() - startedAt,
  });
  return logger.withResponse(
    NextResponse.json({
      ok: true,
      deleted,
      deletedByTable: {
        portal_registro_throttle: count ?? 0,
        operario_pin_attempts: pinCount ?? 0,
      },
      cutoff,
    }),
  );
}

export async function POST(req: NextRequest) {
  return GET(req);
}

/**
 * /api/cron/purge-throttle — purga throttles públicos y del PIN móvil.
 *
 * La tabla acumula una fila por intento de anti-abuso por IP de TODOS los buckets
 * públicos (registro self-service, contacto, estimación, ocean-rate y
 * registro/check), namespaced por prefijo en la columna `ip`. Las ventanas de
 * throttle son ≤ 60 min, así que cualquier fila de más de 48 h ya no cuenta para
 * nada → la borramos para que la tabla no crezca sin límite. Diaria (vercel.json).
 *
 * `public_verify_throttle` (anti-enumeración de /verificar, migr 0169) guarda la
 * IP en claro y solo se cuenta dentro de una ventana de 30 min: se purga aparte,
 * con una retención propia y más corta (SDD-0455).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` — mismo patrón que
 * push-drain / ceo-brief. El secret SOLO por header (nunca query-param: terminan
 * en logs/referrers). Idempotente: si no hay filas viejas, borra 0 y devuelve ok.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Retención: las ventanas de throttle son ≤ 60 min; 48 h es margen de sobra. */
const RETENTION_HOURS = 48;

/**
 * Retención de `public_verify_throttle` (SDD-0455): el doble de la ventana de
 * 30 min que cuentan `lib/public/verify-throttle.ts` y la RPC 0426. Pasada la
 * ventana, la IP ya no sirve para nada; el margen cubre el desfase de reloj entre
 * Vercel, que calcula el corte, y Postgres, que fecha la fila. El test exige que
 * no baje de 2 × VERIFY_WINDOW_MINUTES.
 */
const PUBLIC_VERIFY_RETENTION_MINUTES = 60;

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const cutoff = new Date(
    now - RETENTION_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const verifyCutoff = new Date(
    now - PUBLIC_VERIFY_RETENTION_MINUTES * 60 * 1000,
  ).toISOString();

  // .lt(...) es un filtro obligatorio: PostgREST rechaza un DELETE sin filtro.
  const { error, count } = await admin
    .from("portal_registro_throttle")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) {
    return apiError("No se pudo purgar el throttle.", error, 500, "purge-throttle");
  }

  const { error: pinError, count: pinCount } = await admin
    .from("operario_pin_attempts")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (pinError) {
    return apiError("No se pudo purgar el throttle de PIN.", pinError, 500, "purge-pin-throttle");
  }

  // Va al final: si falla, las dos purgas anteriores ya quedaron hechas.
  const { error: verifyError, count: verifyCount } = await admin
    .from("public_verify_throttle")
    .delete({ count: "exact" })
    .lt("created_at", verifyCutoff);
  if (verifyError) {
    return apiError(
      "No se pudo purgar el throttle de verificación.",
      verifyError,
      500,
      "purge-verify-throttle",
    );
  }

  return NextResponse.json({
    ok: true,
    deleted: (count ?? 0) + (pinCount ?? 0) + (verifyCount ?? 0),
    deletedByTable: {
      portal_registro_throttle: count ?? 0,
      operario_pin_attempts: pinCount ?? 0,
      public_verify_throttle: verifyCount ?? 0,
    },
    cutoff,
    cutoffByTable: {
      portal_registro_throttle: cutoff,
      operario_pin_attempts: cutoff,
      public_verify_throttle: verifyCutoff,
    },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

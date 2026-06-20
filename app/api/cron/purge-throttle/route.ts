/**
 * /api/cron/purge-throttle — purga las filas viejas de portal_registro_throttle.
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
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
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
    return apiError("No se pudo purgar el throttle.", error, 500, "purge-throttle");
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0, cutoff });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

/**
 * /api/cron/searates-refresh — refresca la caché de fletes marítimos (SDD-0094).
 *
 * Recorre la matriz de rutas principales (CN→VE), consulta cada tarifa a SeaRates
 * y hace UPSERT en `ocean_rates`. Pensado para correr SEMANAL (vercel.json). Es la
 * ÚNICA superficie que gasta cuota de SeaRates (el sitio público lee de la caché,
 * 0 llamadas por visita). La matriz está dimensionada para caber en 100/mes.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (Vercel Cron + curl). Solo
 * por header. Idempotente: el upsert pisa la fila por ruta, una 2ª pasada no duplica.
 * Espejo de /api/cron/workflow-drain.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { getOceanRate } from "@/lib/studio/searates/searates-api";
import { refreshOceanRates } from "@/lib/studio/searates/ocean-rates-queries";

export const dynamic = "force-dynamic";
// La matriz (≈12 rutas) corre secuencial; cada consulta a SeaRates es ~1-2s.
export const maxDuration = 60;

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
  const summary = await refreshOceanRates(admin, { fetchRate: getOceanRate });
  // `summary` ya tiene un campo `ok` (conteo de tarifas ok) → lo anidamos para no
  // chocar con el flag de éxito del endpoint.
  return NextResponse.json({ ok: true, summary });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

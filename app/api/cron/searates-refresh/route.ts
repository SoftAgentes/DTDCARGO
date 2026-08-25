/**
 * /api/cron/searates-refresh — refresca la caché de fletes marítimos (SDD-0095).
 *
 * Recorre la matriz de rutas principales (CN→VE), consulta cada tarifa a SeaRates
 * y hace UPSERT en `ocean_rates`. Pensado para correr SEMANAL (vercel.json). Es la
 * ÚNICA superficie que gasta cuota de SeaRates (el sitio público lee de la caché,
 * 0 llamadas por visita). La matriz está dimensionada para caber en 100/mes.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (Vercel Cron + curl). Solo
 * por header. Idempotente: el upsert pisa la fila por ruta, una 2ª pasada no duplica.
 * Espejo de /api/cron/workflow-drain.
 *
 * ⚠️ **SDD-0291 · el aviso.** Hasta el 24-ago-2026 este handler devolvía el
 * `summary` en el JSON de la respuesta y ahí moría. Ese día las 20 rutas volvieron
 * en `error` (SeaRates revocó el acceso: 403 ACCESS_DENIED) y **nadie se enteró**:
 * `/fcl` dejó de dar precio en silencio. Ahora la corrida se clasifica y, si no
 * está sana, se avisa por Telegram + correo a los admins de cada tenant — el mismo
 * patrón de `/api/cron/mail-health`.
 *
 * `?dry=1` corre el refresco y clasifica, pero NO manda el aviso (para probar).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { getOceanRate } from "@/lib/studio/searates/searates-api";
import { refreshOceanRates } from "@/lib/studio/searates/ocean-rates-queries";
import {
  classifyRefreshHealth,
  buildOceanRatesAlert,
} from "@/lib/studio/searates/ocean-rates-alert";
import { notifyOceanRatesHealth } from "@/lib/studio/searates/ocean-rates-notify";

export const dynamic = "force-dynamic";
// La matriz (20 rutas, tope duro 20/corrida = WEEKLY_CALL_CAP) corre secuencial;
// cada consulta a SeaRates es ~1-2s. 20/semana × ≤5 lunes = ≤100/mes (plan gratis).
// El aviso sólo se arma cuando algo falló, y una ruta que falla vuelve RÁPIDO
// (403/401 no esperan al proveedor), así que no compite por este presupuesto.
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

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

  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const admin = createAdminClient();
  const summary = await refreshOceanRates(admin, { fetchRate: getOceanRate });

  const health = classifyRefreshHealth(summary);
  const alert = buildOceanRatesAlert(summary, health, SITE_URL);

  // `ocean_rates` es data de referencia GLOBAL (sin tenant_id), pero el aviso va a
  // PERSONAS → hay que recorrer tenants, como hacen todos los crons globales del
  // repo (mail-health, rate-expiry-alert, ceo-brief).
  const notified: Array<{
    tenant_id: string;
    emailSent: number;
    telegramAttempted: number;
  }> = [];

  if (alert && !dry) {
    const { data: tenants, error } = await admin.from("tenants").select("id");
    if (error) {
      console.error("[searates-refresh] listar tenants:", error.message);
    }
    for (const t of (tenants ?? []) as Array<{ id: string }>) {
      const sent = await notifyOceanRatesHealth(admin, t.id, alert);
      notified.push({ tenant_id: t.id, ...sent });
    }
  }

  // `summary` ya tiene un campo `ok` (conteo de tarifas ok) → lo anidamos para no
  // chocar con el flag de éxito del endpoint.
  const result = { ok: true, health, dry, summary, notified };
  console.log("[searates-refresh]", JSON.stringify({ health, ...summary }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

/**
 * POST /api/public/calc-event
 *
 * SDD-0259 · registra un evento ANÓNIMO de la calculadora pública.
 *
 * ⚠️ NO es un lead y NO avisa a nadie. No manda correo, no manda Telegram, no
 * crea un `EST-`. Es telemetría: sirve para calibrar con datos propios lo que
 * hoy no se puede — empezando por los presets de peso que SDD-0257 descartó
 * por falta de mediciones (~41 en toda la base, contradiciéndose 45×).
 *
 * Qué guarda: CBM, peso declarado (nullable — que falte ES el dato), modalidad,
 * destino, banderas y el resultado. **Nada personal**: sin nombre, teléfono,
 * correo, cookie ni sesión. La lista blanca la aplica `buildCalcEventRow`.
 *
 * La IP se usa **en tránsito** para el tope anti-abuso y queda en el bucket
 * compartido `portal_registro_throttle` (namespace `calc:`), igual que
 * /api/public/estimacion — nunca en la tabla de eventos.
 *
 * Falla en silencio a propósito: el visitante está tocando "Enviar por
 * WhatsApp" y esta llamada es un pasajero del viaje. Si algo se cae, devuelve
 * 204 igual y el cliente sigue a wa.me sin enterarse. La telemetría NUNCA
 * puede costar una conversión.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { readJsonBody } from "@/lib/http/read-json-body";
import { resolveRequestIp } from "@/lib/http/request-ip";
import { buildCalcEventRow, type CalcEventPayload } from "@/lib/public/calc-event";

export const runtime = "nodejs";

// Anti-abuso por IP, mismo mecanismo y misma tabla que /api/public/estimacion,
// con namespace propio para no pisar ese bucket ni el del registro.
// El tope es más alto que el de estimados (12/hora) porque acá un visitante
// legítimo puede tocar el CTA varias veces mientras tantea números.
const RL_TABLE = "portal_registro_throttle";
const RL_IP_PREFIX = "calc:";
const RL_LIMIT = 60;
const RL_WINDOW_MINUTES = 60;

/** Siempre 204. El navegador no espera cuerpo y no debe cambiar de conducta. */
const noContent = () => new NextResponse(null, { status: 204 });

/**
 * El tenant operativo, memorizado en el módulo.
 *
 * Es una constante en la práctica —hoy DTD tiene uno solo— y sin esto cada
 * evento pagaba un viaje extra a la base sólo para volver a leer el mismo uuid.
 * Medido en local contra la Supabase de producción, la ruta hacía 4 viajes por
 * evento; éste sobraba. En un lambda caliente el valor se reusa; en uno frío se
 * vuelve a leer, que es exactamente el comportamiento que queremos.
 */
let tenantIdCache: string | null = null;

export async function POST(req: NextRequest) {
  const parsed = await readJsonBody<CalcEventPayload>(req);
  if (!parsed.ok) return noContent();

  // Lista blanca + validación (pura). Un payload envenenado con `email` o
  // `phone` no sobrevive a esto: la fila se copia campo por campo.
  const built = buildCalcEventRow(parsed.body ?? {});
  if (!built.ok) return noContent();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // Sin service_role no hay telemetría, pero tampoco hay drama: el visitante
    // no se entera y sigue su camino.
    return noContent();
  }

  // Throttle. Fail-OPEN ante error de lectura, igual que en estimacion: un
  // fallo del propio anti-abuso no debe borrar mediciones legítimas.
  const ip = RL_IP_PREFIX + resolveRequestIp(req.headers);
  const windowStart = new Date(
    Date.now() - RL_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error: rlErr } = await admin
    .from(RL_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if (!rlErr && (count ?? 0) >= RL_LIMIT) return noContent();
  await admin.from(RL_TABLE).insert({ ip });

  // Tenant operativo (hoy uno solo) — mismo patrón que estimacion, pero
  // memorizado: ver `tenantIdCache`.
  if (!tenantIdCache) {
    const { data: tenantRow } = await admin
      .from("tenants")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!tenantRow?.id) return noContent();
    tenantIdCache = tenantRow.id;
  }

  await admin
    .from("public_calc_events")
    .insert({ ...built.row, tenant_id: tenantIdCache });

  return noContent();
}

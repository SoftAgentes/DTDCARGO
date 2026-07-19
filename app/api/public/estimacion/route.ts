/**
 * SDD-0061 Fase B1 — Endpoint público del estimado web · aviso al equipo.
 *
 * POST /api/public/estimacion
 *   body: EstimadoWebPayload (datos de la calc + nota + nombre + teléfono)
 *   → avisa al equipo del lead (email info@ + admins + Telegram, best-effort) y
 *     devuelve { ok }. Ya NO crea un EST- en el ERP (decisión founder 2026-07: el
 *     visitante no registrado no genera registros en el ERP; su cotización viaja
 *     por el WhatsApp que la calculadora abre sola). El estimado formal lo crea el
 *     asesor en el Cotizador si el lead progresa.
 *
 * Es un puente público→ERP acotado a NOTIFICAR (no persiste): las calculadoras NO
 * importan Supabase; le pegan por HTTP a este handler (mismo origen), que corre
 * con admin client (service_role) solo para leer el tenant y mandar los avisos —
 * ver lib/studio/estimado-lead-notify.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-json-body";
import { resolveRequestIp } from "@/lib/http/request-ip";
import {
  validateEstimadoInput,
  type EstimadoWebPayload,
} from "@/lib/public/estimado-web";
import { notifyEstimadoLeadToAdmin } from "@/lib/studio/estimado-lead-notify";

export const runtime = "nodejs";

// Anti-abuso: throttle por IP reutilizando la tabla portal_registro_throttle
// (id · ip · created_at). Namespace propio via prefijo "est:" en la columna ip →
// NO se mezcla con el bucket del registro self-service (que guarda la IP cruda).
// Sin esto, un script podía hacer POST en loop y llenar `quotes` de estimados
// basura (el insert corre con service_role, bypassa RLS). Tuneables.
const RL_TABLE = "portal_registro_throttle";
const RL_IP_PREFIX = "est:";
const RL_LIMIT = 12; // estimados por IP por ventana
const RL_WINDOW_MINUTES = 60;

export async function POST(req: NextRequest) {
  const parsed = await readJsonBody<Partial<EstimadoWebPayload>>(req);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error:
          parsed.status === 413
            ? "La solicitud es demasiado grande."
            : "Cuerpo de la solicitud inválido.",
      },
      { status: parsed.status },
    );
  }
  const payload = parsed.body;

  // 1. Validar + normalizar (lógica pura).
  const { input, fieldErrors } = validateEstimadoInput(payload);
  if (fieldErrors) {
    return NextResponse.json({ error: "Datos incompletos.", fieldErrors }, { status: 400 });
  }

  // 2. Admin client (service_role). Si la env var falta, no rompemos el flujo del
  //    visitante con un 500 críptico: devolvemos un error claro y el form igual
  //    abre WhatsApp (fallback del lado del cliente).
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return apiError(
      "El registro del estimado no está disponible ahora.",
      err,
      503,
      "estimacion",
    );
  }

  // 2b. Throttle por IP — DESPUÉS de validar input + crear el admin, ANTES de
  //     mandar los avisos (email/Telegram también son abusables). Contamos los
  //     intentos recientes de esta IP; si superó el límite, devolvemos 429 sin
  //     avisar. Fail-OPEN ante un error de lectura del throttle: no bloqueamos un
  //     lead legítimo por un fallo de infraestructura del propio anti-abuso.
  const ip = RL_IP_PREFIX + resolveRequestIp(req.headers);
  const windowStart = new Date(
    Date.now() - RL_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count: recentCount, error: rlErr } = await admin
    .from(RL_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if (!rlErr && (recentCount ?? 0) >= RL_LIMIT) {
    return NextResponse.json(
      {
        error:
          "Demasiados estimados desde tu conexión. Intenta de nuevo en un rato.",
      },
      { status: 429 },
    );
  }
  // Registrar el intento (best-effort: si falla el insert, el flujo sigue).
  await admin.from(RL_TABLE).insert({ ip });

  // 3. Resolver el tenant operativo de DTD (hoy uno solo; mismo patrón que el
  //    registro self-service del portal: primer tenant por created_at).
  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (tenantErr || !tenantRow?.id) {
    return apiError(
      "No pudimos registrar tu estimado.",
      tenantErr ?? new Error("no tenant"),
      500,
      "estimacion",
    );
  }
  const tenantId = tenantRow.id;

  // 4. Aviso al equipo (email info@ + admins + Telegram) — best-effort. El
  //    visitante NO registrado ya no genera un EST- en el ERP (decisión founder):
  //    su cotización viaja por el WhatsApp que la calculadora abre sola. Este
  //    aviso evita que el lead se pierda si el cliente no llega a escribir — el
  //    asesor se entera y puede escribirle él. Un fallo del aviso NO rompe la
  //    respuesta al visitante.
  try {
    const team = await notifyEstimadoLeadToAdmin(admin, tenantId, {
      prospectName: input.prospectName,
      prospectWhatsapp: input.prospectWhatsapp,
      prospectEmail: input.prospectEmail,
      nota: input.nota,
      calc: input.calc,
      origin: input.origin,
      destination: input.destination,
      cbm: input.cbm,
      weightKg: input.weightKg,
      totalUsd: input.totalUsd,
    });
    if (!team.ok) console.warn("[estimacion] aviso al equipo: ningún email salió");
  } catch (err) {
    console.warn("[estimacion] aviso al equipo falló:", err);
  }

  return NextResponse.json({ ok: true });
}

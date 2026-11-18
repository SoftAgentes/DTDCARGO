/**
 * CEO Daily Brief · Sprint C del plan v2.
 *
 * Cada mañana a las 7am Caracas (cron Vercel), levanta KPIs operativos
 * del día anterior, los pasa por claude-sonnet-4-6 (mismo modelo que
 * marketing/noticias-web usa), y manda un resumen de 4 líneas al admin
 * del tenant via Telegram (bot ya operativo).
 *
 * Decisión negocio: cero dashboard nuevo en Studio. El founder ya tiene
 * /studio/debug + Studio web — si quiere drill-down, abre la app. El
 * brief diario es "ping de pulso" no replacement del dashboard.
 *
 * Si el founder pide V2 con vista persistente, reusar `news_posts` con
 * tipo nuevo 'ceo-brief' (filtrado por RLS admin) sin migración nueva.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";
import { dispatchTelegramAlert } from "@/lib/studio/telegram/alert-routing";
import { sendDiscordCategoryAlert } from "@/lib/studio/alerts/dispatch-alert";
import type { MinimalAlert } from "@/lib/studio/discord/minimal-alert";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com").replace(/\/+$/, "");

/**
 * El reporte diario para Discord (SDD-0606): conteos del día y el enlace al
 * Studio. SIN montos —los gastos van como cantidad de registros, no como
 * total— y sin el texto redactado por el modelo, que sí trae cifras de dinero.
 */
export function buildDiscordBrief(kpis?: CeoBriefKpis): MinimalAlert {
  const base: MinimalAlert = {
    titulo: "Reporte diario de operaciones",
    url: `${SITE_URL}/studio`,
  };
  if (!kpis) return base;
  return {
    ...base,
    codigo: kpis.date_iso,
    conteos: [
      { etiqueta: "Recepciones en China", valor: kpis.receipts_cn_count },
      { etiqueta: "Recepciones con incidencia", valor: kpis.receipts_cn_incidents },
      { etiqueta: "Despachos listos", valor: kpis.od_lista },
      { etiqueta: "Despachos en ruta", valor: kpis.od_en_ruta },
      { etiqueta: "Despachos entregados", valor: kpis.od_entregada },
      { etiqueta: "Gastos cargados", valor: kpis.expenses_count },
      { etiqueta: "Incidencias sin resolver", valor: kpis.incidents_open },
    ],
  };
}

const MODEL = "claude-sonnet-4-6";

/**
 * KPIs del día anterior para 1 tenant. Todo aggregate, no rows.
 * Solo lo que cabría en 4-5 líneas de resumen ejecutivo.
 */
export interface CeoBriefKpis {
  tenant_id: string;
  date_iso: string; // YYYY-MM-DD del día reportado (ayer)
  // Almacén CN
  receipts_cn_count: number;
  receipts_cn_cbm: number;
  receipts_cn_incidents: number;
  // Despachos VE
  od_creada: number;
  od_cargando: number;
  od_lista: number;
  od_en_ruta: number;
  od_entregada: number;
  od_cancelada: number;
  // Gastos
  expenses_total_usd: number;
  expenses_count: number;
  // Incidencias warehouse no resueltas (acumulado, no solo del día)
  incidents_open: number;
}

/**
 * Query agregado de KPIs del día anterior. RANGE: created_at >= ayer 00:00
 * y < hoy 00:00 (timezone America/Caracas).
 *
 * Llamado con admin client (service_role) porque el cron no tiene auth.
 */
export async function fetchCeoBriefKpis(
  supabase: SupabaseClient,
  tenantId: string,
  // ISO date "YYYY-MM-DD" del día a reportar (default: ayer).
  dateIso?: string,
): Promise<CeoBriefKpis> {
  // Fecha del día reportado (ayer en Caracas timezone).
  const dateReport = dateIso ?? computeYesterdayCaracas();
  const startIso = `${dateReport}T00:00:00-04:00`;
  // No-OK end-of-day exclusive: 24h después.
  const endIso = `${dateReport}T23:59:59.999-04:00`;

  // Las 5 queries en paralelo (todas filtran por tenant_id).
  const [
    receiptsRes,
    odBreakdownRes,
    expensesRes,
    incidentsOpenRes,
  ] = await Promise.all([
    // Recepciones CN del día
    supabase
      .from("warehouse_receipts_cn")
      .select("id, total_cbm, status", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .gte("created_at", startIso)
      .lte("created_at", endIso),

    // ODs por status (snapshot actual · no del día específico)
    supabase
      .from("dispatch_orders")
      .select("status")
      .eq("tenant_id", tenantId),

    // Gastos del día
    supabase
      .from("expenses")
      .select("amount_usd", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .gte("created_at", startIso)
      .lte("created_at", endIso),

    // Incidencias warehouse abiertas (acumulado · no resueltas todavía)
    supabase
      .from("warehouse_receipt_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("event_type", "incident")
      .is("deleted_at", null),
  ]);

  // Aggregate receipts
  const receipts = (receiptsRes.data ?? []) as {
    total_cbm: string | number | null;
    status: string;
  }[];
  const receiptsCount = receiptsRes.count ?? receipts.length;
  const receiptsCbm = receipts.reduce(
    (s, r) => s + (r.total_cbm ? Number(r.total_cbm) : 0),
    0,
  );
  const receiptsIncidents = receipts.filter(
    (r) => r.status === "incidencia",
  ).length;

  // Aggregate ODs by status
  const odRows = (odBreakdownRes.data ?? []) as { status: string }[];
  const odBreakdown: Record<string, number> = {};
  for (const row of odRows) odBreakdown[row.status] = (odBreakdown[row.status] ?? 0) + 1;

  // SDD-0572: sumar `amount_usd`, que cada gasto guarda con su tasa (antes se
  // convertía con 36,5 y 7,18 fijos).
  const expenses = (expensesRes.data ?? []) as { amount_usd: number | string | null }[];
  const expensesCount = expensesRes.count ?? expenses.length;
  const expensesUsd = expenses.reduce((s, e) => s + (Number(e.amount_usd) || 0), 0);

  return {
    tenant_id: tenantId,
    date_iso: dateReport,
    receipts_cn_count: receiptsCount,
    receipts_cn_cbm: Math.round(receiptsCbm * 100) / 100,
    receipts_cn_incidents: receiptsIncidents,
    od_creada: odBreakdown.creada ?? 0,
    od_cargando: odBreakdown.cargando ?? 0,
    od_lista: odBreakdown.lista ?? 0,
    od_en_ruta: odBreakdown.en_ruta ?? 0,
    od_entregada: odBreakdown.entregada ?? 0,
    od_cancelada: odBreakdown.cancelada ?? 0,
    expenses_total_usd: Math.round(expensesUsd * 100) / 100,
    expenses_count: expensesCount,
    incidents_open: incidentsOpenRes.count ?? 0,
  };
}

/**
 * Llama claude-sonnet-4-6 con los KPIs y devuelve un resumen ejecutivo
 * de 3-5 líneas en español VE. Tono directo, sin felicitaciones.
 */
export async function generateBriefText(
  kpis: CeoBriefKpis,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback sin LLM · resumen mecánico
    return buildFallbackBrief(kpis);
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildBriefPrompt(kpis);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content.find((b) => b.type === "text") as
      | TextBlock
      | undefined;
    const text = block?.text?.trim();
    if (!text) return buildFallbackBrief(kpis);
    return text;
  } catch (err) {
    console.error("[ceo-brief] LLM error:", err);
    return buildFallbackBrief(kpis);
  }
}

function buildBriefPrompt(kpis: CeoBriefKpis): string {
  return `Eres un analista ejecutivo. Genera un brief de 3-5 líneas para el CEO de DTD·CARGO sobre operación del día ${kpis.date_iso}.

Tono: directo, español venezolano (tú / acá, cero voseo), sin felicitaciones, sin metáforas.
Formato: bullets cortos con cifras concretas. Cero emojis decorativos.
Foco: lo que el CEO necesita saber para decidir hoy.

KPIs del día ${kpis.date_iso}:
- Almacén CN: ${kpis.receipts_cn_count} recepciones (${kpis.receipts_cn_cbm} CBM total) · ${kpis.receipts_cn_incidents} con incidencia
- Despacho VE (snapshot ahora): ${kpis.od_creada} creadas · ${kpis.od_cargando} cargando · ${kpis.od_lista} listas · ${kpis.od_en_ruta} en ruta · ${kpis.od_entregada} entregadas hoy
- Gastos del día: $${kpis.expenses_total_usd.toFixed(0)} USD (${kpis.expenses_count} cargados)
- Incidencias warehouse acumuladas no resueltas: ${kpis.incidents_open}

Genera el brief ahora. Sin preámbulo. Empieza directo con el primer bullet.`;
}

function buildFallbackBrief(kpis: CeoBriefKpis): string {
  const lines: string[] = [];
  lines.push(`Brief operativo · ${kpis.date_iso}`);
  lines.push(
    `• CN: ${kpis.receipts_cn_count} recepciones (${kpis.receipts_cn_cbm} CBM)${
      kpis.receipts_cn_incidents > 0
        ? ` · ${kpis.receipts_cn_incidents} con incidencia`
        : ""
    }`,
  );
  lines.push(
    `• Despacho: ${kpis.od_lista} listas · ${kpis.od_en_ruta} en ruta · ${kpis.od_entregada} entregadas`,
  );
  if (kpis.expenses_count > 0) {
    lines.push(
      `• Gastos: $${kpis.expenses_total_usd.toFixed(0)} (${kpis.expenses_count} cargados)`,
    );
  }
  if (kpis.incidents_open > 0) {
    lines.push(`• Atención: ${kpis.incidents_open} incidencias sin resolver`);
  }
  return lines.join("\n");
}

/**
 * Manda el brief a los destinos de la categoría `reportes` (SDD-0271).
 *
 * El founder pidió que el brief diario —las operaciones del día y los
 * movimientos— llegue a DOS teléfonos, y eso es justo lo que la V1 no podía
 * hacer: mandaba a UN admin, el primero con `telegram_chat_id`. Ahora sale a
 * todos los destinos ruteados a `reportes`, una vez por chat.
 *
 * Sin rutas configuradas cae a la V1 (primer admin con chat): un tenant sin
 * configurar sigue recibiendo su brief.
 */
export async function sendCeoBriefToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  brief: string,
  kpis?: CeoBriefKpis,
): Promise<{ ok: boolean; sentTo?: string; error?: string }> {
  // SDD-0606 · Discord primero. Si entrega, el texto con montos no sale por
  // ningún lado: a Discord van sólo los conteos.
  const enDiscord = await sendDiscordCategoryAlert(
    supabase,
    tenantId,
    "reportes",
    buildDiscordBrief(kpis),
    { logTag: "ceo-brief" },
  );
  if (enDiscord.handled) {
    return {
      ok: true,
      sentTo: enDiscord.outcome === "en-cola" ? "discord (en cola)" : "discord",
    };
  }

  const routed = await dispatchTelegramAlert(
    supabase,
    tenantId,
    "reportes",
    brief,
    { fallback: "none", logTag: "ceo-brief" },
  );
  if (routed.chatIds.length > 0) {
    if (routed.sent === 0) {
      return { ok: false, error: `Telegram: 0/${routed.chatIds.length} entregados` };
    }
    return { ok: true, sentTo: routed.chatIds.join(", ") };
  }

  // Sin rutas → V1: el primer admin con telegram_chat_id configurado.
  const { data: adminLink, error: linkErr } = await supabase
    .from("user_tenants")
    .select("user_id, user_profiles!inner(telegram_chat_id, first_name)")
    .eq("tenant_id", tenantId)
    .eq("role", "admin")
    .is("disabled_at", null)
    .not("user_profiles.telegram_chat_id", "is", null)
    .limit(1)
    .maybeSingle<{
      user_id: string;
      user_profiles: { telegram_chat_id: string | null; first_name: string | null };
    }>();

  if (linkErr) {
    return { ok: false, error: `Lookup admin: ${linkErr.message}` };
  }
  if (!adminLink) {
    return {
      ok: false,
      error: "No hay admin con telegram_chat_id configurado en este tenant",
    };
  }

  const chatId = adminLink.user_profiles.telegram_chat_id;
  if (!chatId) {
    return { ok: false, error: "Admin sin telegram_chat_id" };
  }

  const result = await sendTelegramMessage(chatId, brief);
  if (!result.ok) {
    return { ok: false, error: `Telegram: ${result.error}` };
  }

  return { ok: true, sentTo: chatId };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function computeYesterdayCaracas(): string {
  // Caracas timezone UTC-4. "Ayer" = la fecha en VE hace 24h.
  const now = new Date();
  const caracasOffsetMs = -4 * 60 * 60 * 1000;
  const localCaracas = new Date(now.getTime() + caracasOffsetMs);
  localCaracas.setUTCDate(localCaracas.getUTCDate() - 1);
  return localCaracas.toISOString().slice(0, 10);
}

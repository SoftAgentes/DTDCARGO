/**
 * Drain de la agenda de avisos al cliente (SDD-0156 · Slice A + C).
 *
 * Toma las filas `scheduled` vencidas (`scheduled_for <= now`) y las despacha por
 * canal, reusando la infra existente:
 *   - email → `sendEmail` (Resend; ya durable en mail_logs).
 *   - push  → `enqueueUserPush` → outbox_push_events → push-drain (durable).
 *
 * Claim atómico anti doble-envío: cada fila se toma con un UPDATE condicional
 * (status 'scheduled'→'sent'); un 2º worker no matchea y la salta. Si el
 * despacho falla, se revierte a 'scheduled' + bump attempts; sin destino →
 * 'skipped'; al tope de intentos → 'failed'.
 *
 * Lo disparan: el cron `/api/cron/client-notifications-drain` (backstop) y el
 * drain inline tras programar. Best-effort · nunca throwea.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { escapeHtml } from "@/lib/studio/new-client-notify";
import {
  enqueueUserPush,
  drainOperarioPushOutbox,
} from "@/lib/studio/notify/operario-push-outbox";
import type { ClientNotificationScheduleRow } from "./client-notification-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
const MAX_ATTEMPTS = 5;
const MAX_BATCH = 50;

type DispatchOutcome = "sent" | "no_destination" | "transient_fail";

export interface DrainResult {
  processed: number;
  delivered: number;
  skipped: number;
  failed: number;
}

export async function drainClientNotifications(
  admin: SupabaseClient,
): Promise<DrainResult> {
  const nowIso = new Date().toISOString();

  const { data: rowsRaw, error } = await admin
    .from("client_notification_schedule")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_for", { ascending: true })
    .limit(MAX_BATCH);

  if (error || !rowsRaw || rowsRaw.length === 0) {
    return { processed: 0, delivered: 0, skipped: 0, failed: 0 };
  }

  const rows = rowsRaw as ClientNotificationScheduleRow[];
  let delivered = 0;
  let skipped = 0;
  let failed = 0;
  let enqueuedPush = false;

  for (const row of rows) {
    // ── Claim atómico: 'scheduled' → 'sent'. Si otro worker ya lo tomó, el
    //    UPDATE matchea 0 filas y lo saltamos. Revertimos si el envío falla.
    const { data: claimed } = await admin
      .from("client_notification_schedule")
      .update({ status: "sent", sent_at: nowIso })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // otro dispatcher lo tomó

    const outcome = await dispatchRow(admin, row);
    if (outcome.result === "push_enqueued") enqueuedPush = true;

    if (outcome.result === "sent" || outcome.result === "push_enqueued") {
      delivered += 1;
      continue; // ya quedó 'sent'
    }

    if (outcome.result === "no_destination") {
      await admin
        .from("client_notification_schedule")
        .update({ status: "skipped", sent_at: null, error: outcome.error ?? null })
        .eq("id", row.id);
      skipped += 1;
      continue;
    }

    // transient_fail → revertir a scheduled + bump attempts (o failed al tope).
    const nextAttempts = row.attempts + 1;
    const capped = nextAttempts >= MAX_ATTEMPTS;
    await admin
      .from("client_notification_schedule")
      .update({
        status: capped ? "failed" : "scheduled",
        sent_at: null,
        attempts: nextAttempts,
        error: outcome.error ?? "fallo transitorio",
      })
      .eq("id", row.id);
    failed += 1;
  }

  // Empuja los push recién encolados sin esperar al cron del minuto.
  if (enqueuedPush) {
    void drainOperarioPushOutbox(admin).catch((err) => {
      console.error("[client-notif-drain] push drain inline falló:", err);
    });
  }

  return { processed: rows.length, delivered, skipped, failed };
}

interface RowDispatch {
  result: "sent" | "push_enqueued" | "no_destination" | "transient_fail";
  error?: string;
}

/**
 * Despacha una fila por su(s) canal(es). Un canal entregado alcanza para 'sent'.
 * Si NINGÚN canal tiene destino → no_destination. Si algún canal falló transitorio
 * y ninguno entregó → transient_fail.
 */
async function dispatchRow(
  admin: SupabaseClient,
  row: ClientNotificationScheduleRow,
): Promise<RowDispatch> {
  const wantEmail = row.channel === "email" || row.channel === "both";
  const wantPush = row.channel === "push" || row.channel === "both";

  const title = strFromPayload(row.payload, "title") ?? "Actualización de tu envío";
  const body = strFromPayload(row.payload, "body") ?? "Tu envío tuvo una actualización.";
  const clientName = strFromPayload(row.payload, "clientName") ?? "cliente";

  let anyDestination = false;
  let anySent = false;
  let anyEnqueued = false;
  let transient: string | undefined;

  if (wantEmail) {
    const r = await dispatchEmail(admin, row, { title, body, clientName });
    if (r !== "no_destination") anyDestination = true;
    if (r === "sent") anySent = true;
    if (r === "transient_fail") transient = "email falló";
  }

  if (wantPush) {
    const r = await dispatchPush(admin, row, { title, body });
    if (r !== "no_destination") anyDestination = true;
    if (r === "sent") anyEnqueued = true; // encolado en outbox durable
    if (r === "transient_fail") transient = "push falló";
  }

  if (anySent) return { result: "sent" };
  if (anyEnqueued) return { result: "push_enqueued" };
  if (!anyDestination) return { result: "no_destination", error: "cliente sin canal disponible" };
  return { result: "transient_fail", error: transient };
}

async function dispatchEmail(
  admin: SupabaseClient,
  row: ClientNotificationScheduleRow,
  copy: { title: string; body: string; clientName: string },
): Promise<DispatchOutcome> {
  const { data: client } = await admin
    .from("clients")
    .select("email, name")
    .eq("tenant_id", row.tenant_id)
    .eq("markbox", row.client_markbox)
    .is("deleted_at", null)
    .maybeSingle<{ email: string | null; name: string | null }>();

  const email = (client?.email ?? "").trim();
  if (!email) return "no_destination";

  const name = copy.clientName || client?.name || "cliente";
  const code = strFromPayload(row.payload, "shipmentCode") ?? "";
  const trackUrl = `${SITE_URL}/portal/envios/${encodeURIComponent(code)}`;

  const res = await sendEmail(admin, row.tenant_id, {
    subject: code ? `${copy.title} · ${code}` : copy.title,
    html: buildHtml({ name, title: copy.title, body: copy.body, code, trackUrl }),
    to: email,
    to_name: name,
    metadata: {
      source: "client-notification-drain",
      code,
      event: row.trigger_event,
      schedule_id: row.id,
    },
  });
  // ⚠️ `res.ok` NO alcanza: sendEmail devuelve ok:true con queued:true cuando el
  //    correo quedó REGISTRADO pero no salió (Resend sin key). Darlo por 'sent'
  //    marcaba el aviso como entregado y lo sacaba de la cola para siempre.
  //    Como transitorio, el drain lo reintenta — y cuando la key esté, sale.
  if (res.ok && !res.queued) return "sent";
  return "transient_fail";
}

async function dispatchPush(
  admin: SupabaseClient,
  row: ClientNotificationScheduleRow,
  copy: { title: string; body: string },
): Promise<DispatchOutcome> {
  // markbox → client_id → auth_user_id (portal, SDD-0042).
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("tenant_id", row.tenant_id)
    .eq("markbox", row.client_markbox)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  if (!client) return "no_destination";

  const { data: link } = await admin
    .from("client_users")
    .select("auth_user_id")
    .eq("tenant_id", row.tenant_id)
    .eq("client_id", client.id)
    .eq("status", "active")
    .not("auth_user_id", "is", null)
    .maybeSingle<{ auth_user_id: string | null }>();

  const userId = link?.auth_user_id ?? null;
  if (!userId) return "no_destination";

  const code = strFromPayload(row.payload, "shipmentCode") ?? "";
  const id = await enqueueUserPush(admin, row.tenant_id, userId, {
    title: copy.title,
    body: copy.body,
    url: code ? `/portal/envios/${encodeURIComponent(code)}` : "/portal",
    tag: `client-notif:${row.id}`,
  });
  return id ? "sent" : "transient_fail";
}

function strFromPayload(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const v = payload?.[key];
  return typeof v === "string" ? v : null;
}

function buildHtml(d: {
  name: string;
  title: string;
  body: string;
  code: string;
  trackUrl: string;
}): string {
  const codeRow = d.code
    ? `<table style="border-collapse:collapse;margin:0 0 20px">
<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px">Envío</td>
<td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:700">${escapeHtml(
        d.code,
      )}</td></tr></table>`
    : "";
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:18px;margin:0 0 4px"><b>${escapeHtml(d.title)}</b></p>
<p style="margin:0 0 16px;color:#333;font-size:14px;line-height:1.5">Hola ${escapeHtml(
    d.name,
  )}, ${escapeHtml(d.body)}</p>
${codeRow}
<p style="margin:0 0 12px"><a href="${d.trackUrl}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Ver el seguimiento en tu portal &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · logística puerta a puerta China–Venezuela</p>
</div>`;
}

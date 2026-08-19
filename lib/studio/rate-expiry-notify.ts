/**
 * Notificador de la alerta de vencimiento de tarifas públicas (SDD-0164 ⭐1).
 *
 * Avisa por Telegram + email a founder (`user_tenants.role='admin'`) y
 * comercial (`role='commercial'`) — los mismos roles que ya tienen acceso
 * al módulo `rates` en la matriz RBAC (lib/studio/rbac.ts). Best-effort por
 * destinatario y canal: un fallo en uno no bloquea a los demás ni al
 * caller (el cron marca el dedup igual, sea cual sea el resultado del
 * envío — reintentar mañana si sigue en ventana es aceptable, hay dos
 * canales y dos roles de redundancia).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "./telegram/send-message";
import { sendEmail } from "./mail/send-email";
import type { RateExpiryLevel } from "./rate-types";
import type { RateExpiryCandidate } from "./rate-queries";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

type StaffRecipient = {
  user_id: string;
  email: string | null;
  telegram_chat_id: string | null;
};

async function resolveStaffRecipients(
  admin: SupabaseClient,
  tenantId: string,
  roles: string[],
): Promise<StaffRecipient[]> {
  const { data: links } = await admin
    .from("user_tenants")
    .select("user_id, user_profiles(telegram_chat_id)")
    .eq("tenant_id", tenantId)
    .in("role", roles)
    .is("disabled_at", null);

  const rows = (links ?? []) as Array<{
    user_id: string;
    user_profiles: { telegram_chat_id: string | null }[] | { telegram_chat_id: string | null } | null;
  }>;
  if (rows.length === 0) return [];

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const usersList = users?.users ?? [];

  return rows.map((r) => {
    const profile = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
    return {
      user_id: r.user_id,
      email: usersList.find((u) => u.id === r.user_id)?.email ?? null,
      telegram_chat_id: profile?.telegram_chat_id ?? null,
    };
  });
}

function buildMessage(
  rate: Pick<RateExpiryCandidate, "id" | "service" | "origin" | "destination" | "valid_until">,
  level: RateExpiryLevel,
): { subject: string; text: string; html: string } {
  const isOverdue = level === "overdue";
  const emoji = isOverdue ? "🔴" : "🟡";
  const label = isOverdue ? "YA VENCIDA" : "por vencer";
  const url = `${SITE_URL}/studio/tarifas?highlight=${rate.id}`;
  const risk = isOverdue
    ? "El sitio público ya está sirviendo el precio de respaldo del código en su lugar, en silencio."
    : "Si vence sin renovarse, el sitio público caerá al precio de respaldo del código, en silencio.";

  const subject = `${emoji} Tarifa pública ${label} — ${rate.origin} → ${rate.destination}`;

  const text = [
    `${emoji} Tarifa pública ${label}`,
    `${rate.origin} → ${rate.destination} (${rate.service})`,
    `Vigencia hasta: ${rate.valid_until}`,
    risk,
    url,
  ].join("\n");

  const html = `
    <p><strong>${emoji} Tarifa pública ${label}</strong></p>
    <p>${rate.origin} → ${rate.destination} (${rate.service})</p>
    <p>Vigencia hasta: <strong>${rate.valid_until}</strong></p>
    <p>${risk}</p>
    <p><a href="${url}">Abrir en /studio/tarifas</a></p>
  `;

  return { subject, text, html };
}

/** Avisa por Telegram + email a founder y comercial. Devuelve cuántos envíos OK. */
export async function notifyRateExpiry(
  admin: SupabaseClient,
  tenantId: string,
  rate: Pick<RateExpiryCandidate, "id" | "service" | "origin" | "destination" | "valid_until">,
  level: RateExpiryLevel,
): Promise<{ telegramSent: number; emailSent: number }> {
  const recipients = await resolveStaffRecipients(admin, tenantId, ["admin", "commercial"]);
  const { subject, text, html } = buildMessage(rate, level);

  let telegramSent = 0;
  let emailSent = 0;

  // UNA vez por CHAT, no una por persona (SDD-0271): dos cuentas del staff
  // pueden compartir `telegram_chat_id` —en producción hay dos admins así— y
  // el bucle pelado mandaba el mismo aviso dos veces al mismo hilo. El correo
  // no necesita esto: ahí los destinatarios sí son distintos.
  const chatsAvisados = new Set<string>();

  for (const r of recipients) {
    if (r.telegram_chat_id && !chatsAvisados.has(r.telegram_chat_id)) {
      chatsAvisados.add(r.telegram_chat_id);
      const result = await sendTelegramMessage(r.telegram_chat_id, text);
      if (result.ok) telegramSent++;
    }
    if (r.email) {
      const result = await sendEmail(admin, tenantId, { subject, html, to: r.email });
      if (result.ok) emailSent++;
    }
  }

  return { telegramSent, emailSent };
}

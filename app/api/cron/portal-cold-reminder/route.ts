/**
 * /api/cron/portal-cold-reminder — recordatorio automático a fríos del portal
 * (adopción · 2026-07-11).
 *
 * Reenvía el enlace de acceso (magic-link por correo) a los clientes que tienen
 * invitación pero NUNCA la abrieron (`client_users.status='invited'`), respetando
 * anti-spam: espera unos días antes del 1er recordatorio, deja un cooldown entre
 * recordatorios, y tope de correos automáticos por cliente. Cuenta cada envío en
 * `email_invite_count` (mismos contadores que el tool manual · migr 0226).
 *
 * Los contadores miden ENVÍOS, no RESULTADOS — por eso hay además un filtro contra
 * `mail_logs` que excluye buzones quemados (rebote duro o queja de spam). Sin él, cada
 * dirección muerta recibía MAX_EMAIL_REMINDERS reintentos: con datos importados sucios
 * eso dispara la tasa de rebote y Resend/Gmail castigan el dominio (medido 2026-07-15:
 * 1 de 5 invitaciones rebotó). Si el historial no se puede leer, NO se envía nada.
 *
 * GATE: OFF por default. Solo corre si `PORTAL_COLD_REMINDER=on` (env) — el founder
 * lo enciende cuando quiera. Mismo criterio que otros flips (KOMMO_PUSH_DRY_RUN).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`. Admin client (service_role)
 * porque cruza tenants y sendPortalInviteEmail escribe en mail_logs. NO usa el RPC
 * portal_bump_invite_count (ese resuelve el tenant vía get_user_tenant_id(), NULL sin
 * usuario) — incrementa las columnas directo con el admin.
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createCronRequestContext } from "@/lib/observability/cron-request-context";
import { sendPortalInviteEmail } from "@/lib/studio/portal-invite-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Espera antes del 1er recordatorio (dejar que la invitación original respire). */
const REMIND_AFTER_DAYS = 3;
/** No recordar más seguido que esto. */
const REMIND_COOLDOWN_DAYS = 5;
/** Tope de correos automáticos por cliente (anti-spam · alinea con el umbral del tool). */
const MAX_EMAIL_REMINDERS = 2;
/** Techo por corrida · backstop anti-runaway + rate-limit de Resend. */
const BATCH_CAP = 100;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ColdRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  email: string | null;
  email_invite_count: number;
};

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.portal-cold-reminder");
  if (!cron.authorized) return cron.deny();

  // Gate: apagado por default. El founder lo enciende con PORTAL_COLD_REMINDER=on.
  if (process.env.PORTAL_COLD_REMINDER !== "on") {
    return cron.complete({ ok: true, disabled: true }, { fields: { mode: "disabled" } });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const invitedBefore = new Date(now - REMIND_AFTER_DAYS * 86400_000).toISOString();
  const cooldownBefore = new Date(
    now - REMIND_COOLDOWN_DAYS * 86400_000,
  ).toISOString();

  const { data: dueRows, error: dueErr } = await admin
    .from("client_users")
    .select("id, tenant_id, client_id, email, email_invite_count")
    .eq("status", "invited")
    .lte("invited_at", invitedBefore)
    .lt("email_invite_count", MAX_EMAIL_REMINDERS)
    .or(`last_email_invite_at.is.null,last_email_invite_at.lte.${cooldownBefore}`)
    .limit(BATCH_CAP);

  if (dueErr) {
    return cron.fail(
      "No se pudo leer los fríos del portal.",
      dueErr,
      { event: "cron.read_failed", fields: { stage: "read" } },
    );
  }

  const rows = (dueRows ?? []) as ColdRow[];

  // Buzones quemados: rebote duro o queja de spam. El anti-spam de arriba cuenta
  // ENVÍOS (`email_invite_count`), no RESULTADOS — sin esto el cron reintenta hasta
  // MAX_EMAIL_REMINDERS veces contra una dirección que ya dijo que no existe, y esa
  // tasa de rebote es justo lo que hace que Resend/Gmail bajen la reputación del
  // dominio. Fail-closed: si no podemos leer el historial, no mandamos nada.
  const emails = [
    ...new Set(rows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean)),
  ];
  const burned = new Set<string>();
  if (emails.length > 0) {
    const { data: badRows, error: badErr } = await admin
      .from("mail_logs")
      .select("to_email")
      .in("to_email", emails)
      .or("bounced_at.not.is.null,complained_at.not.is.null");

    if (badErr) {
      return cron.fail(
        "No se pudo leer el historial de rebotes; no se envía nada.",
        badErr,
        { event: "cron.read_failed", fields: { stage: "read" } },
      );
    }
    for (const b of (badRows ?? []) as { to_email: string | null }[]) {
      if (b.to_email) burned.add(b.to_email.trim().toLowerCase());
    }
  }

  // Nombres para el saludo (una query, RLS-bypass por admin).
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  const nameById = new Map<string, string | null>();
  if (clientIds.length > 0) {
    const { data: cli } = await admin
      .from("clients")
      .select("id, name")
      .in("id", clientIds)
      .is("deleted_at", null);
    for (const c of (cli ?? []) as { id: string; name: string | null }[]) {
      nameById.set(String(c.id), c.name);
    }
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let skippedBurned = 0;

  for (const row of rows) {
    const email = (row.email ?? "").trim();
    // Cliente borrado (no vino en nameById) o correo inválido → saltar.
    if (!nameById.has(String(row.client_id)) || !EMAIL_RE.test(email)) {
      skipped += 1;
      continue;
    }

    // Ya rebotó o se quejó → no reintentar nunca.
    if (burned.has(email.toLowerCase())) {
      skippedBurned += 1;
      continue;
    }

    const res = await sendPortalInviteEmail(admin, row.tenant_id, {
      email,
      name: nameById.get(String(row.client_id)) ?? null,
    });

    if (res.ok) {
      await admin
        .from("client_users")
        .update({
          email_invite_count: row.email_invite_count + 1,
          last_email_invite_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      sent += 1;
    } else {
      failed += 1;
    }
  }

  const summary = {
    ok: true,
    processed: rows.length,
    sent,
    failed,
    skipped,
    skippedBurned,
  };
  return cron.complete(summary, {
    fields: { processed: rows.length, sent, failed, skipped, skippedBurned },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

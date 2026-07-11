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
 * GATE: OFF por default. Solo corre si `PORTAL_COLD_REMINDER=on` (env) — el founder
 * lo enciende cuando quiera. Mismo criterio que otros flips (KOMMO_PUSH_DRY_RUN).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`. Admin client (service_role)
 * porque cruza tenants y sendPortalInviteEmail escribe en mail_logs. NO usa el RPC
 * portal_bump_invite_count (ese resuelve el tenant vía get_user_tenant_id(), NULL sin
 * usuario) — incrementa las columnas directo con el admin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
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

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

type ColdRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  email: string | null;
  email_invite_count: number;
};

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  // Gate: apagado por default. El founder lo enciende con PORTAL_COLD_REMINDER=on.
  if (process.env.PORTAL_COLD_REMINDER !== "on") {
    return NextResponse.json({ ok: true, disabled: true });
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
    return apiError(
      "No se pudo leer los fríos del portal.",
      dueErr,
      500,
      "portal-cold-reminder",
    );
  }

  const rows = (dueRows ?? []) as ColdRow[];

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

  for (const row of rows) {
    const email = (row.email ?? "").trim();
    // Cliente borrado (no vino en nameById) o correo inválido → saltar.
    if (!nameById.has(String(row.client_id)) || !EMAIL_RE.test(email)) {
      skipped += 1;
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

  const summary = { ok: true, processed: rows.length, sent, failed, skipped };
  console.log("[portal-cold-reminder]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

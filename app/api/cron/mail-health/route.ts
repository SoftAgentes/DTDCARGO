/**
 * /api/cron/mail-health — vigila los correos que NO llegaron al cliente.
 *
 * Ver `lib/studio/mail/mail-health.ts` para el porqué. Resumen: `sendEmail` es
 * best-effort y devuelve `ok:true` aunque la fila quede en `queued` sin salir;
 * nadie reintenta esa fila ni mira su status. El 2026-08-05 había 8 correos
 * atascados —el más viejo del 29-may— y 3 de ellos eran bienvenidas de clientes
 * que nunca supieron su Shipping Mark.
 *
 * Este cron cierra ese lazo: barre `mail_logs`, clasifica los fallos y avisa a
 * los admins por Telegram + correo. Cada fila se avisa UNA vez
 * (`metadata.health_alerted_at`), así que la primera corrida saca el atraso
 * histórico y a partir de ahí solo habla cuando hay algo nuevo.
 *
 * Schedule: `vercel.json`, `*​/30 * * * *` (cada 30 min). No hace falta más fino:
 * el objetivo es que nadie pase DÍAS sin enterarse, no reaccionar en un minuto.
 *
 * Auth: CRON_SECRET en header `Authorization: Bearer <secret>` — nunca por
 * query-param (los query params terminan en los logs de acceso).
 *
 * Manual (testing · el `days` amplio saca el atraso viejo):
 *   curl -H "Authorization: Bearer <CRON_SECRET>" \
 *     "https://.../api/cron/mail-health?days=400&dry=1"
 *
 * `dry=1` clasifica y responde SIN avisar ni marcar — para ver qué haría antes
 * de soltarlo contra el equipo.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  collectFailures,
  listMailHealthCandidates,
  markMailAlerted,
  STUCK_MINUTES,
} from "@/lib/studio/mail/mail-health";
import { notifyMailHealth } from "@/lib/studio/mail/mail-health-notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Techo de filas por tenant y corrida · backstop anti-runaway. */
const BATCH_CAP = 50;
/** Ventana de barrido por defecto, en días. */
const DEFAULT_LOOKBACK_DAYS = 400;

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

type TenantSummary = {
  tenant_id: string;
  revisados: number;
  nunca_salio: number;
  no_llego: number;
  emailSent: number;
  telegramAttempted: number;
};

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const days = Number(url.searchParams.get("days") ?? DEFAULT_LOOKBACK_DAYS);
  const lookbackDays =
    Number.isFinite(days) && days > 0 ? days : DEFAULT_LOOKBACK_DAYS;

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const sinceIso = new Date(now - lookbackDays * 86_400_000).toISOString();

  const { data: tenants, error: tErr } = await admin.from("tenants").select("id");
  if (tErr) {
    return NextResponse.json(
      { ok: false, error: `Listar tenants: ${tErr.message}` },
      { status: 500 },
    );
  }

  const summaries: TenantSummary[] = [];

  for (const t of (tenants ?? []) as Array<{ id: string }>) {
    const rows = await listMailHealthCandidates(admin, t.id, sinceIso, BATCH_CAP);
    const failures = collectFailures(rows, now, STUCK_MINUTES);

    const summary: TenantSummary = {
      tenant_id: t.id,
      revisados: rows.length,
      nunca_salio: failures.filter((f) => f.kind === "nunca_salio").length,
      no_llego: failures.filter((f) => f.kind === "no_llego").length,
      emailSent: 0,
      telegramAttempted: 0,
    };

    if (failures.length > 0 && !dry) {
      const sent = await notifyMailHealth(admin, t.id, failures);
      summary.emailSent = sent.emailSent;
      summary.telegramAttempted = sent.telegramAttempted;

      // Marcar DESPUÉS de avisar: si el aviso revienta, la próxima corrida lo
      // reintenta. Al revés perderíamos el aviso en silencio — que es
      // exactamente el bug que este cron existe para no repetir.
      for (const f of failures) {
        await markMailAlerted(admin, f.row, nowIso);
      }
    }

    summaries.push(summary);
  }

  const result = { ok: true, dry, lookbackDays, tenants: summaries };
  console.log("[mail-health]", JSON.stringify(result));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

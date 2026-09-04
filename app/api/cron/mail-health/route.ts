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

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  createCronRequestContext,
  type CronRequestContext,
} from "@/lib/observability/cron-request-context";
import {
  buildSupersedeIndex,
  collectFailures,
  listMailHealthCandidates,
  listRecentSuccesses,
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

type TenantSummary = {
  tenant_id: string;
  revisados: number;
  nunca_salio: number;
  no_llego: number;
  emailSent: number;
  telegramAttempted: number;
};

async function run(req: NextRequest, cron: CronRequestContext) {
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
    return cron.fail("No se pudo leer los tenants para mail health.", tErr, {
      event: "cron.read_failed",
      fields: { stage: "read" },
    });
  }

  const summaries: TenantSummary[] = [];

  for (const t of (tenants ?? []) as Array<{ id: string }>) {
    const rows = await listMailHealthCandidates(admin, t.id, sinceIso, BATCH_CAP);
    // Un intento fallido cuyo reintento al mismo destinatario YA salió no es un
    // pendiente: reportarlo entrena al equipo a ignorar el aviso.
    const supersede = buildSupersedeIndex(
      await listRecentSuccesses(admin, t.id, sinceIso, BATCH_CAP * 10),
    );
    const failures = collectFailures(rows, now, STUCK_MINUTES, supersede);

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
  return cron.complete(result, {
    fields: {
      mode: dry ? "dry-run" : "live",
      tenantCount: summaries.length,
      reviewed: summaries.reduce((total, item) => total + item.revisados, 0),
      neverSent: summaries.reduce((total, item) => total + item.nunca_salio, 0),
      notDelivered: summaries.reduce((total, item) => total + item.no_llego, 0),
      mailSent: summaries.reduce((total, item) => total + item.emailSent, 0),
      telegramAttempted: summaries.reduce(
        (total, item) => total + item.telegramAttempted,
        0,
      ),
    },
  });
}

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.mail-health");
  if (!cron.authorized) return cron.deny();
  try {
    return await run(req, cron);
  } catch (error) {
    return cron.fail("No se pudo ejecutar mail health.", error, {
      event: "cron.run_failed",
      fields: { stage: "run" },
    });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

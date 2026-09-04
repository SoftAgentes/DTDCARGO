/**
 * /api/cron/alta-health — clientes con Shipping Mark y sin puerta.
 *
 * Ver `lib/studio/alta-health.ts` para el porqué. Resumen: el insert de
 * `client_users` del registro self-service es best-effort; si falla, el cliente
 * queda "activo" en la UI, con su MARKBOX y su correo de bienvenida en la mano,
 * y sin cuenta con la cual entrar. Pasó con DTD-9017 y estuvo 3 semanas
 * invisible.
 *
 * Schedule: diario (`vercel.json`, `0 12 * * *` = 8am Caracas, UTC-4). No hace
 * falta más fino: es un fallo raro, lo que importa es que no pase semanas oculto.
 *
 * Auth: CRON_SECRET en header `Authorization: Bearer <secret>` — nunca por
 * query-param.
 *
 * Manual (testing):
 *   curl -H "Authorization: Bearer <CRON_SECRET>" "https://.../api/cron/alta-health?dry=1"
 */

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  createCronRequestContext,
  type CronRequestContext,
} from "@/lib/observability/cron-request-context";
import {
  ALTA_LOOKBACK_DAYS,
  buildAltaHealthMessage,
  listAltasSinAcceso,
} from "@/lib/studio/alta-health";
import { resolveAdminEntries } from "@/lib/studio/new-client-notify";
import { dispatchTelegramAlert } from "@/lib/studio/telegram/alert-routing";
import { sendEmail } from "@/lib/studio/mail/send-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_CAP = 100;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

async function run(req: NextRequest, cron: CronRequestContext) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const days = Number(url.searchParams.get("days") ?? ALTA_LOOKBACK_DAYS);
  const lookback = Number.isFinite(days) && days > 0 ? days : ALTA_LOOKBACK_DAYS;

  const admin = createAdminClient();
  const sinceIso = new Date(Date.now() - lookback * 86_400_000).toISOString();

  const { data: tenants, error } = await admin.from("tenants").select("id");
  if (error) {
    return cron.fail("No se pudo leer los tenants para alta health.", error, {
      event: "cron.read_failed",
      fields: { stage: "read" },
    });
  }

  const summaries = [];

  for (const t of (tenants ?? []) as Array<{ id: string }>) {
    const rotos = await listAltasSinAcceso(
      admin,
      t.id,
      sinceIso,
      BATCH_CAP,
      cron.logger,
    );
    const summary = {
      tenant_id: t.id,
      sin_acceso: rotos.length,
      markboxes: rotos.map((r) => r.markbox),
      avisados: 0,
    };

    if (rotos.length > 0 && !dry) {
      const text = buildAltaHealthMessage(rotos, SITE_URL);

      // Telegram primero: es el canal que no depende del correo, y este aviso
      // convive con fallas de correo (ver mail-health). UNA vez por CHAT, fuera
      // del bucle de admins (SDD-0271): adentro, dos cuentas admin con el mismo
      // telegram_chat_id recibían el aviso dos veces.
      await dispatchTelegramAlert(admin, t.id, "equipo", text, {
        logTag: "alta-health",
        logger: cron.logger,
      });

      const admins = await resolveAdminEntries(admin, t.id);
      for (const a of admins) {
        await sendEmail(admin, t.id, {
          subject: `⚠️ ${rotos.length} cliente(s) sin acceso al portal · DTD Cargo`,
          html: `<pre style="font-family:Archivo,system-ui,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
          to: a.email,
          to_name: "Equipo DTD",
          metadata: { source: "alta-health", sin_acceso: rotos.length },
        });
        summary.avisados += 1;
      }
    }

    summaries.push(summary);
  }

  const result = { ok: true, dry, lookback, tenants: summaries };
  return cron.complete(result, {
    fields: {
      mode: dry ? "dry-run" : "live",
      tenantCount: summaries.length,
      affected: summaries.reduce((total, item) => total + item.sin_acceso, 0),
      notified: summaries.reduce((total, item) => total + item.avisados, 0),
    },
  });
}

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.alta-health");
  if (!cron.authorized) return cron.deny();
  try {
    return await run(req, cron);
  } catch (error) {
    return cron.fail("No se pudo ejecutar alta health.", error, {
      event: "cron.run_failed",
      fields: { stage: "run" },
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  return GET(req);
}

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

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  ALTA_LOOKBACK_DAYS,
  buildAltaHealthMessage,
  listAltasSinAcceso,
} from "@/lib/studio/alta-health";
import { resolveAdminEntries } from "@/lib/studio/new-client-notify";
import { dispatchAlert } from "@/lib/studio/alerts/dispatch-alert";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { matchesBearerSecret } from "@/lib/http/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_CAP = 100;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (matchesBearerSecret(auth, secret)) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const days = Number(url.searchParams.get("days") ?? ALTA_LOOKBACK_DAYS);
  const lookback = Number.isFinite(days) && days > 0 ? days : ALTA_LOOKBACK_DAYS;

  const admin = createAdminClient();
  const sinceIso = new Date(Date.now() - lookback * 86_400_000).toISOString();

  const { data: tenants, error } = await admin.from("tenants").select("id");
  if (error) {
    return NextResponse.json(
      { ok: false, error: `Listar tenants: ${error.message}` },
      { status: 500 },
    );
  }

  const summaries = [];

  for (const t of (tenants ?? []) as Array<{ id: string }>) {
    const rotos = await listAltasSinAcceso(admin, t.id, sinceIso, BATCH_CAP);
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
      await dispatchAlert(
        admin,
        t.id,
        "equipo",
        {
          telegramText: text,
          // Sin la lista de clientes: cuántos son y dónde se arregla (SDD-0606).
          discord: {
            titulo: "Clientes con Shipping Mark y sin acceso al portal",
            conteos: [{ etiqueta: "Clientes sin acceso", valor: rotos.length }],
            url: `${SITE_URL}/studio/admin`,
          },
        },
        { logTag: "alta-health" },
      );

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
  console.log("[alta-health]", JSON.stringify(result));
  return NextResponse.json(result);
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

/**
 * /api/cron/bug-daily-digest — resumen diario de reportes a Discord `#bugs`
 * (SDD-0036 §11, enmienda D-13).
 *
 * Una vez al día (12:05 UTC = 08:05 en Caracas) manda el resumen del día
 * anterior: mejoras, sugerencias, preguntas y errores leves, con conteos,
 * folios y módulos. Sin títulos, sin textos y sin nombres. Los errores de
 * gravedad alta y crítica siguen saliendo al momento y no se repiten acá.
 *
 * Sólo para el tenant dueño de los canales (`DISCORD_TENANT_ID`): sin esa
 * variable o sin `DISCORD_WEBHOOK_BUGS`, no toca la base y responde
 * `discord-apagado`. Aunque exista el canal de respaldo (`#avisos-equipo`), el
 * resumen no cae ahí: es de `#bugs`.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`, sólo por header.
 * No es idempotente por sí mismo: correrlo dos veces el mismo día manda dos
 * resúmenes iguales. El crontab lo agenda una sola vez.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { runBugDailyDigest } from "@/lib/studio/notify/bug-daily-digest";
import { DISCORD_TENANT_ENV_VAR } from "@/lib/studio/discord/channels";
import { matchesBearerSecret } from "@/lib/http/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  if (matchesBearerSecret(req.headers.get("authorization"), secret)) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const tenantId = process.env[DISCORD_TENANT_ENV_VAR]?.trim();
  if (!tenantId) {
    return NextResponse.json({ ok: true, estado: "discord-apagado" });
  }

  const result = await runBugDailyDigest(createAdminClient(), tenantId, { siteUrl: SITE_URL });
  return NextResponse.json({ ok: result.estado !== "error", ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

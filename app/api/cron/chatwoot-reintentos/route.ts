/**
 * /api/cron/chatwoot-reintentos — reintento propio de los eventos de Chatwoot
 * (SDD-0585, 2.3, v3).
 *
 * Chatwoot 4.19.1 no reintenta webhooks de cuenta (`Webhooks::Trigger#execute`
 * rescata el error; solo reintenta agentes bot). Este cron toma los eventos
 * «fallido» cuya espera venció y los colgados en «procesando», y vuelve a
 * correr sus acciones (`reprocesarEventosChatwoot`). La base cuenta los
 * intentos, espera 1, 2, 4 y 8 min y, al quinto, deja el evento «descartado»
 * (lo ve el admin en la Bandeja).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`, solo por cabecera,
 * como push-drain. Sin la 0504 responde 200 con `omitido` y no rompe.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { reprocesarEventosChatwoot } from "@/lib/studio/chatwoot/webhook-procesar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const result = await reprocesarEventosChatwoot(createAdminClient());
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

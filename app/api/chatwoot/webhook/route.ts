/**
 * POST /api/chatwoot/webhook — eventos de Chatwoot → Studio (SDD-0585, paso 2.3).
 *
 * Delgada a propósito: verificar → interpretar → procesar.
 *   1. Configuración (`CHATWOOT_WEBHOOK_SECRET`, `CHATWOOT_TENANT_ID`,
 *      `CHATWOOT_ACCOUNT_ID`). Falta algo → 503, sin tocar la base.
 *   2. Firma HMAC sobre el cuerpo CRUDO con anti-replay (E2-D16). Mala → 401.
 *   3. JSON e `interpretarEvento` (E2-D17): de otra cuenta o de otro tipo → 200
 *      `ignored` (Chatwoot no debe reintentar lo que no nos interesa).
 *   4. `procesarEventoChatwoot`: idempotente; el duplicado responde 200. Si un
 *      manejador falló, el evento queda «fallido» (reintentable) y se responde
 *      500. Ojo: Chatwoot 4.19.1 NO reintenta webhooks de cuenta
 *      (`Webhooks::Trigger#execute` rescata el error; solo reintenta agentes
 *      bot), así que el 500 sirve a una reentrega manual o a un reproceso propio.
 *
 * No se registra el cuerpo, ni cabeceras con la firma, ni el texto del mensaje.
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/db/admin";
import { chatwootWebhookConfig } from "@/lib/studio/chatwoot/config";
import { verificarFirmaChatwoot } from "@/lib/studio/chatwoot/webhook-signature";
import { interpretarEvento } from "@/lib/studio/chatwoot/webhook-events";
import { procesarEventoChatwoot } from "@/lib/studio/chatwoot/webhook-procesar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cfg = chatwootWebhookConfig();
  if (!cfg) return NextResponse.json({ ok: false, error: "no_configurado" }, { status: 503 });

  const cuerpo = await req.text();
  const firma = verificarFirmaChatwoot({
    cuerpo,
    timestamp: req.headers.get("x-chatwoot-timestamp"),
    firma: req.headers.get("x-chatwoot-signature"),
    secreto: cfg.secret,
  });
  if (firma !== "ok") return NextResponse.json({ ok: false, error: "firma" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ ok: false, error: "json" }, { status: 400 });
  }

  const evento = interpretarEvento(payload);
  if (!evento) return NextResponse.json({ ok: true, ignored: "evento" });
  if (evento.accountId !== cfg.accountId) return NextResponse.json({ ok: true, ignored: "cuenta" });

  try {
    const r = await procesarEventoChatwoot({ admin: createAdminClient(), tenantId: cfg.tenantId }, evento);
    if (r.estado === "fallido") return NextResponse.json({ ok: false, error: "manejador" }, { status: 500 });
    return NextResponse.json({ ok: true, resultado: r.estado });
  } catch (e) {
    console.error(`[chatwoot-webhook] ${evento.evento} no se registró: ${e instanceof Error ? e.message : "error"}`);
    return NextResponse.json({ ok: false, error: "registro" }, { status: 500 });
  }
}

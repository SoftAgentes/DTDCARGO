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
 * También purga por plazo lo de la Bandeja (SDD-0585, 2.7; propuesta del
 * Director sin objeción de Sam, 2026-10-30): eventos de más de 90 días,
 * conversaciones sin actividad en 12 meses y el usuario de Chatwoot de un
 * agente dado de baja hace más de 12 meses. Sin la 0508 responde `omitido`.
 *
 * Y purga por plazo lo de E10 (SDD-0586, decisiones de Sam del
 * 2026-10-30): BSUID con un año sin actividad y respuestas del bot de más de
 * 30 días (`purgarEnrutamientoChatwoot`).
 *
 * Y manda la cola de la ida del chat del portal a Chatwoot (SDD-0586, paso 10.5,
 * E10-D34), red de seguridad del envío que pide el portal, y después avisa a los
 * admins, con solo números, si algo lleva más de 15 min sin llegar (E10-D40). Con
 * el flag `chatwoot_portal` apagado o sin su configuración, ninguno hace nada.
 *
 * Y concilia el portal (SDD-0586, 1c-2, E10-D40 punto 5): en los hilos vivos, relee el estado y
 * trae las respuestas del equipo que un webhook perdido no llevó (`conciliarPortal`).
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`, solo por cabecera,
 * como push-drain. Sin la 0504 responde 200 con `omitido` y no rompe.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { chatwootConfig, chatwootServicioUserId } from "@/lib/studio/chatwoot/config";
import { purgarEnrutamientoChatwoot } from "@/lib/studio/chatwoot/enrutar";
import { avisarRezagoPortal, enviarPortalPendientes } from "@/lib/studio/chatwoot/portal";
import { conciliarPortal } from "@/lib/studio/chatwoot/portal-conciliar";
import { purgarBajasVencidas, purgarBandejaChatwoot } from "@/lib/studio/chatwoot/purga";
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

  const admin = createAdminClient();
  const result = await reprocesarEventosChatwoot(admin);
  const purgaBandeja = await purgarBandejaChatwoot(admin);
  const purgaBajas = await purgarBajasVencidas(admin, chatwootConfig(), chatwootServicioUserId());
  const purgaEnrutamiento = await purgarEnrutamientoChatwoot(admin);
  // La ida del portal no tumba el cron: lo que falle se informa con un código.
  const portal = await enviarPortalPendientes(admin).catch(() => ({ omitido: "error" as const }));
  const avisoPortal = await avisarRezagoPortal(admin).catch(() => ({ omitido: "error" as const }));
  // SDD-0586 1c-2: la conciliación trae lo que se perdió por un webhook (E10-D40, punto 5).
  const conciliacionPortal = await conciliarPortal(admin).catch(() => ({ omitido: "error" as const }));
  return NextResponse.json({ ok: true, ...result, purgaBandeja, purgaBajas, purgaEnrutamiento, portal, avisoPortal, conciliacionPortal });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

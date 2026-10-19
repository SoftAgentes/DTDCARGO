/**
 * /api/cron/kommo-contact-status — escribe el estado comercial del cliente en su
 * CONTACTO de Kommo (SDD-0256 · Fase 5 · B4).
 *
 * Ver `lib/studio/kommo-contact-status.ts` para el porqué. Resumen: los agentes
 * de IA de Kommo leen campos del contacto, y hoy no tienen forma de saber si
 * quien escribe debe plata o tiene carga navegando — así que contestan igual en
 * los dos casos.
 *
 * El job sólo ENCOLA (`patch_contact`). El PATCH lo hace la edge function
 * `kommo-writeback` con el token de Vault: el ERP nunca le pega a la API de
 * Kommo (modelo SDD-0043).
 *
 * Schedule: diario. El estado comercial cambia con facturas y embarques, no por
 * minuto; correrlo más seguido gastaría cuota de Kommo sin cambiar la respuesta
 * del agente.
 *
 * Nace inerte: sin `contact_saldo_field_id` / `contact_transito_field_id`
 * configurados devuelve `inerte` y no encola. Y aunque se configuren, el gate de
 * escritura de la 0136 sigue mandando.
 *
 * Auth: CRON_SECRET en header `Authorization: Bearer <secret>` — nunca por
 * query-param.
 *
 * Manual (testing):
 *   curl -H "Authorization: Bearer <CRON_SECRET>" "https://.../api/cron/kommo-contact-status?dry=1"
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { soloLecturaKommo, syncKommoContactStatus } from "@/lib/studio/kommo-contact-status";
import { matchesBearerSecret } from "@/lib/http/secret-compare";

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
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 403 });

  // `dry=1` recorre y cuenta SIN encolar. Sirve para responder "¿a cuántos
  // contactos les escribiría algo?" antes de escribirle a ninguno — que es
  // exactamente la pregunta que había que contestar antes de prender esto.
  // SDD-0558: `soloLecturaKommo` neutraliza SOLO la RPC de encolado; el saldo,
  // que ahora se lee por RPC, sale de la base real.
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const admin = createAdminClient();
  const { data: tenants, error } = await admin.from("tenants").select("id");
  if (error) {
    return NextResponse.json(
      { ok: false, error: `Listar tenants: ${error.message}` },
      { status: 500 },
    );
  }

  const resultados = [];
  for (const t of (tenants ?? []) as Array<{ id: string }>) {
    const r = dry
      ? await syncKommoContactStatus(soloLecturaKommo(admin), t.id)
      : await syncKommoContactStatus(admin, t.id);
    resultados.push({ tenant_id: t.id, ...r, dry });
  }

  const result = { ok: true, dry, tenants: resultados };
  console.log("[kommo-contact-status]", JSON.stringify(result));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

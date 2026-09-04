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

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  createCronRequestContext,
  type CronRequestContext,
} from "@/lib/observability/cron-request-context";
import { syncKommoContactStatus } from "@/lib/studio/kommo-contact-status";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: NextRequest, cron: CronRequestContext) {
  // `dry=1` recorre y cuenta SIN encolar. Sirve para responder "¿a cuántos
  // contactos les escribiría algo?" antes de escribirle a ninguno — que es
  // exactamente la pregunta que había que contestar antes de prender esto.
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const admin = createAdminClient();
  const { data: tenants, error } = await admin.from("tenants").select("id");
  if (error) {
    return cron.fail("No se pudo leer los tenants para Kommo.", error, {
      event: "cron.read_failed",
      fields: { stage: "read" },
    });
  }

  const resultados = [];
  for (const t of (tenants ?? []) as Array<{ id: string }>) {
    const r = dry
      ? await syncKommoContactStatus(dryAdmin(admin), t.id)
      : await syncKommoContactStatus(admin, t.id);
    resultados.push({ tenant_id: t.id, ...r, dry });
  }

  const result = { ok: true, dry, tenants: resultados };
  return cron.complete(result, {
    fields: {
      mode: dry ? "dry-run" : "live",
      tenantCount: resultados.length,
      linked: resultados.reduce((total, item) => total + item.vinculados, 0),
      enqueued: resultados.reduce((total, item) => total + item.encoladas, 0),
      withBalance: resultados.reduce((total, item) => total + item.conSaldo, 0),
      inTransit: resultados.reduce((total, item) => total + item.conTransito, 0),
      inert: resultados.filter((item) => Boolean(item.inerte)).length,
      truncated: resultados.filter((item) => item.truncado).length,
    },
  });
}

export async function GET(req: NextRequest) {
  const cron = createCronRequestContext(req, "cron.kommo-contact-status");
  if (!cron.authorized) return cron.deny();
  try {
    return await run(req, cron);
  } catch (error) {
    return cron.fail("No se pudo ejecutar el estado de contactos Kommo.", error, {
      event: "cron.run_failed",
      fields: { stage: "run" },
    });
  }
}

/**
 * Cliente que lee igual pero cuya única RPC (el encolado) no hace nada.
 *
 * Es un proxy sobre el admin real, no un stub: si fuera un stub habría que
 * mantener en paralelo la forma de todas las lecturas, y el `dry` terminaría
 * midiendo el stub en vez de la base — el error de "verificar un proxy en vez
 * de la cosa" metido justo en la herramienta que existe para medir.
 */
function dryAdmin(admin: ReturnType<typeof createAdminClient>) {
  return new Proxy(admin, {
    get(target, prop, receiver) {
      if (prop === "rpc") {
        return async () => ({ data: null, error: null });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

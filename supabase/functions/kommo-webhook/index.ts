// SDD-0043 Alcance B · Edge Function kommo-webhook (push en vivo).
//
// Kommo POSTea form-urlencoded cuando un lead/contacto cambia. Acá:
//   1. Auth: ?secret=<KOMMO_WEBHOOK_SECRET> (constante-time). 403 si no matchea.
//   2. Parseo del body (parser puro compartido con Vitest).
//   3. Resolución de la conexión por account[subdomain] → tenant_id + token (Vault).
//   4. Por evento add/update/status: fetch la entidad por id → map → upsert.
//      Para delete: borra la fila (tenant_id+id).
//   5. Registra en sync_logs; resetea kommo_connections.status='active' en éxito.
//   6. Responde 200 salvo secret inválido (403) o error interno (500).
//
// verify_jwt=OFF (igual que kommo-sync; gestionado fuera del repo vía dashboard/MCP).
// El guard real es el ?secret= que el founder pega en la config del webhook de Kommo.
// NO desplegar desde acá (lo hace el founder por MCP). NO hardcodea tenant/subdomain.

import { createClient } from "jsr:@supabase/supabase-js@2";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { kommoFetch } from "../kommo-sync/kommo-client.ts";
import { upsertRows } from "../kommo-sync/sync.ts";
import type { KommoContact, KommoLead } from "../kommo-sync/types.ts";
import {
  mapContactRow,
  mapLeadRow,
} from "../_shared/kommo-mapping.ts";
import {
  parseKommoWebhookPayload,
  type KommoWebhookEvent,
} from "../_shared/kommo-webhook-parse.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Comparación de longitud-constante para el secret (evita timing oracle). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface ConnRow {
  id: string;
  tenant_id: string;
  subdomain: string;
  domain: string;
  status: string;
}

/** Aplica un lote de eventos de una entidad. Devuelve {fetched, upserted, deleted}. */
async function applyEntityEvents(
  supabase: SupabaseClient,
  baseUrl: string,
  token: string,
  tenantId: string,
  entity: "lead" | "contact",
  events: KommoWebhookEvent[],
): Promise<{ fetched: number; upserted: number; deleted: number }> {
  const table = entity === "lead" ? "kommo_leads" : "kommo_contacts";
  const apiPath = entity === "lead" ? "leads" : "contacts";

  const deletes = events.filter((e) => e.action === "delete");
  const upserts = events.filter((e) => e.action !== "delete");

  let fetched = 0;
  let deleted = 0;
  const rows: Record<string, unknown>[] = [];

  // delete → borrar la fila (tenant_id+id)
  if (deletes.length > 0) {
    const ids = deletes.map((e) => e.id);
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("tenant_id", tenantId)
      .in("id", ids);
    if (error) throw new Error(`${table} delete: ${error.message}`);
    deleted = ids.length;
  }

  // add/update/status → fetch entidad por id (puede traer 404 si ya no existe → se ignora)
  for (const ev of upserts) {
    const data =
      entity === "lead"
        ? await kommoFetch<KommoLead>(baseUrl, token, `/api/v4/leads/${ev.id}`)
        : await kommoFetch<KommoContact>(
            baseUrl,
            token,
            `/api/v4/contacts/${ev.id}`,
          );
    if (!data) continue; // 204 / sin contenido → nada que upsertear
    fetched += 1;
    rows.push(
      entity === "lead"
        ? mapLeadRow(data as KommoLead, tenantId)
        : mapContactRow(data as KommoContact, tenantId),
    );
  }

  // El trigger de la migr 0107 descarta filas con kommo_updated_at más viejo (orden).
  const upserted = await upsertRows(supabase, table, rows);
  return { fetched, upserted, deleted };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Usá POST" }, 405);

  // 1) Auth del caller — ?secret= vs KOMMO_WEBHOOK_SECRET (constante-time).
  const SECRET = Deno.env.get("KOMMO_WEBHOOK_SECRET");
  if (!SECRET) return json({ error: "Falta KOMMO_WEBHOOK_SECRET" }, 500);
  const given = new URL(req.url).searchParams.get("secret") ?? "";
  if (!timingSafeEqual(given, SECRET)) {
    return json({ error: "Forbidden" }, 403);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  // 2) Parseo del body form-urlencoded.
  let parsed;
  try {
    const raw = await req.text();
    parsed = parseKommoWebhookPayload(raw);
  } catch (e) {
    // Cuerpo ilegible no debe hacer reintentar infinito a Kommo → 200 con nota.
    return json({ ok: true, ignored: "body ilegible", detail: errMsg(e) }, 200);
  }
  if (parsed.events.length === 0) {
    return json({ ok: true, events: 0 }, 200);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // 3) Resolver conexión por subdomain → tenant_id + token (Vault).
  //    Sin conexión activa → 200 (no 4xx) para que Kommo no reintente en loop.
  if (!parsed.subdomain) {
    return json({ ok: true, ignored: "sin account[subdomain]" }, 200);
  }
  const { data: conn, error: connErr } = await supabase
    .from("kommo_connections")
    .select("id, tenant_id, subdomain, domain, status")
    .eq("subdomain", parsed.subdomain)
    .maybeSingle<ConnRow>();
  if (connErr) return json({ error: `kommo_connections: ${connErr.message}` }, 500);
  if (!conn) {
    return json({ ok: true, ignored: `sin conexión para ${parsed.subdomain}` }, 200);
  }

  const { data: token, error: tokErr } = await supabase.rpc("kommo_get_token", {
    p_connection_id: conn.id,
  });
  if (tokErr) return json({ error: `kommo_get_token: ${tokErr.message}` }, 500);
  if (!token) {
    return json({ ok: true, ignored: "token no encontrado en Vault" }, 200);
  }

  const baseUrl = `https://${conn.subdomain}.${conn.domain}`;
  const started_at = new Date().toISOString();

  // 4+5) Aplicar eventos por entidad + registrar en sync_logs.
  try {
    const leadEvents = parsed.events.filter((e) => e.entity === "lead");
    const contactEvents = parsed.events.filter((e) => e.entity === "contact");

    const summary: Record<string, unknown> = {};
    for (const [entity, evs] of [
      ["lead", leadEvents],
      ["contact", contactEvents],
    ] as const) {
      if (evs.length === 0) continue;
      const res = await applyEntityEvents(
        supabase,
        baseUrl,
        token as string,
        conn.tenant_id,
        entity,
        evs,
      );
      summary[entity] = res;
      await supabase.from("sync_logs").insert({
        tenant_id: conn.tenant_id,
        connection_id: conn.id,
        entity: `webhook_${entity}s`,
        started_at,
        finished_at: new Date().toISOString(),
        records_fetched: res.fetched + res.deleted,
        records_upserted: res.upserted,
        status: "ok",
      });
    }

    // Éxito → resetea el estado de la conexión (arregla deuda #1 parcial).
    await supabase
      .from("kommo_connections")
      .update({
        status: "active",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id);

    return json({ ok: true, events: parsed.events.length, summary }, 200);
  } catch (e) {
    const detail = errMsg(e);
    await supabase.from("sync_logs").insert({
      tenant_id: conn.tenant_id,
      connection_id: conn.id,
      entity: "webhook",
      started_at,
      finished_at: new Date().toISOString(),
      status: "error",
      error_detail: detail,
    });
    // Error interno irrecuperable → 500 (Kommo reintenta). Sin filtrar secretos.
    return json({ error: detail }, 500);
  }
});

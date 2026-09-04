// SDD-0074 · Edge Function kommo-push-client — push del alta de cliente a Kommo (outbound de CREACIÓN).
//
// POST { tenant_id, client_id, dry_run? } → crea (o reusa) el contacto, crea el lead, lo enlaza al
// contacto, lo etiqueta con MARKBOX/RIF/tier, espeja el lead AUTORITATIVO (GET) en kommo_leads y
// enlaza clients.kommo_lead_id. Idempotente: si el cliente ya tiene kommo_lead_id, hace PATCH y termina.
//
// SEGURIDAD DE ESCRITURA (estilo SDD-0062 "nace apagado"): por default la función NO escribe en
// Kommo — corre en DRY-RUN (lee + arma payloads + loguea lo que haría). Para escribir de verdad hay
// que setear el secreto KOMMO_PUSH_DRY_RUN="false". El body { dry_run:true } puede forzar ensayo.
// Ver docs/runbooks/deploy-kommo-push-client.md.
//
// Endurecido por la revisión 3-expertos (SDD-0074):
//  - el lead se espeja con un GET autoritativo (el create de Kommo solo devuelve el id);
//  - el contacto se enlaza con POST /leads/{id}/link (no con _embedded en el create);
//  - tier (SELECT) se manda como enum_id, no como texto libre (evita 400 que tumba el lead);
//  - kommoWrite NO reintenta POST en 5xx (evita duplicados).
//
// Auth: igual que kommo-sync (verify_jwt=OFF; exige el SERVICE_ROLE del proyecto). El token de
// Kommo vive solo en Vault y solo lo lee esta función vía kommo_get_token (modelo SDD-0043).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createEdgeRequestLogger } from "../_shared/structured-logger.ts";
import {
  kommoFetch,
  kommoWrite,
  RATE_LIMIT_DELAY_MS,
  sleep,
} from "../kommo-sync/kommo-client.ts";
import { mapLeadRow } from "../_shared/kommo-mapping.ts";
import {
  buildContactLink,
  buildContactPayload,
  buildLeadCustomFields,
  buildLeadPatch,
  buildLeadPayload,
  matchContact,
  pickDedupQueries,
  resolveDryRun,
  resolveLeadFields,
  type KommoEntityLite,
  type KommoFieldDef,
  type OnboardingClient,
} from "../_shared/kommo-outbound.ts";
import type { HalList, KommoConnection, KommoContact, KommoLead } from "../kommo-sync/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ClientRow extends OnboardingClient {
  kommo_lead_id: number | null;
}

/**
 * Búsqueda de contacto en vivo (el espejo es snapshot diario → un alta de hoy no estaría).
 * limit=250 (máximo de página de Kommo) + pausa entre queries para respetar el rate limit.
 */
async function findExistingContactId(
  baseUrl: string,
  token: string,
  client: OnboardingClient,
): Promise<number | null> {
  const queries = pickDedupQueries(client);
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);
    const data = await kommoFetch<HalList<KommoContact>>(
      baseUrl,
      token,
      `/api/v4/contacts?query=${encodeURIComponent(queries[i].q)}&limit=250`,
    );
    const contacts = (data?._embedded?.contacts ?? []) as KommoEntityLite[];
    const hit = matchContact(contacts, client.phone, client.email);
    if (hit) return hit;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const logger = createEdgeRequestLogger(req, "edge.kommo-push-client");
  const respond = (body: unknown, status = 200) =>
    logger.withResponse(json(body, status));
  const fail = (event: string, error: unknown, status = 500) => {
    logger.error(event, { error, stage: "database", status });
    return respond({ error: "Fallo interno de kommo-push-client" }, status);
  };

  if (req.method === "OPTIONS") {
    return logger.withResponse(new Response("ok", { headers: corsHeaders }));
  }
  if (req.method !== "POST") return respond({ error: "Usá POST" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    logger.error("edge.config_missing", { stage: "config", status: 500 });
    return respond({ error: "Configuración incompleta" }, 500);
  }

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apikey = (req.headers.get("apikey") ?? "").trim();
  if (bearer !== SERVICE_ROLE && apikey !== SERVICE_ROLE) {
    logger.warn("edge.rejected", { stage: "auth", status: 403 });
    return respond({ error: "Forbidden: requiere el service key del proyecto" }, 403);
  }

  let body: { tenant_id?: string; client_id?: string; dry_run?: boolean };
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Body JSON inválido" }, 400);
  }
  const { tenant_id, client_id } = body;
  if (!tenant_id || !client_id) {
    return respond({ error: "Faltan tenant_id / client_id" }, 400);
  }

  // Gate de escritura: por default NO escribe (dry-run). Real solo con KOMMO_PUSH_DRY_RUN="false".
  const dryRun = resolveDryRun(Deno.env.get("KOMMO_PUSH_DRY_RUN"), body.dry_run);

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const started_at = new Date().toISOString();
  const logResult = async (
    connection_id: string | null,
    status: "ok" | "error",
    extra: { error_detail?: string; records_upserted?: number } = {},
  ) => {
    await supabase.from("sync_logs").insert({
      tenant_id,
      connection_id,
      entity: dryRun ? "push_client_dryrun" : "push_client",
      started_at,
      finished_at: new Date().toISOString(),
      status,
      records_fetched: 0,
      records_upserted: extra.records_upserted ?? 0,
      error_detail: extra.error_detail ?? null,
    });
  };

  try {
    // 1) Conexión + token (Vault).
    const { data: conn, error: connErr } = await supabase
      .from("kommo_connections")
      .select("id, tenant_id, subdomain, domain, status")
      .eq("tenant_id", tenant_id)
      .maybeSingle<KommoConnection>();
    if (connErr) return fail("edge.connection_read_failed", connErr);
    if (!conn) return respond({ error: "No hay conexión Kommo configurada" }, 404);
    if (conn.status !== "active") {
      return respond({ error: "Conexión Kommo no disponible" }, 409);
    }

    const { data: token, error: tokErr } = await supabase.rpc("kommo_get_token", {
      p_connection_id: conn.id,
    });
    if (tokErr) return fail("edge.token_read_failed", tokErr);
    if (!token) return respond({ error: "Credencial Kommo no disponible" }, 500);
    const tk = token as string;

    const baseUrl = `https://${conn.subdomain}.${conn.domain}`;

    // 2) Cliente del ERP.
    const { data: client, error: cliErr } = await supabase
      .from("clients")
      .select("name, email, phone, rif, markbox, doc_kind, tier, kommo_lead_id")
      .eq("tenant_id", tenant_id)
      .eq("id", client_id)
      .is("deleted_at", null)
      .maybeSingle<ClientRow>();
    if (cliErr) return fail("edge.client_read_failed", cliErr);
    if (!client) return respond({ error: "Cliente no encontrado" }, 404);

    // 3) Definiciones de custom fields (espejo, con type+enums) → markbox/rif/tier.
    const { data: fieldRows } = await supabase
      .from("kommo_custom_fields")
      .select("id, entity_type, name, code, type, enums")
      .eq("tenant_id", tenant_id)
      .eq("entity_type", "leads");
    const fields = resolveLeadFields((fieldRows ?? []) as KommoFieldDef[]);

    // 4) IDEMPOTENCIA: ya enlazado → PATCH (refresca tags) y termina; no recrea.
    if (client.kommo_lead_id) {
      const patch = buildLeadPatch(client, fields);
      if (dryRun) {
        logger.info("edge.dry_run", {
          mode: "patch",
          customFields: buildLeadCustomFields(client, fields).length,
          dryRun: true,
        });
        await logResult(conn.id, "ok");
        return respond({
          lead_id: client.kommo_lead_id,
          mode: "patched",
          dry_run: true,
          would: { patch },
        });
      }
      await kommoWrite<KommoLead>(baseUrl, tk, `/api/v4/leads/${client.kommo_lead_id}`, "PATCH", patch);
      await logResult(conn.id, "ok");
      logger.info("edge.completed", { mode: "patched", succeeded: 1 });
      return respond({ lead_id: client.kommo_lead_id, mode: "patched" });
    }

    // 5) Dedup de contacto (en vivo — read-only, seguro también en dry-run).
    const matchedContactId = await findExistingContactId(baseUrl, tk, client);

    // 5b) DRY-RUN: no escribe nada. Reporta lo que haría y termina.
    if (dryRun) {
      logger.info("edge.dry_run", {
        mode: matchedContactId ? "would-link-existing-contact" : "would-create-contact",
        customFields: buildLeadCustomFields(client, fields).length,
        matched: matchedContactId ? 1 : 0,
        dryRun: true,
      });
      await logResult(conn.id, "ok");
      return respond({
        dry_run: true,
        mode: matchedContactId ? "would-link-existing-contact" : "would-create-contact",
        would: {
          contact: matchedContactId ? { matched_id: matchedContactId } : { create: buildContactPayload(client) },
          lead: buildLeadPayload(client, fields),
          link_contact_id: matchedContactId ?? null,
        },
      });
    }

    // 6) REAL — reusar o crear contacto.
    let contactId = matchedContactId;
    let contactMode: "matched" | "created" = "matched";
    if (!contactId) {
      const created = await kommoWrite<HalList<KommoContact>>(
        baseUrl,
        tk,
        "/api/v4/contacts",
        "POST",
        [buildContactPayload(client)],
      );
      contactId = created?._embedded?.contacts?.[0]?.id ?? null;
      contactMode = "created";
      if (!contactId) throw new Error("Kommo no devolvió id de contacto al crear");
    }

    // 7) Crear el lead (SIN embeber el contacto) + custom fields.
    const leadResp = await kommoWrite<HalList<KommoLead>>(
      baseUrl,
      tk,
      "/api/v4/leads",
      "POST",
      [buildLeadPayload(client, fields)],
    );
    const leadId = leadResp?._embedded?.leads?.[0]?.id;
    if (!leadId) throw new Error("Kommo no devolvió id de lead al crear");

    // 8) Enlazar el contacto al lead (camino documentado y confiable; no dependemos de _embedded).
    await kommoWrite(baseUrl, tk, `/api/v4/leads/${leadId}/link`, "POST", buildContactLink(contactId));

    // 9) Espejar el lead AUTORITATIVO: el create solo devolvió el id, así que GET el lead completo
    //    y mapeamos ESO (no la respuesta mínima). Si el GET falla, stub id-only para sostener el FK
    //    (clients_kommo_lead_fk, migr 0108) — el webhook/sync lo refresca idempotente luego.
    const fullLead = await kommoFetch<KommoLead>(baseUrl, tk, `/api/v4/leads/${leadId}`);
    const { error: mirrorErr } = await supabase
      .from("kommo_leads")
      .upsert(mapLeadRow(fullLead ?? { id: leadId }, tenant_id), { onConflict: "tenant_id,id" });
    if (mirrorErr) throw new Error(`espejo kommo_leads: ${mirrorErr.message}`);

    // 10) Enlazar clients.kommo_lead_id (el lead ya existe en el espejo → FK satisfecho).
    const { error: linkErr } = await supabase
      .from("clients")
      .update({ kommo_lead_id: leadId })
      .eq("tenant_id", tenant_id)
      .eq("id", client_id);
    if (linkErr) throw new Error(`enlace clients.kommo_lead_id: ${linkErr.message}`);

    await logResult(conn.id, "ok", { records_upserted: 1 });
    logger.info("edge.completed", { mode: "created", succeeded: 1 });
    return respond({ lead_id: leadId, contact_id: contactId, mode: "created", contact: contactMode });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await logResult(null, "error", { error_detail: detail });
    logger.error("edge.run_failed", { error: e, stage: "push", status: 500 });
    return respond({ error: "Fallo interno de kommo-push-client" }, 500);
  }
});

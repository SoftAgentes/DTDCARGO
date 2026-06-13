// SDD-0074 · Edge Function kommo-push-client — push del alta de cliente a Kommo (outbound de CREACIÓN).
//
// POST { tenant_id, client_id } → crea (o reusa) el contacto + crea el lead en Kommo, lo etiqueta
// con MARKBOX/RIF/tier, espeja el lead autoritativo en kommo_leads y enlaza clients.kommo_lead_id.
// Idempotente: si el cliente ya tiene kommo_lead_id, hace PATCH (refresca tags) y termina.
//
// Mismo patrón de auth que kommo-sync (verify_jwt=OFF; exige el SERVICE_ROLE del proyecto en
// Authorization/apikey — uso backend, nunca desde el navegador). El token de Kommo vive solo en
// Vault y solo lo lee esta función vía kommo_get_token (modelo de seguridad SDD-0043).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { kommoFetch, kommoWrite } from "../kommo-sync/kommo-client.ts";
import { mapLeadRow } from "../_shared/kommo-mapping.ts";
import {
  buildContactPayload,
  buildLeadPatch,
  buildLeadPayload,
  matchContact,
  pickDedupQueries,
  resolveFieldIds,
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

/** Búsqueda de contacto en vivo (la tabla espejo es snapshot diario → un alta de hoy no estaría). */
async function findExistingContactId(
  baseUrl: string,
  token: string,
  client: OnboardingClient,
): Promise<number | null> {
  for (const { q } of pickDedupQueries(client)) {
    const data = await kommoFetch<HalList<KommoContact>>(
      baseUrl,
      token,
      `/api/v4/contacts?query=${encodeURIComponent(q)}&limit=50`,
    );
    const contacts = (data?._embedded?.contacts ?? []) as KommoEntityLite[];
    const hit = matchContact(contacts, client.phone, client.email);
    if (hit) return hit;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Usá POST" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  // Auth backend: exige el service key del proyecto (la publishable/anon no sirve).
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apikey = (req.headers.get("apikey") ?? "").trim();
  if (bearer !== SERVICE_ROLE && apikey !== SERVICE_ROLE) {
    return json({ error: "Forbidden: requiere el service key del proyecto" }, 403);
  }

  let body: { tenant_id?: string; client_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON inválido" }, 400);
  }
  const { tenant_id, client_id } = body;
  if (!tenant_id || !client_id) return json({ error: "Faltan tenant_id / client_id" }, 400);

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
      entity: "push_client",
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
    if (connErr) return json({ error: `kommo_connections: ${connErr.message}` }, 500);
    if (!conn) return json({ error: "No hay kommo_connections para ese tenant_id" }, 404);
    if (conn.status !== "active") return json({ error: `Conexión en estado "${conn.status}"` }, 409);

    const { data: token, error: tokErr } = await supabase.rpc("kommo_get_token", {
      p_connection_id: conn.id,
    });
    if (tokErr) return json({ error: `kommo_get_token: ${tokErr.message}` }, 500);
    if (!token) return json({ error: "Token no encontrado en Vault" }, 500);

    const baseUrl = `https://${conn.subdomain}.${conn.domain}`;

    // 2) Cliente del ERP.
    const { data: client, error: cliErr } = await supabase
      .from("clients")
      .select("name, email, phone, rif, markbox, doc_kind, tier, kommo_lead_id")
      .eq("tenant_id", tenant_id)
      .eq("id", client_id)
      .is("deleted_at", null)
      .maybeSingle<ClientRow>();
    if (cliErr) return json({ error: `clients: ${cliErr.message}` }, 500);
    if (!client) return json({ error: "Cliente no encontrado" }, 404);

    // 3) Definiciones de custom fields (espejo) → field_id de markbox/rif/tier.
    const { data: fieldRows } = await supabase
      .from("kommo_custom_fields")
      .select("id, entity_type, name, code")
      .eq("tenant_id", tenant_id)
      .eq("entity_type", "leads");
    const fieldIds = resolveFieldIds((fieldRows ?? []) as KommoFieldDef[]);

    // 4) IDEMPOTENCIA: ya enlazado → PATCH (refresca tags) y termina; no recrea.
    if (client.kommo_lead_id) {
      await kommoWrite<KommoLead>(
        baseUrl,
        token as string,
        `/api/v4/leads/${client.kommo_lead_id}`,
        "PATCH",
        buildLeadPatch(client, fieldIds),
      );
      await logResult(conn.id, "ok");
      return json({ lead_id: client.kommo_lead_id, mode: "patched" });
    }

    // 5) Dedup de contacto (en vivo) → reusar o crear.
    let contactId = await findExistingContactId(baseUrl, token as string, client);
    let contactMode: "matched" | "created" = "matched";
    if (!contactId) {
      const created = await kommoWrite<HalList<KommoContact>>(
        baseUrl,
        token as string,
        "/api/v4/contacts",
        "POST",
        [buildContactPayload(client)],
      );
      contactId = created?._embedded?.contacts?.[0]?.id ?? null;
      contactMode = "created";
      if (!contactId) throw new Error("Kommo no devolvió id de contacto al crear");
    }

    // 6) Crear el lead enlazado al contacto + custom fields.
    const leadResp = await kommoWrite<HalList<KommoLead>>(
      baseUrl,
      token as string,
      "/api/v4/leads",
      "POST",
      [buildLeadPayload(client, contactId, fieldIds)],
    );
    const createdLead = leadResp?._embedded?.leads?.[0];
    if (!createdLead?.id) throw new Error("Kommo no devolvió id de lead al crear");

    // 7) Orden del FK (clients_kommo_lead_fk, migr 0108): el lead debe existir en el espejo
    //    ANTES de enlazarlo. Espejamos el lead AUTORITATIVO de la respuesta de Kommo (no fabricado
    //    → consistente con el guardrail 0107; el webhook/sync lo refresca idempotente luego).
    const { error: mirrorErr } = await supabase
      .from("kommo_leads")
      .upsert(mapLeadRow(createdLead, tenant_id), { onConflict: "tenant_id,id" });
    if (mirrorErr) throw new Error(`espejo kommo_leads: ${mirrorErr.message}`);

    const { error: linkErr } = await supabase
      .from("clients")
      .update({ kommo_lead_id: createdLead.id })
      .eq("tenant_id", tenant_id)
      .eq("id", client_id);
    if (linkErr) throw new Error(`enlace clients.kommo_lead_id: ${linkErr.message}`);

    await logResult(conn.id, "ok", { records_upserted: 1 });
    return json({ lead_id: createdLead.id, contact_id: contactId, mode: "created", contact: contactMode });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await logResult(null, "error", { error_detail: detail });
    return json({ error: detail }, 500);
  }
});

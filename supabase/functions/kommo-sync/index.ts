// SDD-0043 · Edge Function kommo-sync (Alcance A, read-only).
// POST { tenant_id } → autentica con Kommo (token desde Vault) y espeja
// pipelines/statuses/custom_fields/contacts/leads a Supabase, registrando en sync_logs.
// Invocación manual con el SERVICE_ROLE key (uso backend; nunca desde el frontend).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { syncAll } from "./sync.ts";
import type { KommoConnection } from "./types.ts";

// CORS estándar (invocación manual / futuras llamadas).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Usá POST" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  // Auth: la función va con verify_jwt=OFF (las keys nuevas sb_secret_*/sb_publishable_*
  // NO son JWT → el gateway las rechazaría). Exigimos el SECRET key del proyecto en
  // Authorization o apikey (uso backend; la publishable/anon no sirve).
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apikey = (req.headers.get("apikey") ?? "").trim();
  if (bearer !== SERVICE_ROLE && apikey !== SERVICE_ROLE) {
    return json({ error: "Forbidden: requiere el service key del proyecto" }, 403);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  let body: { tenant_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON inválido" }, 400);
  }
  const tenant_id = body?.tenant_id;
  if (!tenant_id) return json({ error: "Falta tenant_id" }, 400);

  // 1) Conexión del tenant
  const { data: conn, error: connErr } = await supabase
    .from("kommo_connections")
    .select("id, tenant_id, subdomain, domain, status")
    .eq("tenant_id", tenant_id)
    .maybeSingle<KommoConnection>();
  if (connErr) return json({ error: `kommo_connections: ${connErr.message}` }, 500);
  if (!conn) return json({ error: "No hay kommo_connections para ese tenant_id" }, 404);
  if (conn.status !== "active") {
    return json({ error: `Conexión en estado "${conn.status}"` }, 409);
  }

  // 2) Token desde Vault (solo service_role puede ejecutar kommo_get_token)
  const { data: token, error: tokErr } = await supabase.rpc("kommo_get_token", {
    p_connection_id: conn.id,
  });
  if (tokErr) return json({ error: `kommo_get_token: ${tokErr.message}` }, 500);
  if (!token) return json({ error: "Token no encontrado en Vault" }, 500);

  // 3) Sync
  const started = new Date().toISOString();
  try {
    const results = await syncAll(supabase, conn, token as string);
    const ok = results.every((r) => r.status === "ok");
    await supabase
      .from("kommo_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        status: ok ? "active" : "error",
        last_error: ok
          ? null
          : results
              .filter((r) => r.status === "error")
              .map((r) => `${r.entity}: ${r.error}`)
              .join(" | "),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id);
    // 207 si alguna entidad falló pero otras pasaron.
    return json({ tenant_id, started, finished: new Date().toISOString(), results }, ok ? 200 : 207);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await supabase
      .from("kommo_connections")
      .update({ status: "error", last_error: detail, updated_at: new Date().toISOString() })
      .eq("id", conn.id);
    return json({ error: detail }, 500);
  }
});

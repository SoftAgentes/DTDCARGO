// SDD-0083 · Edge Function kommo-writeback — drena la outbox de write-back ERP→Kommo.
//
// POST { tenant_id, dry_run? } → toma los pendientes de kommo_writeback_outbox y, por cada uno,
// hace PATCH /api/v4/leads/{id} con el payload encolado (ej { price }). El ERP nunca escribe a
// Kommo directo: solo encola; esta función drena con el token de Vault (modelo SDD-0043).
//
// GATE DE ESCRITURA (nace apagado, SDD-0062): escribe de verdad SOLO si
//   kommo_connections.writeback_enabled = true AND writeback_dry_run = false (y el body no fuerza
//   dry_run). En cualquier otro caso es DRY-RUN: loguea el PATCH que haría y marca la fila 'skipped'.
//
// Guardrail 0107: NUNCA tocamos el espejo (kommo_leads). El PATCH va a Kommo; el webhook de Kommo
// reespeja el lead con su kommo_updated_at autoritativo. kommoWrite reintenta SOLO 429 (no 5xx →
// evita PATCH duplicados, aunque PATCH es idempotente; mismo criterio que el resto del write-path).
//
// Auth: igual que kommo-sync / kommo-push-client (verify_jwt=OFF; exige el SERVICE_ROLE del proyecto).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { kommoWrite, RATE_LIMIT_DELAY_MS, sleep } from "../kommo-sync/kommo-client.ts";

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

const DRAIN_BATCH = 100;

interface OutboxRow {
  id: string;
  kommo_lead_id: number;
  op: string;
  payload: Record<string, unknown>;
}

interface ConnRow {
  id: string;
  subdomain: string;
  domain: string;
  status: string;
  writeback_enabled: boolean;
  writeback_dry_run: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Usá POST" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apikey = (req.headers.get("apikey") ?? "").trim();
  if (bearer !== SERVICE_ROLE && apikey !== SERVICE_ROLE) {
    return json({ error: "Forbidden: requiere el service key del proyecto" }, 403);
  }

  let body: { tenant_id?: string; dry_run?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON inválido" }, 400);
  }
  const { tenant_id } = body;
  if (!tenant_id) return json({ error: "Falta tenant_id" }, 400);

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const started_at = new Date().toISOString();

  try {
    // 1) Conexión + gate de escritura + token (Vault).
    const { data: conn, error: connErr } = await supabase
      .from("kommo_connections")
      .select("id, subdomain, domain, status, writeback_enabled, writeback_dry_run")
      .eq("tenant_id", tenant_id)
      .maybeSingle<ConnRow>();
    if (connErr) return json({ error: `kommo_connections: ${connErr.message}` }, 500);
    if (!conn) return json({ error: "No hay kommo_connections para ese tenant_id" }, 404);
    if (conn.status !== "active") return json({ error: `Conexión en estado "${conn.status}"` }, 409);

    // Escribe de verdad SOLO si está habilitado, sin dry-run, y el body no lo fuerza.
    const willWrite = conn.writeback_enabled && !conn.writeback_dry_run && body.dry_run !== true;

    const { data: token, error: tokErr } = await supabase.rpc("kommo_get_token", {
      p_connection_id: conn.id,
    });
    if (tokErr) return json({ error: `kommo_get_token: ${tokErr.message}` }, 500);
    if (!token) return json({ error: "Token no encontrado en Vault" }, 500);
    const tk = token as string;
    const baseUrl = `https://${conn.subdomain}.${conn.domain}`;

    // 2) Pendientes (más viejos primero, hasta DRAIN_BATCH).
    const { data: rows, error: rowsErr } = await supabase
      .from("kommo_writeback_outbox")
      .select("id, kommo_lead_id, op, payload")
      .eq("tenant_id", tenant_id)
      .eq("status", "pending")
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(DRAIN_BATCH);
    if (rowsErr) return json({ error: `outbox: ${rowsErr.message}` }, 500);

    const pending = (rows ?? []) as OutboxRow[];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i++) {
      const row = pending[i];

      // DRY-RUN: no escribe. Loguea el PATCH que haría y marca 'skipped'.
      if (!willWrite) {
        console.log("[kommo-writeback][dry-run] would PATCH lead", row.kommo_lead_id, row.op, row.payload);
        await supabase.rpc("mark_kommo_writeback_skipped", { p_id: row.id, p_reason: "dry-run" });
        skipped++;
        continue;
      }

      try {
        if (i > 0) await sleep(RATE_LIMIT_DELAY_MS); // respeta el rate limit de Kommo
        await kommoWrite(baseUrl, tk, `/api/v4/leads/${row.kommo_lead_id}`, "PATCH", row.payload);
        await supabase.rpc("mark_kommo_writeback_sent", { p_id: row.id });
        sent++;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        await supabase.rpc("bump_kommo_writeback_attempt", { p_id: row.id, p_error: detail });
        failed++;
      }
    }

    // 3) Log de la corrida.
    await supabase.from("sync_logs").insert({
      tenant_id,
      connection_id: conn.id,
      entity: willWrite ? "writeback" : "writeback_dryrun",
      started_at,
      finished_at: new Date().toISOString(),
      status: failed > 0 ? "error" : "ok",
      records_fetched: pending.length,
      records_upserted: sent,
      error_detail: failed > 0 ? `${failed} PATCH fallaron` : null,
    });

    return json({ processed: pending.length, sent, skipped, failed, dry_run: !willWrite });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await supabase.from("sync_logs").insert({
      tenant_id,
      connection_id: null,
      entity: "writeback",
      started_at,
      finished_at: new Date().toISOString(),
      status: "error",
      records_fetched: 0,
      records_upserted: 0,
      error_detail: detail,
    });
    return json({ error: detail }, 500);
  }
});

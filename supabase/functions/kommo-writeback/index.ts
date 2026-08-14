// SDD-0083 · Edge Function kommo-writeback — drena la outbox de write-back ERP→Kommo.
//
// POST { tenant_id, dry_run? } → toma los pendientes de kommo_writeback_outbox y, por cada uno,
// le pega a Kommo con el método y la ruta que le corresponden a su op (`resolveRequest`). El ERP
// nunca escribe a Kommo directo: solo encola; esta función drena con el token de Vault
// (modelo SDD-0043).
//
// GATE DE ESCRITURA (nace apagado, SDD-0062): escribe de verdad SOLO si
//   kommo_connections.writeback_enabled = true AND writeback_dry_run = false (y el body no fuerza
//   dry_run). En cualquier otro caso es DRY-RUN: loguea lo que haría y marca la fila 'skipped'.
//
// Guardrail 0107: NUNCA tocamos el espejo (kommo_leads). Escribimos a Kommo; el webhook de Kommo
// re-espeja el lead con su kommo_updated_at autoritativo. kommoWrite reintenta SOLO 429 (no 5xx →
// evita duplicados; con los POST de la Fase 5 eso dejaría dos notas).
//
// ⭐ SDD-0256 · Fase 4 (A1) — CHEQUEO OPTIMISTA. Antes de pisar un lead se compara su
// `updated_at` VIVO contra el que se selló al encolar. Si el asesor lo movió en Kommo mientras la
// orden viajaba, la fila sale `skipped` con motivo legible en vez de pisarle el trabajo y salir
// `sent` como si todo hubiera ido bien. Toda la decisión vive en `_shared/kommo-writeback-plan.ts`,
// que es puro y está cubierto por tests — acá abajo sólo queda el I/O.
//
// Auth: igual que kommo-sync / kommo-push-client (verify_jwt=OFF; exige el SERVICE_ROLE del proyecto).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { kommoFetch, kommoWrite, RATE_LIMIT_DELAY_MS, sleep } from "../kommo-sync/kommo-client.ts";
import {
  esOpReintentable,
  evaluarChequeoOptimista,
  resolveRequest,
  type OutboxRow,
} from "../_shared/kommo-writeback-plan.ts";

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

interface ConnRow {
  id: string;
  subdomain: string;
  domain: string;
  status: string;
  writeback_enabled: boolean;
  writeback_dry_run: boolean;
}

/** Lo que Kommo devuelve de un lead cuando sólo nos interesa su reloj. */
interface LeadReloj {
  id?: number;
  updated_at?: number;
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

    // 2a) Soltar lo que quedó colgado de una corrida que murió a mitad. Va
    // ANTES de reservar para que esas filas entren en este mismo lote.
    const { data: reaped, error: reapErr } = await supabase.rpc(
      "reap_kommo_writeback_stale",
      { p_tenant_id: tenant_id, p_older: "10 minutes" },
    );
    if (reapErr) return json({ error: `reaper: ${reapErr.message}` }, 500);
    if (Number(reaped ?? 0) > 0) {
      console.log("[kommo-writeback] reservas vencidas soltadas:", reaped);
    }

    // 2b) RESERVAR el lote (no sólo leerlo). `claim_…` pasa las filas a
    // 'processing' con FOR UPDATE SKIP LOCKED, así que si el cron y el nudge
    // corren a la vez se reparten el trabajo en vez de procesar lo mismo dos
    // veces. Con PATCH duplicar es inocuo; con los POST de la Fase 5 crearía
    // notas repetidas.
    const { data: rows, error: rowsErr } = await supabase.rpc(
      "claim_kommo_writeback_batch",
      { p_tenant_id: tenant_id, p_limit: DRAIN_BATCH },
    );
    if (rowsErr) return json({ error: `outbox claim: ${rowsErr.message}` }, 500);

    const pending = (rows ?? []) as OutboxRow[];

    // 2c) El ECO de lo que ESTE ERP ya escribió en cada lead del lote. Sin esto,
    // dos verbos seguidos sobre el mismo lead (mover de etapa y después
    // etiquetar, antes de que vuelva el webhook) harían que el segundo se
    // saltee por un cambio que causamos nosotros. Una sola query para el lote.
    const leadIds = [...new Set(pending.map((r) => r.kommo_lead_id).filter((v): v is number => v != null))];
    const ecoPorLead = new Map<number, number>();
    if (leadIds.length > 0) {
      const { data: ecos } = await supabase
        .from("kommo_writeback_echo")
        .select("kommo_lead_id, kommo_updated_at")
        .eq("tenant_id", tenant_id)
        .in("kommo_lead_id", leadIds);
      for (const e of (ecos as { kommo_lead_id: number; kommo_updated_at: string }[] | null) ?? []) {
        const s = Math.floor(Date.parse(e.kommo_updated_at) / 1000);
        if (Number.isFinite(s)) ecoPorLead.set(Number(e.kommo_lead_id), s);
      }
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let pisadasEvitadas = 0;
    let llamadas = 0; // para respetar el rate limit contando TODO, no sólo filas

    /** Espacia las llamadas a Kommo (~6.6 req/s). El GET del chequeo cuenta. */
    const respirar = async () => {
      if (llamadas > 0) await sleep(RATE_LIMIT_DELAY_MS);
      llamadas++;
    };

    for (const row of pending) {
      const req = resolveRequest(row);
      if ("skip" in req) {
        await supabase.rpc("mark_kommo_writeback_skipped", {
          p_id: row.id,
          p_reason: req.skip,
          p_code: "sin_destino",
        });
        skipped++;
        continue;
      }

      // DRY-RUN: no escribe. Loguea lo que haría y marca 'skipped'.
      if (!willWrite) {
        console.log("[kommo-writeback][dry-run] would", req.method, req.path, row.op, row.payload);
        await supabase.rpc("mark_kommo_writeback_skipped", {
          p_id: row.id,
          p_reason: "dry-run",
          p_code: "dry_run",
        });
        skipped++;
        continue;
      }

      try {
        // ── A1 · ¿alguien tocó el lead desde que se encoló esto? ────────────
        //
        // Sólo para las ops que PISAN estado y que traen snapshot: un POST no
        // pisa nada y un lead sin snapshot no tiene con qué compararse. Así el
        // GET extra no se paga cuando no aporta.
        const debeChequear =
          esOpReintentable(row.op) &&
          row.op !== "patch_contact" &&
          row.kommo_lead_id != null &&
          Boolean(row.kommo_updated_at_at_enqueue);

        if (debeChequear) {
          let vivo: number | null = null;
          try {
            await respirar();
            const lead = await kommoFetch<LeadReloj>(
              baseUrl,
              tk,
              `/api/v4/leads/${row.kommo_lead_id}`,
            );
            vivo = Number(lead?.updated_at) || null;
          } catch (e) {
            // Fail-open: si no se pudo leer el lead, se manda igual. El propio
            // write-back va a fallar con un error legible si el lead no existe;
            // negar por un hipo de red convertiría el verbo en algo que a veces
            // no hace nada, que es peor que el problema que esto resuelve.
            console.warn("[kommo-writeback] no se pudo leer el lead vivo:", String(e));
          }

          const veredicto = evaluarChequeoOptimista({
            op: row.op,
            enqueuedAt: row.kommo_updated_at_at_enqueue,
            liveUpdatedAt: vivo,
            echoUpdatedAt: ecoPorLead.get(Number(row.kommo_lead_id)) ?? null,
          });

          if (!veredicto.pisar) {
            console.log("[kommo-writeback] no se pisa:", row.op, row.kommo_lead_id, veredicto.motivo);
            await supabase.rpc("mark_kommo_writeback_skipped", {
              p_id: row.id,
              p_reason: veredicto.motivo,
              p_code: "stale",
            });
            skipped++;
            pisadasEvitadas++;
            continue;
          }
        }

        // ── El envío ────────────────────────────────────────────────────────
        // Kommo espera un ARRAY en los endpoints de creación y un OBJETO en los
        // PATCH de entidad; el payload se encola siempre como objeto (así la
        // fusión jsonb puede razonar sobre él) y se envuelve acá, en el borde.
        await respirar();
        const cuerpo = req.envolverEnArray ? [row.payload] : row.payload;
        const resp = await kommoWrite<LeadReloj>(baseUrl, tk, req.path, req.method, cuerpo);

        // Sellar el eco: el `updated_at` que dejó NUESTRA escritura, para que el
        // próximo chequeo no lo confunda con un cambio del asesor. Sólo aplica a
        // los PATCH de lead: un POST de nota/tarea no responde con el lead.
        if (req.method === "PATCH" && row.kommo_lead_id != null) {
          const eco = Number(resp?.updated_at) || null;
          if (eco != null) {
            ecoPorLead.set(Number(row.kommo_lead_id), eco);
            await supabase.rpc("record_kommo_writeback_echo", {
              p_tenant_id: tenant_id,
              p_kommo_lead_id: row.kommo_lead_id,
              p_kommo_updated_at: new Date(eco * 1000).toISOString(),
            });
          }
        }

        await supabase.rpc("mark_kommo_writeback_sent", { p_id: row.id });
        sent++;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        // `record_…` y NO `bump_…`: el intento ya lo contó el claim. Bumpear acá
        // contaría doble cada reintento y la fila se rendiría a los 2-3 tries.
        // Desde la 0377, `record_…` manda los POST directo a `error`: repetir un
        // POST crea otra nota.
        await supabase.rpc("record_kommo_writeback_error", { p_id: row.id, p_error: detail });
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
      error_detail: failed > 0 ? `${failed} envíos fallaron` : null,
    });

    return json({
      processed: pending.length,
      sent,
      skipped,
      failed,
      pisadas_evitadas: pisadasEvitadas,
      dry_run: !willWrite,
    });
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

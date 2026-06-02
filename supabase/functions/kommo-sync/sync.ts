// SDD-0043 · orquestación del sync read-only Kommo → tablas espejo.
// M3: UPSERT idempotente por (tenant_id, id). Cada entidad registra una fila en sync_logs.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  kommoFetch,
  paginateTwoPass,
  RATE_LIMIT_DELAY_MS,
  sleep,
} from "./kommo-client.ts";
import type {
  EntityResult,
  HalList,
  KommoConnection,
  KommoContact,
  KommoCustomField,
  KommoLead,
  KommoPipeline,
} from "./types.ts";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const epochToIso = (s?: number | null) =>
  s ? new Date(s * 1000).toISOString() : null;

/** M3 — upsert por chunks, idempotente por onConflict. Refresca synced_at en cada corrida. */
async function upsertRows(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "tenant_id,id",
): Promise<number> {
  if (rows.length === 0) return 0;
  const syncedAt = new Date().toISOString();
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows
      .slice(i, i + CHUNK)
      .map((r) => ({ ...r, synced_at: syncedAt }));
    const { error, count } = await supabase
      .from(table)
      .upsert(chunk, { onConflict, count: "exact", ignoreDuplicates: false });
    if (error) throw new Error(`${table}: ${error.message}`);
    total += count ?? chunk.length;
  }
  return total;
}

/** Ejecuta una entidad y registra el resultado en sync_logs (ok/error). Nunca lanza. */
async function logged(
  supabase: SupabaseClient,
  conn: KommoConnection,
  entity: string,
  fn: () => Promise<{ fetched: number; upserted: number }>,
): Promise<EntityResult> {
  const started_at = new Date().toISOString();
  try {
    const { fetched, upserted } = await fn();
    await supabase.from("sync_logs").insert({
      tenant_id: conn.tenant_id,
      connection_id: conn.id,
      entity,
      started_at,
      finished_at: new Date().toISOString(),
      records_fetched: fetched,
      records_upserted: upserted,
      status: "ok",
    });
    return { entity, status: "ok", fetched, upserted };
  } catch (e) {
    await supabase.from("sync_logs").insert({
      tenant_id: conn.tenant_id,
      connection_id: conn.id,
      entity,
      started_at,
      finished_at: new Date().toISOString(),
      status: "error",
      error_detail: errMsg(e),
    });
    return { entity, status: "error", error: errMsg(e) };
  }
}

export async function syncAll(
  supabase: SupabaseClient,
  conn: KommoConnection,
  token: string,
): Promise<EntityResult[]> {
  const baseUrl = `https://${conn.subdomain}.${conn.domain}`;
  const t = conn.tenant_id;
  const results: EntityResult[] = [];

  // 1) Pipelines + statuses (1 fetch a /leads/pipelines; statuses vienen embebidos)
  let pipelines: KommoPipeline[] = [];
  results.push(
    await logged(supabase, conn, "pipelines", async () => {
      const data = await kommoFetch<HalList<KommoPipeline>>(
        baseUrl,
        token,
        "/api/v4/leads/pipelines",
      );
      pipelines = data?._embedded?.pipelines ?? [];
      const rows = pipelines.map((p) => ({
        tenant_id: t,
        id: p.id,
        name: p.name ?? null,
        sort: p.sort ?? null,
        is_main: p.is_main ?? false,
      }));
      return {
        fetched: pipelines.length,
        upserted: await upsertRows(supabase, "kommo_pipelines", rows),
      };
    }),
  );
  results.push(
    await logged(supabase, conn, "statuses", async () => {
      // 142 "ganado" / 143 "perdido" se repiten en cada pipeline con el mismo id:
      // dedupe por (pipeline_id, id) y upsert con la PK compuesta (migración 0083).
      const seen = new Set<string>();
      const rows = pipelines
        .flatMap((p) =>
          (p._embedded?.statuses ?? []).map((s) => ({
            tenant_id: t,
            id: s.id,
            pipeline_id: s.pipeline_id ?? p.id,
            name: s.name ?? null,
            sort: s.sort ?? null,
            color: s.color ?? null,
            type: s.type ?? null,
          })),
        )
        .filter((r) => {
          const k = `${r.pipeline_id}:${r.id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      return {
        fetched: rows.length,
        upserted: await upsertRows(
          supabase,
          "kommo_statuses",
          rows,
          "tenant_id,pipeline_id,id",
        ),
      };
    }),
  );
  await sleep(RATE_LIMIT_DELAY_MS);

  // 2) Definiciones de custom fields (leads + contacts)
  results.push(
    await logged(supabase, conn, "custom_fields", async () => {
      let fetched = 0;
      let upserted = 0;
      for (const et of ["leads", "contacts"] as const) {
        const data = await kommoFetch<HalList<KommoCustomField>>(
          baseUrl,
          token,
          `/api/v4/${et}/custom_fields?limit=250`,
        );
        const fields = data?._embedded?.custom_fields ?? [];
        const rows = fields.map((f) => ({
          tenant_id: t,
          id: f.id,
          entity_type: et,
          name: f.name ?? null,
          type: f.type ?? null,
          code: f.code ?? null,
          enums: f.enums ?? null,
        }));
        fetched += fields.length;
        upserted += await upsertRows(
          supabase,
          "kommo_custom_fields",
          rows,
          "tenant_id,entity_type,id",
        );
        await sleep(RATE_LIMIT_DELAY_MS);
      }
      return { fetched, upserted };
    }),
  );

  // 3) Contactos
  results.push(
    await logged(supabase, conn, "contacts", async () => {
      const items = await paginateTwoPass<KommoContact>(
        baseUrl,
        token,
        "contacts",
      );
      const rows = items.map((c) => ({
        tenant_id: t,
        id: c.id,
        name: c.name ?? null,
        responsible_user_id: c.responsible_user_id ?? null,
        kommo_created_at: epochToIso(c.created_at),
        kommo_updated_at: epochToIso(c.updated_at),
        custom_fields: c.custom_fields_values ?? [],
      }));
      return {
        fetched: items.length,
        upserted: await upsertRows(supabase, "kommo_contacts", rows),
      };
    }),
  );

  // 4) Leads
  results.push(
    await logged(supabase, conn, "leads", async () => {
      const items = await paginateTwoPass<KommoLead>(baseUrl, token, "leads");
      const rows = items.map((l) => ({
        tenant_id: t,
        id: l.id,
        name: l.name ?? null,
        status_id: l.status_id ?? null,
        pipeline_id: l.pipeline_id ?? null,
        price: l.price ?? null,
        responsible_user_id: l.responsible_user_id ?? null,
        kommo_created_at: epochToIso(l.created_at),
        kommo_updated_at: epochToIso(l.updated_at),
        closed_at: epochToIso(l.closed_at),
        custom_fields: l.custom_fields_values ?? [],
      }));
      return {
        fetched: items.length,
        upserted: await upsertRows(supabase, "kommo_leads", rows),
      };
    }),
  );

  return results;
}

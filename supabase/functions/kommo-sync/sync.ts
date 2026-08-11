// SDD-0043 · orquestación del sync read-only Kommo → tablas espejo.
// M3: UPSERT idempotente por (tenant_id, id). Cada entidad registra una fila en sync_logs.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  kommoFetch,
  paginateTwoPass,
  paginateUnsorted,
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
  KommoUnsorted,
  KommoUser,
} from "./types.ts";
// SDD-0043 Alcance B · mapeo compartido (single source of truth con kommo-webhook + Vitest).
import {
  epochToIso,
  mapContactRow,
  mapLeadContactLinks,
  mapLeadRow,
} from "../_shared/kommo-mapping.ts";
import {
  pipelinesToPrune,
  statusesToPrune,
  type StatusRef,
} from "../_shared/kommo-prune.ts";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Tope al leer el espejo de embudos/etapas. Si una lectura vuelve EXACTA en el
 * tope no podemos saber si había más, así que no se poda: preferimos dejar
 * basura a borrar lo que no vimos. (Realista: hoy son 12 y ~77 filas.)
 */
const MIRROR_READ_CAP = 500;

/**
 * ¿Hay AL MENOS UN lead espejado que apunte acá?
 *
 * `limit(1)` a propósito: PostgREST corta las respuestas en `db-max-rows`
 * (1000), así que "traer los leads y mirar" puede devolver una lista corta y
 * hacer creer que un embudo está vacío cuando no lo está — el mismo truncamiento
 * silencioso que hacía mentir al tablero. Preguntar por la EXISTENCIA de una
 * fila es inmune a cualquier tope.
 */
async function hasLeads(
  supabase: SupabaseClient,
  tenantId: string,
  filter: { pipeline_id: number; status_id?: number },
): Promise<boolean> {
  let q = supabase
    .from("kommo_leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("pipeline_id", filter.pipeline_id);
  if (filter.status_id != null) q = q.eq("status_id", filter.status_id);
  const { data, error } = await q.limit(1);
  if (error) throw new Error(`kommo_leads (guarda de poda): ${error.message}`);
  return ((data as unknown[] | null) ?? []).length > 0;
}

/** M3 — upsert por chunks, idempotente por onConflict. Refresca synced_at en cada corrida. */
export async function upsertRows(
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

/**
 * Igual que `logged`, pero la falla NO tumba la corrida.
 *
 * Para trabajo de LIMPIEZA (la poda). El motivo es el radio de explosión:
 * `index.ts` marca `kommo_connections.status = 'error'` si CUALQUIER entidad
 * falla, y con la conexión en 'error' se niegan con 409 el sync, **el drenaje
 * del write-back** y el push de altas. Dejar que una tarea de mantenimiento
 * cosmética pueda apagar el canal que lleva el Shipping Mark a Kommo es
 * desproporcionado — y es el modo de falla de SDD-0195, donde un hipo de red
 * mató el sync y nadie se enteró en 13 días.
 *
 * El error igual queda escrito en `sync_logs` con status 'error', así que es
 * visible y greppable; lo que no hace es contaminar el veredicto de la corrida.
 */
async function loggedJanitorial(
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
    // 'ok' a propósito: ver el comentario de arriba. El detalle está en sync_logs.
    return { entity, status: "ok", fetched: 0, upserted: 0 };
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
  let fetchedStatuses: StatusRef[] = [];
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
      fetchedStatuses = rows.map((r) => ({
        pipeline_id: Number(r.pipeline_id),
        id: Number(r.id),
      }));
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

  // 1b) PODA de embudos y etapas que Kommo ya no tiene.
  //
  // El sync es upsert-only y nunca borraba: al 2026-08-11 el espejo cargaba 12
  // embudos (11 eliminados en Kommo al consolidar en "Ventas DTD") y 68 etapas
  // huérfanas. Eso llenaba de opciones muertas el selector del Tablero y el Mapa
  // de etapas. Las dos guardas viven en `_shared/kommo-prune.ts`: lectura vacía
  // no borra nada, y nada que tenga leads espejados se toca.
  results.push(
    await loggedJanitorial(supabase, conn, "pipelines_prune", async () => {
      const { data: mirroredRaw, error } = await supabase
        .from("kommo_pipelines")
        .select("id")
        .eq("tenant_id", t)
        .limit(MIRROR_READ_CAP);
      if (error) throw new Error(`kommo_pipelines: ${error.message}`);
      const mirrored = (mirroredRaw as { id: number }[] | null) ?? [];
      // Lectura que topa el cap: no sabemos si vimos todo → no podamos.
      if (mirrored.length >= MIRROR_READ_CAP) return { fetched: 0, upserted: 0 };

      const candidates = pipelinesToPrune(pipelines, mirrored);
      let deleted = 0;
      for (const id of candidates) {
        if (await hasLeads(supabase, t, { pipeline_id: id })) continue; // guarda 2
        const { error: delErr } = await supabase
          .from("kommo_pipelines")
          .delete()
          .eq("tenant_id", t)
          .eq("id", id);
        if (delErr) throw new Error(`kommo_pipelines poda: ${delErr.message}`);
        deleted++;
        // Las etapas del embudo se van con él. Si el embudo no tiene leads,
        // ninguna de sus etapas puede tenerlos — no hace falta re-chequear.
        const { error: sErr } = await supabase
          .from("kommo_statuses")
          .delete()
          .eq("tenant_id", t)
          .eq("pipeline_id", id);
        if (sErr) throw new Error(`kommo_statuses poda (embudo): ${sErr.message}`);
      }
      return { fetched: candidates.length, upserted: deleted };
    }),
  );

  results.push(
    await loggedJanitorial(supabase, conn, "statuses_prune", async () => {
      const { data: mirroredRaw, error } = await supabase
        .from("kommo_statuses")
        .select("pipeline_id, id")
        .eq("tenant_id", t)
        .limit(MIRROR_READ_CAP);
      if (error) throw new Error(`kommo_statuses: ${error.message}`);
      const mirrored = (mirroredRaw as StatusRef[] | null) ?? [];
      if (mirrored.length >= MIRROR_READ_CAP) return { fetched: 0, upserted: 0 };

      // Acá sólo quedan etapas de embudos VIVOS que Kommo dejó de devolver
      // (las de embudos borrados ya cayeron arriba). Ésas sí se re-chequean:
      // un lead puede estar parado en una etapa que el asesor acaba de borrar.
      const candidates = statusesToPrune(fetchedStatuses, mirrored);
      let deleted = 0;
      for (const s of candidates) {
        if (await hasLeads(supabase, t, { pipeline_id: s.pipeline_id, status_id: s.id })) {
          continue; // guarda 2
        }
        const { error: delErr } = await supabase
          .from("kommo_statuses")
          .delete()
          .eq("tenant_id", t)
          .eq("pipeline_id", s.pipeline_id)
          .eq("id", s.id);
        if (delErr) throw new Error(`kommo_statuses poda: ${delErr.message}`);
        deleted++;
      }
      return { fetched: candidates.length, upserted: deleted };
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
      const rows = items.map((c) => mapContactRow(c, t));
      return {
        fetched: items.length,
        upserted: await upsertRows(supabase, "kommo_contacts", rows),
      };
    }),
  );

  // 4) Leads — con `with=contacts` para traer el vínculo lead↔contacto.
  //
  // Sin ese embed, `kommo_leads` sólo tiene `name` y no hay forma de mostrar un
  // teléfono al lado de un lead (el teléfono vive en `kommo_contacts`). El embed
  // viaja dentro de las MISMAS páginas: cero requests extra.
  let leadLinkRows: { lead_id: number; updated_at: string | null; links: unknown }[] = [];
  results.push(
    await logged(supabase, conn, "leads", async () => {
      const items = await paginateTwoPass<KommoLead>(baseUrl, token, "leads", "contacts");
      const rows = items.map((l) => mapLeadRow(l, t));
      const upserted = await upsertRows(supabase, "kommo_leads", rows);
      // Se arma acá pero se escribe en su propia entidad: el espejo de leads no
      // debe fallar porque los vínculos fallen.
      leadLinkRows = items.map((l) => ({
        lead_id: l.id,
        updated_at: epochToIso(l.updated_at),
        links: mapLeadContactLinks(l as { _embedded?: { contacts?: { id: number }[] } }),
      }));
      return { fetched: items.length, upserted };
    }),
  );

  // 4a) Vínculos lead↔contacto. Janitorial: si esto falla, el espejo de leads ya
  // quedó bien y la integración NO se apaga (ver loggedJanitorial).
  results.push(
    await loggedJanitorial(supabase, conn, "lead_contacts", async () => {
      if (leadLinkRows.length === 0) return { fetched: 0, upserted: 0 };
      // Por lotes: 3.100 leads serían 3.100 round-trips uno por uno.
      const CHUNK = 500;
      let written = 0;
      for (let i = 0; i < leadLinkRows.length; i += CHUNK) {
        const { data, error } = await supabase.rpc("kommo_replace_lead_contacts_bulk", {
          p_tenant_id: t,
          p_rows: leadLinkRows.slice(i, i + CHUNK),
        });
        if (error) throw new Error(`kommo_replace_lead_contacts_bulk: ${error.message}`);
        written += Number(data ?? 0);
      }
      return { fetched: leadLinkRows.length, upserted: written };
    }),
  );

  // 4b) Bandeja de entrada — leads que llegaron y NADIE acepto todavia (SDD-0245).
  // `/api/v4/leads` NO los devuelve, asi que sin esto el ERP mide sobre una
  // fraccion del embudo (medido 2026-08-03: 8 de 11 leads del dia, invisibles).
  await sleep(RATE_LIMIT_DELAY_MS);
  results.push(
    await logged(supabase, conn, "unsorted", async () => {
      // Marca de agua ANTES del upsert: todo lo que siga vivo quedara con
      // synced_at >= runAt, y lo que ya no este en Kommo quedara por debajo.
      const runAt = new Date().toISOString();

      const { items, truncated } = await paginateUnsorted<KommoUnsorted>(
        baseUrl,
        token,
      );

      const rows = items.map((u) => ({
        tenant_id: t,
        uid: u.uid,
        category: u.category ?? null,
        source_name: u.source_name ?? null,
        pipeline_id: u.pipeline_id ?? null,
        lead_id: u._embedded?.leads?.[0]?.id ?? null,
        contact_id: u._embedded?.contacts?.[0]?.id ?? null,
        kommo_created_at: u.created_at
          ? new Date(u.created_at * 1000).toISOString()
          : null,
        raw: u,
      }));

      const upserted = await upsertRows(
        supabase,
        "kommo_unsorted",
        rows,
        "tenant_id,uid",
      );

      // La bandeja es una COLA que drena: lo aceptado/rechazado desaparece de
      // Kommo y debe desaparecer del espejo, o el conteo miente al alza.
      //
      // ⚠️ Solo se drena si la lectura fue COMPLETA. Con la cola truncada por el
      // tope de paginas, lo que no vimos no esta "aceptado" — esta mas alla de la
      // pagina 20, y borrarlo seria inventar que ya no existe.
      if (!truncated) {
        const { error } = await supabase
          .from("kommo_unsorted")
          .delete()
          .eq("tenant_id", t)
          .lt("synced_at", runAt);
        if (error) throw new Error(`kommo_unsorted drenaje: ${error.message}`);
      }

      if (truncated) {
        // No es un `ok` limpio: el conteo es un piso, no un total.
        throw new Error(
          `bandeja truncada en el tope de ${items.length} entradas: hay mas sin espejar`,
        );
      }

      return { fetched: items.length, upserted };
    }),
  );

  // 5) Usuarios (asesores) — para mostrar nombres en el tablero (SDD-0087).
  // Los usuarios de Kommo son pocos; un fetch con limit=250 alcanza (no paginamos).
  await sleep(RATE_LIMIT_DELAY_MS);
  results.push(
    await logged(supabase, conn, "users", async () => {
      const data = await kommoFetch<HalList<KommoUser>>(
        baseUrl,
        token,
        "/api/v4/users?limit=250",
      );
      const users = data?._embedded?.users ?? [];
      const rows = users.map((u) => ({
        tenant_id: t,
        id: u.id,
        name: u.name ?? null,
        email: u.email ?? null,
      }));
      return {
        fetched: users.length,
        upserted: await upsertRows(supabase, "kommo_users", rows),
      };
    }),
  );

  return results;
}

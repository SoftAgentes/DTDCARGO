import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EstadoVersiones, ErrorVersiones, ReleaseChatwoot, ResultadoVersiones } from "./versiones";

/**
 * Lecturas y escrituras de las tablas de versiones (0507, SDD-0588).
 *
 * - `chatwoot_version_checks`: la escribe solo service_role (cron y «Revisar
 *   ahora», con el cliente admin); la lee el admin del tenant.
 * - `chatwoot_update_requests`: la escribe el admin con SU cliente (la RLS exige
 *   admin, su tenant y requested_by = auth.uid()).
 *
 * Sin la 0507 (pendiente) las lecturas devuelven null o [] y las escrituras
 * devuelven error: la pantalla dice «sin datos» y el cron responde `omitido`.
 */

export interface RevisionVersiones {
  id: number;
  revisada: string;
  estado: EstadoVersiones;
  instalada: string | null;
  disponible: string | null;
  pendientes: ReleaseChatwoot[];
  recortado: boolean;
  error: ErrorVersiones | null;
}

export interface PedidoActualizacion {
  id: number;
  desde: string;
  hasta: string;
  pedido: string;
  /** Es quien está mirando la pantalla. */
  propio: boolean;
}

interface FilaRevision {
  id: number;
  checked_at: string;
  status: EstadoVersiones;
  installed_version: string | null;
  latest_version: string | null;
  releases: unknown;
  truncated: boolean;
  error_code: ErrorVersiones | null;
}

const COLUMNAS = "id, checked_at, status, installed_version, latest_version, releases, truncated, error_code";

function aRevision(f: FilaRevision): RevisionVersiones {
  return {
    id: Number(f.id),
    revisada: f.checked_at,
    estado: f.status,
    instalada: f.installed_version,
    disponible: f.latest_version,
    pendientes: Array.isArray(f.releases) ? (f.releases as ReleaseChatwoot[]) : [],
    recortado: f.truncated,
    error: f.error_code,
  };
}

/** La revisión más reciente; con `sinError`, la más reciente que sí leyó las dos fuentes. */
export async function ultimaRevision(
  db: SupabaseClient,
  tenantId: string,
  opciones: { sinError?: boolean } = {},
): Promise<RevisionVersiones | null> {
  let consulta = db.from("chatwoot_version_checks").select(COLUMNAS).eq("tenant_id", tenantId);
  if (opciones.sinError) consulta = consulta.neq("status", "error");
  const { data, error } = await consulta
    .order("checked_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<FilaRevision>();
  if (error || !data) return null;
  return aRevision(data);
}

/** Guarda una revisión (service_role). Devuelve la fila o null si no se pudo. */
export async function guardarRevision(
  admin: SupabaseClient,
  tenantId: string,
  r: ResultadoVersiones,
): Promise<RevisionVersiones | null> {
  const { data, error } = await admin
    .from("chatwoot_version_checks")
    .insert({
      tenant_id: tenantId,
      status: r.estado,
      installed_version: r.instalada,
      latest_version: r.disponible,
      releases: r.pendientes,
      truncated: r.recortado,
      error_code: r.error,
    })
    .select(COLUMNAS)
    .single<FilaRevision>();
  if (error || !data) {
    console.warn(`[chatwoot-versiones] no se guardó la revisión: ${error?.code ?? "sin código"}`);
    return null;
  }
  return aRevision(data);
}

/** Borra las revisiones de más de `dias` días (service_role). Los pedidos se quedan. */
export async function purgarRevisiones(admin: SupabaseClient, tenantId: string, dias = 180, ahora = new Date()): Promise<void> {
  const corte = new Date(ahora.getTime() - dias * 86_400_000).toISOString();
  const { error } = await admin.from("chatwoot_version_checks").delete().eq("tenant_id", tenantId).lt("checked_at", corte);
  if (error) console.warn(`[chatwoot-versiones] no se purgaron revisiones: ${error.code ?? "sin código"}`);
}

export async function listarPedidos(
  db: SupabaseClient,
  tenantId: string,
  usuarioId: string,
): Promise<PedidoActualizacion[]> {
  const { data, error } = await db
    .from("chatwoot_update_requests")
    .select("id, from_version, to_version, created_at, requested_by")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !Array.isArray(data)) return [];
  return (data as { id: number; from_version: string; to_version: string; created_at: string; requested_by: string | null }[]).map((f) => ({
    id: Number(f.id),
    desde: f.from_version,
    hasta: f.to_version,
    pedido: f.created_at,
    propio: f.requested_by === usuarioId,
  }));
}

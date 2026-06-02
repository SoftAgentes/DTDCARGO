/**
 * Queries del Portal del Cliente (SDD-0042). Funciones puras que reciben un
 * `SupabaseClient`.
 *
 * La RLS del portal (`get_portal_client_id()` / `get_portal_client_markbox()`)
 * ya restringe TODO a los datos del cliente logueado, así que estas queries no
 * agregan filtro de cliente — confían en la RLS (read-only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalClient, PortalShipmentRow } from "./portal-types";

/**
 * El cliente vinculado al `auth.uid()` actual (su propio registro `clients`).
 * Devuelve null si la sesión no está habilitada como portal (sin row activa en
 * client_users → la policy "clients portal self read" no matchea nada).
 *
 * `maybeSingle()` es seguro acá: en la superficie /portal el principal SIEMPRE
 * es un cliente, y la policy del portal devuelve exactamente SU fila (id =
 * get_portal_client_id()). No confundir con el patrón anti-maybeSingle de
 * user_tenants del Studio (otro principal, otra tabla).
 */
export async function getPortalClient(
  supabase: SupabaseClient,
): Promise<PortalClient | null> {
  // Resolver el client_id del portal vía la helper AISLADA primero. Si es null,
  // el principal NO es un cliente del portal (p.ej. un user de equipo con sesión
  // del Studio): cortamos acá. Si confiáramos solo en RLS con limit(1), la policy
  // "clients by tenant" le devolvería un cliente cualquiera del tenant al user de
  // equipo → fuga de aislamiento. El filtro explícito por id lo previene.
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("id, markbox, name, email, phone")
    .eq("id", portalClientId as string)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    markbox: data.markbox as string,
    name: data.name as string,
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
  };
}

/**
 * Envíos del cliente logueado (RLS por markbox), recientes primero.
 * Hasta 100; paginación real en una fase siguiente si hace falta.
 */
export async function listMyShipments(
  supabase: SupabaseClient,
): Promise<PortalShipmentRow[]> {
  const { data, error } = await supabase
    .from("shipments")
    .select("id, code, shipment_service, status, origin, destination, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    code: r.code as string,
    service: r.shipment_service as PortalShipmentRow["service"],
    status: r.status as PortalShipmentRow["status"],
    origin: (r.origin as string | null) ?? null,
    destination: (r.destination as string | null) ?? null,
    updatedAt: r.updated_at as string,
  }));
}

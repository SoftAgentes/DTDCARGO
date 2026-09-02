/**
 * Visibilidad de hitos en el stepper del portal (SDD-0156 · Slice D).
 *
 * La config de avisos (`client_notification_rules`) tiene una perilla
 * `visible_in_portal` por evento de status. Cuando un tenant la pone en `false`
 * para, por ejemplo, `status:in_customs`, ese hito se OCULTA del stepper del
 * cliente (el ejemplo del founder: no mostrar "llegó a aduana", disparar en su
 * lugar el cobro anticipado). La RPC resuelve el conjunto de statuses ocultos
 * respetando la precedencia override-por-cliente → default-del-tenant.
 *
 * Se llama con la sesión del Portal y deriva la identidad en la base. Sin regla
 * para un status → visible (default). Falla-seguro: ante error devuelve el set
 * vacío (se muestra todo), nunca oculta de más por un fallo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";

/**
 * Statuses ocultos para el cliente del Portal autenticado.
 *
 * La RPC deriva cliente y tenant desde `auth.uid()`; no acepta ids de entrada y
 * sólo devuelve el nombre de cada status oculto. Ante error muestra todo (set
 * vacío), que es la degradación segura ya vigente.
 */
export async function getHiddenPortalStatusesForPortal(
  db: SupabaseClient,
): Promise<Set<ShipmentStatus>> {
  try {
    const { data, error } = await db.rpc("get_portal_hidden_shipment_statuses");
    if (error || !Array.isArray(data)) return new Set();

    return new Set(
      data
        .map((row) => String((row as { status?: unknown }).status ?? "").trim())
        .filter(Boolean) as ShipmentStatus[],
    );
  } catch {
    return new Set();
  }
}

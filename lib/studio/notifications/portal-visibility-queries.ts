/**
 * Visibilidad de hitos en el stepper del portal (SDD-0156 · Slice D).
 *
 * La config de avisos (`client_notification_rules`) tiene una perilla
 * `visible_in_portal` por evento de status. Cuando un tenant la pone en `false`
 * para, por ejemplo, `status:in_customs`, ese hito se OCULTA del stepper del
 * cliente (el ejemplo del founder: no mostrar "llegó a aduana", disparar en su
 * lugar el cobro anticipado). Esta capa resuelve el conjunto de statuses ocultos
 * respetando la precedencia override-por-cliente → default-del-tenant.
 *
 * SDD-0337: el Portal (inicio, envíos y detalle) llama a
 * `getHiddenPortalStatusesForPortal` con su sesión; la RPC de la migración 0402
 * deriva cliente y tenant en la base. Las dos lecturas con admin client de más
 * abajo se conservan sin cambios. Sin regla para un status → visible (default).
 * Falla-seguro: ante error devuelve el set vacío (se muestra todo), nunca oculta
 * de más por un fallo. Sin la RPC ese error sería permanente; por eso 0402 se
 * aplica antes de desplegar este consumidor (migrate-first).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";

const STATUS_PREFIX = "status:";

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

/**
 * Conveniencia para el portal: resuelve el tenant del cliente (por su id) y
 * devuelve sus statuses ocultos. Falla-seguro → set vacío. Se llama con el admin
 * client (el cliente no lee la tabla de reglas).
 */
export async function getHiddenPortalStatusesForClient(
  admin: SupabaseClient,
  clientId: string,
): Promise<Set<ShipmentStatus>> {
  try {
    const { data } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", clientId)
      .maybeSingle<{ tenant_id: string }>();
    const tenantId = String(data?.tenant_id ?? "").trim();
    if (!tenantId) return new Set();
    return await getHiddenPortalStatuses(admin, tenantId, clientId);
  } catch {
    return new Set();
  }
}

/**
 * Statuses a ocultar en el stepper de ESTE cliente. Aplica override del cliente
 * sobre el default del tenant, evento por evento.
 */
export async function getHiddenPortalStatuses(
  admin: SupabaseClient,
  tenantId: string,
  clientId: string | null,
): Promise<Set<ShipmentStatus>> {
  const hidden = new Set<ShipmentStatus>();
  try {
    const orFilter =
      clientId != null
        ? `client_id.is.null,client_id.eq.${clientId}`
        : `client_id.is.null`;
    const { data, error } = await admin
      .from("client_notification_rules")
      .select("trigger_event, client_id, visible_in_portal")
      .eq("tenant_id", tenantId)
      .like("trigger_event", `${STATUS_PREFIX}%`)
      .or(orFilter);
    if (error || !data) return hidden;

    const rows = data as Array<{
      trigger_event: string;
      client_id: string | null;
      visible_in_portal: boolean;
    }>;

    // Precedencia: el override del cliente (client_id != null) gana al default.
    const decision = new Map<string, boolean>(); // status → visible
    for (const r of rows) {
      const status = r.trigger_event.slice(STATUS_PREFIX.length);
      const isOverride = r.client_id != null;
      // Sólo pisa si es override, o si aún no hay decisión (default).
      if (isOverride || !decision.has(status)) {
        decision.set(status, r.visible_in_portal);
      }
    }

    for (const [status, visible] of decision) {
      if (!visible) hidden.add(status as ShipmentStatus);
    }
  } catch (err) {
    console.error("[client-notif] getHiddenPortalStatuses falló:", err);
  }
  return hidden;
}

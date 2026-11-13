import "server-only";
/**
 * SDD-0629 · La tasa de bolívares para la vista «equivalente en Bs» del portal.
 *
 * El cliente del portal no es miembro de `user_tenants`, así que la RLS de
 * `fx_rates` (0495: `tenant_id = get_user_tenant_id()`) no le devuelve nada con
 * su sesión. La tasa no es un dato del cliente: es la referencia del tenant,
 * cargada en Admin › Tasas.
 *
 * Mismo patrón que `pending-acceptance.ts` (SDD-0543/0549): admin client con el
 * tenant del PRINCIPAL Portal, que la página ya resolvió. En el detalle, el
 * tenant de la factura leída por `getMyInvoiceForPrincipal`, que filtra
 * `tenant_id = principal.tenantId` y el Shipping Mark (SDD-0552); en «Mis
 * facturas», `principal.tenantId`. No se relee `clients.tenant_id` ni se acepta
 * un tenant de la URL. `fx_rate_on` filtra `f.tenant_id = p_tenant_id`, así que
 * solo vuelven tasas de ese tenant. Solo lectura de `fx_rates`, sin migración.
 *
 * Decisión aceptada por el DG (SDD-0629, revisión de la #531). Este admin
 * client existe SOLO para esta lectura de la tasa: no se reutiliza ni se
 * exporta para otra consulta del portal.
 *
 * El admin client se crea DENTRO del try: si falta la variable de entorno, la
 * página sigue con «tasa no disponible». `admin` se inyecta sólo en pruebas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { tasasVesPorFecha } from "@/lib/studio/fx-rates";
import type { TasaReferencial } from "@/lib/shared/equivalente-bs";

export async function tasasReferencialesDelPortal(
  tenantId: string | null | undefined,
  fechas: readonly (string | null | undefined)[],
  admin?: SupabaseClient,
): Promise<Map<string, TasaReferencial | null>> {
  try {
    const tenant = String(tenantId ?? "").trim();
    if (!tenant) return new Map();
    return await tasasVesPorFecha(admin ?? createAdminClient(), tenant, fechas);
  } catch {
    return new Map();
  }
}

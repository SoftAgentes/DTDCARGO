import "server-only";
/**
 * SDD-0629 · La tasa de bolívares para la vista «equivalente en Bs» del portal.
 *
 * El cliente del portal no es miembro de `user_tenants`, así que la RLS de
 * `fx_rates` (0495: `tenant_id = get_user_tenant_id()`) no le devuelve nada con
 * su sesión. La tasa no es un dato del cliente: es la referencia del tenant,
 * cargada en Admin › Tasas. Se lee con el admin client, SIEMPRE con el tenant
 * que ya resolvió la página (la factura o el resumen que leyó con su RLS y su
 * filtro de tenant + Shipping Mark del principal). `fx_rate_on` filtra por
 * `p_tenant_id`. Solo lectura, sin migración.
 *
 * Best-effort: cualquier fallo es «tasa no disponible», nunca un cero.
 */
import { createAdminClient } from "@/lib/db/admin";
import { tasasVesPorFecha } from "@/lib/studio/fx-rates";
import type { TasaReferencial } from "@/lib/shared/equivalente-bs";

export async function tasasReferencialesDelPortal(
  tenantId: string | null | undefined,
  fechas: readonly (string | null | undefined)[],
): Promise<Map<string, TasaReferencial | null>> {
  if (!tenantId) return new Map();
  try {
    return await tasasVesPorFecha(createAdminClient(), tenantId, fechas);
  } catch {
    return new Map();
  }
}

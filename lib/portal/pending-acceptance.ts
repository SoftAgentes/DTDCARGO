/**
 * SDD-0543 · Facturas «por aceptar» para las pantallas de facturas del Portal.
 *
 * Un borrador DDP no aparece en «Mis facturas» (la RLS del portal oculta los
 * borradores y `listMyInvoices` los excluye otra vez), así que el cliente sólo lo
 * veía en la tarjeta de la portada (SDD-0054 Slice C). Con la carga de los
 * contenedores en camino, un cliente puede tener su factura del contenedor en
 * borrador semanas antes de emitirse: la lista y el estado de cuenta tienen que
 * decirle que existe, cuánto es y que el detalle se abre cuando acepte los T&C.
 *
 * Identidad (SDD-0549): tenant y Shipping Mark salen del principal Portal que la
 * página ya resolvió con `getPortalClientPrincipal(session)`. El admin client
 * NO vuelve a leer `clients.tenant_id`: ese era el patrón que la SDD-0397 quitó
 * de la acción de aceptar. La lectura queda scopeada por tenant + Shipping Mark
 * en `portal-legal-queries`. Best-effort: cualquier fallo devuelve vacío/null y
 * la pantalla sigue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import type { PortalClientPrincipal } from "./portal-queries";
import {
  getPendingAcceptanceInvoice,
  listPendingAcceptanceInvoices,
  type PendingAcceptanceDetail,
  type PendingAcceptanceEmbarque,
  type PendingAcceptanceInvoice,
} from "./portal-legal-queries";

/** Lo que el loader necesita del principal Portal: su tenant y su Shipping Mark. */
export type PendingAcceptancePrincipal = Pick<PortalClientPrincipal, "tenantId"> & {
  client: Pick<PortalClientPrincipal["client"], "markbox">;
};

/** Tenant y Shipping Mark del principal, o null si falta alguno (falla cerrado). */
function scopeDe(principal: PendingAcceptancePrincipal): { tenantId: string; markbox: string } | null {
  const tenantId = String(principal?.tenantId ?? "").trim();
  const markbox = String(principal?.client?.markbox ?? "").trim();
  return tenantId && markbox ? { tenantId, markbox } : null;
}

/**
 * Las facturas en borrador de ese principal que esperan su aceptación de T&C.
 *
 * El admin client se crea DENTRO del try (no como parámetro por defecto): si
 * falta la variable de entorno, `createAdminClient()` lanza, y un lanzamiento
 * fuera del try tumbaría «Mis facturas» para todos los clientes por una lectura
 * que es best-effort. `admin` se inyecta sólo en pruebas.
 */
export async function loadPendingAcceptanceForClient(
  principal: PendingAcceptancePrincipal,
  admin?: SupabaseClient,
): Promise<PendingAcceptanceInvoice[]> {
  try {
    const scope = scopeDe(principal);
    if (!scope) return [];
    const db = admin ?? createAdminClient();
    return await listPendingAcceptanceInvoices(db, scope);
  } catch {
    return [];
  }
}

/** UNA factura por aceptar, por su código, o null si no es suya o ya no espera nada. */
export async function loadPendingAcceptanceDetailForClient(
  principal: PendingAcceptancePrincipal,
  code: string,
  admin?: SupabaseClient,
): Promise<PendingAcceptanceDetail | null> {
  try {
    const scope = scopeDe(principal);
    const codigo = String(code ?? "").trim();
    if (!scope || !codigo) return null;
    const db = admin ?? createAdminClient();
    return await getPendingAcceptanceInvoice(db, { ...scope, code: codigo });
  } catch {
    return null;
  }
}

/**
 * La medida que acompaña al monto de una factura por aceptar: si la factura
 * junta varios embarques (`embarques` con código por línea), la suma de sus
 * envíos; si no, la del único envío enlazado. Sumar la medida de uno junto al
 * monto de todos era mentirle al cliente al pedirle que aceptara los T&C.
 * `cbm`/`weightKg` son null cuando ningún envío la trae (nunca se inventa 0).
 */
export function medidaDeLaFactura(pendiente: {
  embarques: readonly PendingAcceptanceEmbarque[];
  cbm: number | null;
  weightKg: number | null;
}): { varios: boolean; codigos: string[]; cbm: number | null; weightKg: number | null } {
  if (pendiente.embarques.length <= 1) {
    return { varios: false, codigos: pendiente.embarques.map((e) => e.code), cbm: pendiente.cbm, weightKg: pendiente.weightKg };
  }
  const suma = (vals: (number | null)[], decimales: number): number | null => {
    const vivos = vals.filter((v): v is number => v != null && Number.isFinite(v));
    if (vivos.length === 0) return null;
    const f = 10 ** decimales;
    return Math.round((vivos.reduce((s, v) => s + v, 0) + Number.EPSILON) * f) / f;
  };
  return {
    varios: true,
    codigos: pendiente.embarques.map((e) => e.code),
    cbm: suma(pendiente.embarques.map((e) => e.cbm), 3),
    weightKg: suma(pendiente.embarques.map((e) => e.weightKg), 2),
  };
}

/**
 * Suma de lo que el cliente tiene por aceptar, sólo si todo está en una misma
 * moneda: sumar monedas distintas sería mentir. Devuelve null si está mezclado.
 */
export function totalPorAceptar(
  pending: readonly PendingAcceptanceInvoice[],
): { total: number; currency: string } | null {
  if (pending.length === 0) return null;
  const currency = pending[0].currency;
  if (pending.some((p) => p.currency !== currency)) return null;
  const total = pending.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
  return { total: Math.round((total + Number.EPSILON) * 100) / 100, currency };
}

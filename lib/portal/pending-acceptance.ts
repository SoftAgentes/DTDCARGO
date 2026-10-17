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
 * Mismo camino que `loadPendingAcceptance` de la portada: admin client, tenant
 * resuelto por el id del cliente ya verificado por sesión, y lectura scopeada
 * por tenant + Shipping Mark en `portal-legal-queries`. Best-effort: cualquier
 * fallo devuelve vacío/null y la pantalla sigue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import {
  getPendingAcceptanceInvoice,
  listPendingAcceptanceInvoices,
  type PendingAcceptanceDetail,
  type PendingAcceptanceEmbarque,
  type PendingAcceptanceInvoice,
} from "./portal-legal-queries";

export interface PortalClientRef {
  clientId: string;
  markbox: string;
}

async function tenantDe(admin: SupabaseClient, clientId: string): Promise<string | null> {
  const id = String(clientId ?? "").trim();
  if (!id) return null;
  const { data } = await admin
    .from("clients")
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = String(data?.tenant_id ?? "").trim();
  return tenantId || null;
}

/**
 * Las facturas en borrador de ese cliente que esperan su aceptación de T&C.
 *
 * El admin client se crea DENTRO del try (no como parámetro por defecto): si
 * falta la variable de entorno, `createAdminClient()` lanza, y un lanzamiento
 * fuera del try tumbaría «Mis facturas» para todos los clientes por una lectura
 * que es best-effort. `admin` se inyecta sólo en pruebas.
 */
export async function loadPendingAcceptanceForClient(
  ref: PortalClientRef,
  admin?: SupabaseClient,
): Promise<PendingAcceptanceInvoice[]> {
  try {
    const markbox = String(ref.markbox ?? "").trim();
    if (!markbox) return [];
    const db = admin ?? createAdminClient();
    const tenantId = await tenantDe(db, ref.clientId);
    if (!tenantId) return [];
    return await listPendingAcceptanceInvoices(db, { tenantId, markbox });
  } catch {
    return [];
  }
}

/** UNA factura por aceptar, por su código, o null si no es suya o ya no espera nada. */
export async function loadPendingAcceptanceDetailForClient(
  ref: PortalClientRef & { code: string },
  admin?: SupabaseClient,
): Promise<PendingAcceptanceDetail | null> {
  try {
    const markbox = String(ref.markbox ?? "").trim();
    const code = String(ref.code ?? "").trim();
    if (!markbox || !code) return null;
    const db = admin ?? createAdminClient();
    const tenantId = await tenantDe(db, ref.clientId);
    if (!tenantId) return null;
    return await getPendingAcceptanceInvoice(db, { tenantId, markbox, code });
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

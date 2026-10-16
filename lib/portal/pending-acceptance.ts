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

/** Las facturas en borrador de ese cliente que esperan su aceptación de T&C. */
export async function loadPendingAcceptanceForClient(
  ref: PortalClientRef,
  admin: SupabaseClient = createAdminClient(),
): Promise<PendingAcceptanceInvoice[]> {
  try {
    const markbox = String(ref.markbox ?? "").trim();
    if (!markbox) return [];
    const tenantId = await tenantDe(admin, ref.clientId);
    if (!tenantId) return [];
    return await listPendingAcceptanceInvoices(admin, { tenantId, markbox });
  } catch {
    return [];
  }
}

/** UNA factura por aceptar, por su código, o null si no es suya o ya no espera nada. */
export async function loadPendingAcceptanceDetailForClient(
  ref: PortalClientRef & { code: string },
  admin: SupabaseClient = createAdminClient(),
): Promise<PendingAcceptanceDetail | null> {
  try {
    const markbox = String(ref.markbox ?? "").trim();
    const code = String(ref.code ?? "").trim();
    if (!markbox || !code) return null;
    const tenantId = await tenantDe(admin, ref.clientId);
    if (!tenantId) return null;
    return await getPendingAcceptanceInvoice(admin, { tenantId, markbox, code });
  } catch {
    return null;
  }
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

/**
 * SDD-0654 fase 2 · Cargador del inicio simple.
 *
 * Solo lecturas que el portal ya hace, con la SESIÓN del cliente (RLS + el
 * principal). La única excepción es `loadPendingAcceptanceForClient`, el mismo
 * cargador acotado (tenant + Shipping Mark del principal) que el inicio de hoy
 * ya usa para las órdenes por aceptar: no hay usos NUEVOS del cliente de
 * administración (AC-10). Quedan fuera, a propósito, porque sí lo serían:
 *   · la descarga directa de papeles (firma URLs con admin): el bloque 4 lleva
 *     a «Tus documentos»;
 *   · el equivalente en bolívares (tasa referencial con admin): el saldo va en
 *     su moneda; la vista en Bs sigue en «Mis facturas»;
 *   · la fecha estimada de la SDD-0627 (necesita la foto naviera con admin): se
 *     usa la llegada estimada que el inicio de hoy ya calcula.
 *
 * Cada lectura degrada sola: un fallo deja su bloque vacío o «no disponible»,
 * nunca tumba el inicio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDashboardKpis,
  getNextArrival,
  getPortalAdvisor,
  getProfileCompleteness,
  listMyDocuments,
  listMyShipments,
  type PortalClientPrincipal,
} from "@/lib/portal/portal-queries";
import { loadPendingAcceptanceForClient } from "@/lib/portal/pending-acceptance";
import { isModuleLocked } from "@/lib/portal/verify-gate";
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";
import { getHiddenPortalStatusesStrict } from "@/lib/studio/notifications/portal-visibility-queries";
import { listPrealertas, listSuppliers } from "@/lib/studio/prealertas/queries";
import { summarizeSuppliers } from "@/lib/studio/prealertas/types";
import type { PortalDashboardKpis, ProfileCompleteness } from "@/lib/portal/portal-types";
import type { DatosInicioSimple } from "./bloques";

const KPIS_VACIOS: PortalDashboardKpis = {
  activeShipments: 0,
  deliveredYtd: 0,
  invoicesAvailable: false,
  invoicedTotal: 0,
  outstandingBalance: 0,
  currency: "USD",
  mixedCurrencies: false,
  pendingInvoiceCount: 0,
};

/** Sin dato de perfil no se inventa una tarea: se trata como completo (fail-open, como `isModuleLocked`). */
const PERFIL_DESCONOCIDO: ProfileCompleteness = { hasPhoto: true, hasAddress: true, complete: true };

async function seguro<T>(p: Promise<T>, siFalla: T): Promise<T> {
  try {
    return await p;
  } catch {
    return siFalla;
  }
}

export async function cargarInicioSimple(
  supabase: SupabaseClient,
  principal: PortalClientPrincipal,
): Promise<DatosInicioSimple> {
  const { client, tenantId } = principal;
  const scope = { markbox: client.markbox, tenantId };

  const [kpis, nextArrival, shipments, profile, ocultos, aceptaciones, suppliers, prealertas, asesor] =
    await Promise.all([
      seguro(getDashboardKpis(supabase), KPIS_VACIOS),
      seguro(getNextArrival(supabase), null),
      seguro(listMyShipments(supabase), []),
      seguro(getProfileCompleteness(supabase), null),
      getHiddenPortalStatusesStrict(supabase),
      seguro(loadPendingAcceptanceForClient(principal), []),
      seguro(listSuppliers(supabase, scope), []),
      seguro(listPrealertas(supabase, scope), []),
      seguro(getPortalAdvisor(supabase), null),
    ]);

  // Como «Tus documentos»: un módulo cerrado no consulta nada.
  const papelesCerrados = profile !== null && isModuleLocked("documentos", profile);
  const documentos = papelesCerrados ? null : await seguro(listMyDocuments(supabase), []);

  // Mismo conteo que «Mis compras» (`proveedores/page.tsx`): compras vivas por
  // proveedor, para el próximo código y «N compras».
  const comprasPorProveedor: Record<string, number> = {};
  for (const p of prealertas) {
    if (p.supplier_id) comprasPorProveedor[p.supplier_id] = (comprasPorProveedor[p.supplier_id] ?? 0) + 1;
  }
  const proveedores = summarizeSuppliers(
    client.markbox,
    suppliers.map((s) => ({
      id: s.id,
      supplier_seq: s.supplier_seq,
      name: s.name,
      wechat: s.wechat,
      city: s.city,
      contact: s.contact,
      notes: s.notes,
    })),
    comprasPorProveedor,
  );

  return {
    nombre: client.name,
    markbox: client.markbox,
    nextArrival,
    shipments,
    ocultos,
    kpis,
    profile: profile ?? PERFIL_DESCONOCIDO,
    pendingAcceptanceCodes: aceptaciones.map((a) => a.code),
    documentos,
    proveedores,
    asesor,
    seguimientoEnConstruccion: TRACKING_EN_CONSTRUCCION,
  };
}

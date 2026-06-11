/**
 * Queries del flujo de aceptación de T&C del cliente en el Portal
 * (SDD-0054 · Slice C).
 *
 * PROBLEMA que resuelven: el operador crea la factura DDP en BORRADOR; el cliente
 * la ve en el Portal como "pendiente de aceptar T&C", acepta el monto exacto + la
 * medida del envío y recién entonces el operador emite (gate de Slice B). Pero el
 * Portal OCULTA los borradores (`listMyInvoices`/`getMyInvoice` filtran
 * `.neq("status","borrador")` + la RLS del portal también los excluye). Por eso
 * estas queries reciben el **admin client** (`createAdminClient`, service_role) y
 * scopean TODO EXPLÍCITO por `tenant_id` + `client_markbox` + DDP + `borrador`.
 *
 * INVARIANTE de seguridad: el caller (la página / la action) resuelve PRIMERO la
 * identidad del cliente con el client de SESIÓN (`getPortalClient`) y recién
 * después pasa acá su `markbox` + `tenant_id`. service_role bypassa RLS, así que
 * el aislamiento lo da el filtrado explícito de estas funciones (defensa en
 * profundidad: identidad por sesión + scope explícito).
 *
 * Una factura cuenta como "pendiente de aceptar" si:
 *   - es del tenant + markbox del cliente,
 *   - status = 'borrador',
 *   - su shipment es DDP (`shipment_service = 'puerta_a_puerta_DDP'`),
 *   - NO tiene todavía una aceptación T&C vigente que matchee su medida + total
 *     (cruce con `hasValidAcceptanceForMarkbox`, el mismo gate de Slice B).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { hasValidAcceptanceForMarkbox } from "@/lib/studio/legal/queries";
import type { DocRef } from "@/lib/studio/legal/types";
import type { InvoiceLine } from "@/lib/studio/invoice-types";

const DDP_SERVICE = "puerta_a_puerta_DDP";

/** Resumen de una orden DDP esperando aceptación (card de descubrimiento). */
export type PendingAcceptanceInvoice = {
  /** invoice_code (F-YYYY-NNNN). */
  code: string;
  /** Total a aceptar = base_amount (pre-IVA, lo que compara el gate). */
  baseAmount: number;
  /** Total con IVA (lo que se mostrará como "total" de la orden). */
  totalAmount: number;
  currency: string;
  /** Código del envío DDP asociado (ref de la orden). */
  shipmentCode: string | null;
  /** CBM del envío (medida a la que queda atada la aceptación). */
  cbm: number | null;
  /** Peso del envío en kg. */
  weightKg: number | null;
};

/** Detalle de la orden DDP a aceptar (página de aceptación). */
export type PendingAcceptanceDetail = PendingAcceptanceInvoice & {
  /** id de la factura borrador (para la idempotency key determinística). */
  invoiceId: string;
  /** id del envío DDP asociado (null si la factura no enlaza shipment). */
  shipmentId: string | null;
  clientName: string;
  ivaRate: number;
  ivaAmount: number;
  fxRate: number | null;
  lines: InvoiceLine[];
  notes: string | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Medida (cbm/weight) del shipment, leída por id con scope de tenant. */
async function shipmentMeasure(
  admin: SupabaseClient,
  args: { tenantId: string; shipmentId: string | null; markbox: string },
): Promise<{ cbm: number | null; weightKg: number | null; service: string } | null> {
  if (!args.shipmentId) return null;
  const { data } = await admin
    .from("shipments")
    .select("shipment_service, volume_m3, weight_kg, client_markbox")
    .eq("id", args.shipmentId)
    .eq("tenant_id", args.tenantId)
    .eq("client_markbox", args.markbox)
    .is("deleted_at", null)
    .maybeSingle<{
      shipment_service: string;
      volume_m3: number | null;
      weight_kg: number | null;
      client_markbox: string | null;
    }>();
  if (!data) return null;
  return {
    cbm: numOrNull(data.volume_m3),
    weightKg: numOrNull(data.weight_kg),
    service: String(data.shipment_service ?? ""),
  };
}

/**
 * Facturas BORRADOR de ESE cliente cuyo shipment es DDP y que aún NO tienen
 * aceptación T&C vigente — para el card de descubrimiento del dashboard (el
 * borrador no aparece en "Mis facturas"). Usa admin client + scope explícito.
 */
export async function listPendingAcceptanceInvoices(
  admin: SupabaseClient,
  args: { tenantId: string; markbox: string },
): Promise<PendingAcceptanceInvoice[]> {
  const tenantId = String(args.tenantId ?? "").trim();
  const markbox = String(args.markbox ?? "").trim();
  if (!tenantId || !markbox) return [];

  const { data, error } = await admin
    .from("invoices")
    .select(
      "id, invoice_code, status, currency, base_amount, total_amount, shipment_id, shipment_code",
    )
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .eq("status", "borrador")
    .is("deleted_at", null)
    .not("shipment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const out: PendingAcceptanceInvoice[] = [];
  for (const r of data) {
    const measure = await shipmentMeasure(admin, {
      tenantId,
      shipmentId: (r.shipment_id as string | null) ?? null,
      markbox,
    });
    // Solo DDP entra al flujo de aceptación.
    if (!measure || measure.service !== DDP_SERVICE) continue;

    const baseAmount = num(r.base_amount);
    // ¿Ya hay una aceptación vigente que matchee la medida + total DE ESTA ORDEN?
    // M-1 (round-3): orderRef = ref de la orden (= quote_code que sella Slice C =
    // shipment_code, o invoice_code si no hubiera). Sin orderRef, una aceptación
    // de OTRA factura con la misma terna ocultaría esta orden por error.
    const orderRef =
      String((r.shipment_code as string | null) ?? "").trim() ||
      String(r.invoice_code ?? "").trim();
    const alreadyAccepted = await hasValidAcceptanceForMarkbox(admin, {
      tenantId,
      clientMarkbox: markbox,
      cbm: num(measure.cbm),
      weight: num(measure.weightKg),
      total: baseAmount,
      orderRef,
    });
    if (alreadyAccepted) continue;

    out.push({
      code: r.invoice_code as string,
      baseAmount,
      totalAmount: num(r.total_amount),
      currency: String(r.currency ?? "USD"),
      shipmentCode: (r.shipment_code as string | null) ?? null,
      cbm: measure.cbm,
      weightKg: measure.weightKg,
    });
  }
  return out;
}

/**
 * La factura BORRADOR DDP puntual de ese cliente por `code` + la medida de su
 * shipment + lines, para la página de aceptación. Devuelve null si:
 *   - no es borrador / no es de ese cliente (markbox) / no existe,
 *   - el shipment no es DDP,
 *   - ya tiene una aceptación T&C vigente que matchee (no hay nada que aceptar).
 */
export async function getPendingAcceptanceInvoice(
  admin: SupabaseClient,
  args: { tenantId: string; markbox: string; code: string },
): Promise<PendingAcceptanceDetail | null> {
  const tenantId = String(args.tenantId ?? "").trim();
  const markbox = String(args.markbox ?? "").trim();
  const code = String(args.code ?? "").trim();
  if (!tenantId || !markbox || !code) return null;

  const { data, error } = await admin
    .from("invoices")
    .select(
      "id, invoice_code, client_name, status, currency, fx_rate, iva_rate, base_amount, iva_amount, total_amount, lines, notes, shipment_id, shipment_code",
    )
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .eq("invoice_code", code)
    .eq("status", "borrador")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const measure = await shipmentMeasure(admin, {
    tenantId,
    shipmentId: (data.shipment_id as string | null) ?? null,
    markbox,
  });
  if (!measure || measure.service !== DDP_SERVICE) return null;

  const baseAmount = num(data.base_amount);
  // M-1 (round-3): atado a ESTA orden (mismo orderRef que sella la action).
  const orderRef =
    String((data.shipment_code as string | null) ?? "").trim() ||
    String(data.invoice_code ?? "").trim();
  const alreadyAccepted = await hasValidAcceptanceForMarkbox(admin, {
    tenantId,
    clientMarkbox: markbox,
    cbm: num(measure.cbm),
    weight: num(measure.weightKg),
    total: baseAmount,
    orderRef,
  });
  if (alreadyAccepted) return null;

  return {
    invoiceId: data.id as string,
    code: data.invoice_code as string,
    clientName: (data.client_name as string | null) ?? markbox,
    baseAmount,
    totalAmount: num(data.total_amount),
    ivaRate: num(data.iva_rate),
    ivaAmount: num(data.iva_amount),
    fxRate: numOrNull(data.fx_rate),
    currency: String(data.currency ?? "USD"),
    shipmentId: (data.shipment_id as string | null) ?? null,
    shipmentCode: (data.shipment_code as string | null) ?? null,
    cbm: measure.cbm,
    weightKg: measure.weightKg,
    lines: Array.isArray(data.lines) ? (data.lines as InvoiceLine[]) : [],
    notes: (data.notes as string | null) ?? null,
  };
}

/**
 * Snapshot de docs de la ÚLTIMA aceptación previa de ESTA orden (SDD-0067):
 * detecta la causa "nueva versión" para el aviso de re-aceptación del §1. Si la
 * orden sigue "pendiente de aceptar" (la página se está mostrando) PERO existe
 * una aceptación previa cuyos docs ya no son los vigentes → el Portal muestra
 * "Actualizamos nuestro Acuerdo…".
 *
 * Mismo scope explícito que el resto (admin client + tenant + markbox +
 * quote_code = ref de la orden). null si no hay aceptaciones previas o faltan
 * argumentos (fail-closed: sin aviso).
 */
export async function latestOrderAcceptanceDocs(
  admin: SupabaseClient,
  args: { tenantId: string; markbox: string; orderRef: string },
): Promise<DocRef[] | null> {
  const tenantId = String(args.tenantId ?? "").trim();
  const markbox = String(args.markbox ?? "").trim();
  const orderRef = String(args.orderRef ?? "").trim();
  if (!tenantId || !markbox || !orderRef) return null;

  const { data } = await admin
    .from("legal_acceptances")
    .select("docs, accepted_at")
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .eq("quote_code", orderRef)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ docs: unknown; accepted_at: string }>();

  if (!data) return null;

  const raw = data.docs;
  const parsed: unknown =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        })()
      : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed.map((d) => ({
    key: String((d as DocRef)?.key ?? ""),
    version: String((d as DocRef)?.version ?? ""),
  }));
}

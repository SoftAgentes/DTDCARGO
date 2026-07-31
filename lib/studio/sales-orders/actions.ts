/**
 * Server actions del módulo Órdenes de venta (SDD-0072) — la OV de DTD.
 *
 * "use server" + parsing manual + validate*Input (sin Zod) + revalidatePath.
 *
 *  - createSalesOrder            · crea la OV manual (sin estimado · B2B/otros).
 *  - convertEstimateToSalesOrder · ⭐ convierte un estimado → OV (snapshot editable
 *                                  del quote + link BIDIRECCIONAL quote_id ↔
 *                                  quotes.sales_order_id).
 *  - updateSalesOrder            · edita el snapshot (solo en estado 'confirmada').
 *  - setSalesOrderStatus         · transición de status (valida el grafo canTransition).
 *  - cancelSalesOrder            · marca 'cancelada' (atajo de transición).
 *  - assignPrealertaToSalesOrder · ata una prealerta (caja física) a la OV.
 *  - unassignPrealertaFromSalesOrder · le quita la prealerta a la OV.
 *
 * Fase 2 (NO acá): la confirmación de Warehouse genera la Factura (0021), parcial
 * por defecto, y setea 'parcial'/'facturada' (estados de motor).
 */

"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { postInvoiceJournalEntry } from "@/lib/studio/accounting/invoice-posting";
import {
  buildSalesOrderFromQuote,
  canTransition,
  isEditableStatus,
  validateSalesOrderInput,
  type SalesOrderInput,
  type SalesOrderStatus,
} from "./types";
import {
  canAutoInvoice,
  type AutoInvoiceResult,
  type VerificationSource,
} from "./invoicing";

const SO_PATH = "/studio/ordenes-venta";

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

// ── Insertar la OV (común a crear manual / convertir) ──────────

async function insertSalesOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  input: SalesOrderInput,
  quoteId: string | null,
): Promise<{ id?: string; salesOrderCode?: string; error?: string }> {
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_sales_order_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de la orden de venta." };
  }
  const salesOrderCode = String(codeData);

  const { data: inserted, error: insErr } = await supabase
    .from("sales_orders")
    .insert({
      tenant_id: tenantId,
      sales_order_code: salesOrderCode,
      quote_id: quoteId,
      client_markbox: input.clientMarkbox,
      client_name: input.clientName,
      service: input.service,
      origin: input.origin,
      destination: input.destination,
      subtotal_usd: input.subtotalUsd,
      total_usd: input.totalUsd,
      status: "confirmada",
      notes: input.notes,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return { error: `No se pudo crear la orden de venta: ${insErr?.message}` };
  }
  return { id: inserted.id, salesOrderCode };
}

// ── Crear OV manual ────────────────────────────────────────────

export async function createSalesOrder(
  raw: Partial<SalesOrderInput>,
): Promise<{ ok?: boolean; error?: string; salesOrderCode?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "sales-orders");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateSalesOrderInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de la orden de venta inválidos." };
  }

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const res = await insertSalesOrder(supabase, tenantId, input!, null);
  if (res.error || !res.id) {
    return { error: res.error ?? "No se pudo crear la orden de venta." };
  }

  revalidatePath(SO_PATH);
  return { ok: true, salesOrderCode: res.salesOrderCode };
}

// ── Convertir estimado → OV (snapshot + link bidireccional) ────

/**
 * ⭐ Convierte un estimado (quotes, EST-) en Orden de venta.
 *
 * Pasos:
 *  1. lee el estimado (RLS filtra por tenant) + valida que no esté ya convertido.
 *  2. snapshotea sus datos con buildSalesOrderFromQuote (editable luego).
 *  3. (opcional) pisa el snapshot con `overrides` del operador (si editó al convertir).
 *  4. inserta la OV con quote_id = estimado (link OV→estimado).
 *  5. marca quotes.sales_order_id = OV (reverso del link bidireccional).
 */
export async function convertEstimateToSalesOrder(
  quoteId: string,
  overrides?: Partial<SalesOrderInput>,
): Promise<{ ok?: boolean; error?: string; salesOrderCode?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "sales-orders");
  if (denial) return { error: denial };

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select(
      "id, tenant_id, client_markbox, client_name, service, origin, destination, subtotal_usd, total_usd, notes, sales_order_id",
    )
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      client_markbox: string | null;
      client_name: string;
      service: SalesOrderInput["service"];
      origin: string;
      destination: string;
      subtotal_usd: number;
      total_usd: number;
      notes: string | null;
      sales_order_id: string | null;
    }>();
  if (qErr || !quote) return { error: "Estimado no encontrado." };
  if (quote.sales_order_id) {
    return { error: "Este estimado ya se convirtió en una orden de venta." };
  }

  // Snapshot del estimado + overrides del operador (si editó al convertir).
  const snapshot = buildSalesOrderFromQuote({
    client_markbox: quote.client_markbox,
    client_name: quote.client_name,
    service: quote.service,
    origin: quote.origin,
    destination: quote.destination,
    subtotal_usd: quote.subtotal_usd,
    total_usd: quote.total_usd,
    notes: quote.notes,
  });
  const { input, fieldErrors } = validateSalesOrderInput({
    ...snapshot,
    ...overrides,
  });
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de la orden de venta inválidos." };
  }

  const res = await insertSalesOrder(supabase, quote.tenant_id, input!, quote.id);
  if (res.error || !res.id) {
    return { error: res.error ?? "No se pudo crear la orden de venta." };
  }

  // Reverso del link: marcar el estimado como convertido (idempotente: solo si
  // sigue sin OV, backstop anti-race).
  const { error: linkErr } = await supabase
    .from("quotes")
    .update({ sales_order_id: res.id })
    .eq("id", quote.id)
    .is("sales_order_id", null);
  if (linkErr) {
    // La OV ya existe y apunta al estimado; el reverso es best-effort.
    console.error(
      "[sales-orders] OV creada pero no se marcó el estimado como convertido:",
      linkErr.message,
    );
  }

  revalidatePath(SO_PATH);
  revalidatePath("/studio/cotizador");
  return { ok: true, salesOrderCode: res.salesOrderCode };
}

// ── Editar OV (solo 'confirmada') ──────────────────────────────

export async function updateSalesOrder(
  salesOrderId: string,
  raw: Partial<SalesOrderInput>,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "sales-orders");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateSalesOrderInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de la orden de venta inválidos." };
  }

  const { data: so, error: readErr } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, status")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; tenant_id: string; status: string }>();
  if (readErr || !so) return { error: "Orden de venta no encontrada." };
  if (!isEditableStatus(so.status)) {
    return {
      error: "Solo se puede editar una OV confirmada (antes de facturar).",
    };
  }

  const { error: updErr } = await supabase
    .from("sales_orders")
    .update({
      client_markbox: input!.clientMarkbox,
      client_name: input!.clientName,
      service: input!.service,
      origin: input!.origin,
      destination: input!.destination,
      subtotal_usd: input!.subtotalUsd,
      total_usd: input!.totalUsd,
      notes: input!.notes,
    })
    .eq("id", so.id);
  if (updErr) {
    return { error: `No se pudo actualizar la OV: ${updErr.message}` };
  }

  revalidatePath(SO_PATH);
  return { ok: true };
}

// ── Transición de status ───────────────────────────────────────

export async function setSalesOrderStatus(
  salesOrderId: string,
  to: SalesOrderStatus,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "sales-orders");
  if (denial) return { error: denial };

  const { data: so, error: readErr } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, status, sales_order_code")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      sales_order_code: string;
    }>();
  if (readErr || !so) return { error: "Orden de venta no encontrada." };

  if (!canTransition(so.status, to)) {
    return { error: `No se puede pasar la OV de "${so.status}" a "${to}".` };
  }

  const { error: updErr } = await supabase
    .from("sales_orders")
    .update({ status: to })
    .eq("id", so.id);
  if (updErr) return { error: `No se pudo cambiar el estado: ${updErr.message}` };

  revalidatePath(SO_PATH);
  return { ok: true };
}

export async function cancelSalesOrder(
  salesOrderId: string,
): Promise<{ ok?: boolean; error?: string }> {
  return setSalesOrderStatus(salesOrderId, "cancelada");
}

// ── OV ↔ prealerta (caja física) ───────────────────────────────

/**
 * Ata una prealerta (caja física) a la OV. Valida que ambas existan en el tenant
 * del usuario (RLS) y que la OV no esté en estado terminal. Idempotente: si la
 * prealerta ya apunta a otra OV, la re-apunta a esta.
 */
export async function assignPrealertaToSalesOrder(
  salesOrderId: string,
  prealertaId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "sales-orders");
  if (denial) return { error: denial };

  const { data: so, error: soErr } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, status, sales_order_code")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      sales_order_code: string;
    }>();
  if (soErr || !so) return { error: "Orden de venta no encontrada." };
  if (so.status !== "confirmada") {
    return {
      error:
        "Solo se pueden asignar prealertas a una OV 'confirmada' (antes de facturar). Una vez que arranca la facturación, el conjunto de cajas queda fijo (denominador congelado).",
    };
  }

  // La prealerta debe existir en el tenant (RLS filtra; el update por id es
  // suficiente, pero validamos para devolver un error claro).
  const { data: pre, error: preErr } = await supabase
    .from("prealertas")
    .select("id, code")
    .eq("id", prealertaId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; code: string }>();
  if (preErr || !pre) return { error: "Prealerta no encontrada." };

  const { error: updErr } = await supabase
    .from("prealertas")
    .update({ sales_order_id: so.id })
    .eq("id", pre.id);
  if (updErr) {
    return { error: `No se pudo asignar la prealerta: ${updErr.message}` };
  }

  revalidatePath(SO_PATH);
  return { ok: true };
}

/** Le quita la prealerta a la OV (set sales_order_id = null). */
export async function unassignPrealertaFromSalesOrder(
  salesOrderId: string,
  prealertaId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "sales-orders");
  if (denial) return { error: denial };

  const { data: so } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, sales_order_code, status")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      sales_order_code: string;
      status: string;
    }>();
  if (!so) return { error: "Orden de venta no encontrada." };
  if (so.status !== "confirmada") {
    return {
      error:
        "Solo se pueden quitar prealertas de una OV 'confirmada' (antes de facturar).",
    };
  }

  const { error: updErr } = await supabase
    .from("prealertas")
    .update({ sales_order_id: null })
    .eq("id", prealertaId)
    .eq("sales_order_id", so.id); // solo si estaba atada a ESTA OV
  if (updErr) {
    return { error: `No se pudo quitar la prealerta: ${updErr.message}` };
  }

  revalidatePath(SO_PATH);
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════
// FASE 2 · auto-Factura en la confirmación de Warehouse (§3.5/§3.6)
// ════════════════════════════════════════════════════════════════

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resuelve qué adjuntos/verificación tiene una recepción, para el gate. Cuenta los
 * adjuntos de la prealerta (packing/factura/foto) — si hay packing list o factura
 * del PROVEEDOR, la verificación es "packing"; si la recepción trae CBM/peso propios
 * (medido en almacén) la verificación es al menos "warehouse". Best-effort: si la
 * tabla de adjuntos no existe en el env, asume sin adjuntos (NO factura, conservador).
 */
async function resolveReceiptVerification(
  admin: SupabaseClient,
  args: {
    tenantId: string;
    prealertaId: string | null;
    hasWarehouseMeasure: boolean;
  },
): Promise<{ verification: VerificationSource; hasAttachments: boolean }> {
  let hasPackingDoc = false;
  let hasAnyDoc = false;

  if (args.prealertaId) {
    try {
      const { data } = await admin
        .from("prealerta_documents")
        .select("doc_type")
        .eq("prealerta_id", args.prealertaId)
        .eq("tenant_id", args.tenantId)
        .is("deleted_at", null)
        .limit(50);
      const docs = (data as { doc_type: string }[] | null) ?? [];
      hasAnyDoc = docs.length > 0;
      hasPackingDoc = docs.some(
        (d) => d.doc_type === "packing" || d.doc_type === "factura",
      );
    } catch {
      // tabla ausente en el env → conservador: sin adjuntos.
    }
  }

  // packing list del proveedor > medición en almacén > nada.
  const verification: VerificationSource = hasPackingDoc
    ? "packing"
    : args.hasWarehouseMeasure
      ? "warehouse"
      : "none";

  // "adjuntos" del gate = cualquier adjunto de la caja. Si no hay caja/adjuntos,
  // la medición en almacén NO sustituye el adjunto (el packing list/foto es el
  // soporte documental exigido por §3.5).
  return { verification, hasAttachments: hasAnyDoc };
}
/**
 * ⭐ Motor de auto-facturación de la OV en la confirmación de Warehouse (Fase 2).
 *
 * Llamado por el HOOK best-effort de la recepción CN (changeReceiptStatusAction →
 * 'consolidado'). Corre con ADMIN client (service_role): la seguridad por-tenant la
 * da el filtro EXPLÍCITO por `tenantId` (y la RPC re-filtra por tenant adentro).
 *
 * Arquitectura (post-hardening 0128):
 *  - GATE §3.5 COMPLETO app-side (acá): adjuntos + verificación (prealerta_documents)
 *    vía resolveReceiptVerification + canAutoInvoice. Si falta algo → NO factura.
 *  - NÚCLEO FINANCIERO en la RPC TRANSACCIONAL `sales_order_claim_and_invoice`
 *    (migr 0128): claim FOR UPDATE de OV+caja → denominador congelado → monto →
 *    factura → ligado invoice_id → status, TODO en UNA transacción (o todo o nada;
 *    imposible doble-facturar la misma caja ni dejar cerrojos huérfanos).
 *  - ASIENTO 0040 app-side, best-effort + idempotente por invoice_id (mismo modo de
 *    fallo que la emisión manual de 0021; NO se duplica el motor contable en SQL).
 *
 * NO throwea: devuelve un AutoInvoiceResult. El hook decide el log y nunca bloquea
 * la recepción.
 */
export async function autoInvoiceForReceipt(args: {
  admin: SupabaseClient;
  tenantId: string;
  receiptId: string;
}): Promise<AutoInvoiceResult> {
  const { admin, tenantId, receiptId } = args;
  try {
    // ── 1. Leer la recepción para el GATE §3.5 completo (adjuntos + verificación),
    //       que la RPC NO evalúa — la RPC solo re-valida gates DUROS (defensa). ──
    const { data: receipt, error: rErr } = await admin
      .from("warehouse_receipts_cn")
      .select(
        "receipt_code, is_orphan, boxes, total_cbm, total_weight_kg, prealerta_id, invoice_verified_at",
      )
      .eq("id", receiptId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle<{
        receipt_code: string;
        is_orphan: boolean;
        boxes: number;
        total_cbm: number | null;
        total_weight_kg: number | null;
        prealerta_id: string | null;
        invoice_verified_at: string | null;
      }>();
    if (rErr || !receipt) {
      return { ok: false, reason: "recepción no encontrada", notApplicable: true };
    }

    // ── 2. GATE §3.5 (adjuntos + verificación) ──
    const hasWarehouseMeasure =
      num(receipt.total_cbm) > 0 && num(receipt.total_weight_kg) > 0;
    const { verification, hasAttachments } = await resolveReceiptVerification(
      admin,
      { tenantId, prealertaId: receipt.prealerta_id, hasWarehouseMeasure },
    );
    const eligibility = canAutoInvoice({
      total_cbm: receipt.total_cbm,
      total_weight_kg: receipt.total_weight_kg,
      boxes: Math.round(num(receipt.boxes)),
      verification,
      hasAttachments,
      isOrphan: !!receipt.is_orphan,
      humanVerified: receipt.invoice_verified_at != null,
    });
    if (!eligibility.ok) {
      return { ok: false, reason: eligibility.reason };
    }

    // ── 3. NÚCLEO ATÓMICO (RPC migr 0128): claim → monto → factura → ligado →
    //       status, todo en UNA transacción con FOR UPDATE. O todo o nada. ──
    const { data: rpcRaw, error: rpcErr } = await admin.rpc(
      "sales_order_claim_and_invoice",
      { p_tenant_id: tenantId, p_receipt_id: receiptId },
    );
    if (rpcErr) {
      return { ok: false, reason: `no se pudo facturar: ${rpcErr.message}` };
    }
    const r = (rpcRaw ?? {}) as {
      outcome: string;
      missing?: string;
      invoice_id?: string;
      invoice_code?: string;
      base_amount?: number;
      iva_amount?: number;
      total_amount?: number;
      sales_order_id?: string;
      sales_order_code?: string;
      sales_order_status?: string;
      sales_order_status_changed?: boolean;
    };

    switch (r.outcome) {
      case "invoiced":
        break; // sigue al asiento contable
      case "gate_failed":
        return { ok: false, reason: `faltan datos: ${r.missing ?? "requisitos"}` };
      case "no_box":
        return {
          ok: false,
          reason:
            "la recepción no tiene una caja (prealerta) trazable para facturar",
          notApplicable: true,
        };
      case "no_sales_order":
        return {
          ok: false,
          reason: "la recepción no resuelve ninguna orden de venta",
          notApplicable: true,
        };
      case "so_terminal":
        return {
          ok: false,
          reason: `la OV ${r.sales_order_code ?? ""} está ${r.sales_order_status ?? "cerrada/cancelada"} y no admite facturación`,
          notApplicable: true,
        };
      case "already_invoiced":
        return {
          ok: false,
          reason: "la caja de esta recepción ya fue facturada",
          notApplicable: true,
        };
      case "zero_amount":
        return {
          ok: false,
          reason: "monto a facturar = 0 (la OV no tiene total o ya está cubierta)",
          notApplicable: true,
        };
      case "not_found":
        return {
          ok: false,
          reason: "recepción no encontrada",
          notApplicable: true,
        };
      default:
        return {
          ok: false,
          reason: `resultado inesperado de la facturación: ${r.outcome ?? "desconocido"}`,
        };
    }

    const invoiceCode = String(r.invoice_code ?? "");
    const totalUsd = num(r.total_amount);

    // ── 4. Asiento contable (0040) — FUERA de la tx, best-effort e idempotente por
    //       invoice_id (mismo modo de fallo que la emisión manual de 0021). ──
    const today = new Date().toISOString().slice(0, 10);
    try {
      const posting = await postInvoiceJournalEntry({
        tenantId,
        invoiceId: String(r.invoice_id ?? ""),
        invoiceCode,
        baseAmount: num(r.base_amount),
        ivaAmount: num(r.iva_amount),
        totalAmount: totalUsd,
        entryDate: today,
      });
      if (!posting.ok) {
        console.error(
          `[sales-orders auto-invoice] asiento de ${invoiceCode} no creado:`,
          posting.skipped ?? posting.error,
        );
      }
    } catch (e) {
      console.error(
        `[sales-orders auto-invoice] error inesperado al asentar ${invoiceCode}:`,
        e,
      );
    }

    revalidatePath(SO_PATH);
    revalidatePath("/studio/facturacion");

    return {
      ok: true,
      invoiceCode,
      amountUsd: totalUsd,
      salesOrderStatus: r.sales_order_status_changed
        ? (r.sales_order_status as SalesOrderStatus)
        : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

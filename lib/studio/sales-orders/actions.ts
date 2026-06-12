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
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { postInvoiceJournalEntry } from "@/lib/studio/accounting/invoice-posting";
import { deriveFundClass } from "@/lib/studio/payment-types";
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
  computeReceiptInvoiceAmount,
  nextStatusAfterInvoice,
  salesOrderAcceptsInvoicing,
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

async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Best-effort audit con actor_type='user'. No bloquea la mutación. */
async function audit(
  tenantId: string,
  entityId: string,
  actorId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("entity_audit_log").insert({
      tenant_id: tenantId,
      entity_type: "sales_order",
      entity_id: entityId,
      actor_type: "user",
      actor_id: actorId,
      event_type: eventType,
      payload,
    });
  } catch (e) {
    // entity_audit_log tiene CHECK de entity_type (0124); si 'sales_order' no
    // está en el CHECK del env, el insert falla pero NO debe bloquear la OV.
    console.error("[sales-orders audit] no se pudo registrar audit:", e);
  }
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

  await audit(tenantId, res.id, await currentUserId(supabase), "so_created", {
    sales_order_code: res.salesOrderCode,
    total_usd: input!.totalUsd,
    manual: true,
  });

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

  await audit(
    quote.tenant_id,
    res.id,
    await currentUserId(supabase),
    "so_converted_from_estimate",
    {
      sales_order_code: res.salesOrderCode,
      quote_id: quote.id,
      total_usd: input!.totalUsd,
    },
  );

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

  await audit(so.tenant_id, so.id, await currentUserId(supabase), "so_updated", {
    total_usd: input!.totalUsd,
  });

  revalidatePath(SO_PATH);
  return { ok: true };
}

// ── Transición de status ───────────────────────────────────────

export async function setSalesOrderStatus(
  salesOrderId: string,
  to: SalesOrderStatus,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

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

  await audit(
    so.tenant_id,
    so.id,
    await currentUserId(supabase),
    "so_status_changed",
    { from: so.status, to, sales_order_code: so.sales_order_code },
  );

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
  if (so.status === "cancelada") {
    return { error: "No se puede asignar una prealerta a una OV cancelada." };
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

  await audit(
    so.tenant_id,
    so.id,
    await currentUserId(supabase),
    "so_prealerta_assigned",
    { sales_order_code: so.sales_order_code, prealerta_code: pre.code },
  );

  revalidatePath(SO_PATH);
  return { ok: true };
}

/** Le quita la prealerta a la OV (set sales_order_id = null). */
export async function unassignPrealertaFromSalesOrder(
  salesOrderId: string,
  prealertaId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: so } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, sales_order_code")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; tenant_id: string; sales_order_code: string }>();
  if (!so) return { error: "Orden de venta no encontrada." };

  const { error: updErr } = await supabase
    .from("prealertas")
    .update({ sales_order_id: null })
    .eq("id", prealertaId)
    .eq("sales_order_id", so.id); // solo si estaba atada a ESTA OV
  if (updErr) {
    return { error: `No se pudo quitar la prealerta: ${updErr.message}` };
  }

  await audit(
    so.tenant_id,
    so.id,
    await currentUserId(supabase),
    "so_prealerta_unassigned",
    { sales_order_code: so.sales_order_code, prealerta_id: prealertaId },
  );

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
 * 'consolidado'). Corre con ADMIN client (service_role) — igual que el asiento
 * contable: la seguridad por-tenant la da el filtro EXPLÍCITO por `tenantId`.
 *
 * Garantías (feature financiera):
 *  - GATING (§3.5): valida CBM/peso/verificación/adjuntos con `canAutoInvoice`. Si
 *    falta algo → { ok:false, reason:"faltan datos: …" }, NO factura.
 *  - PARCIAL por defecto (§3.6): factura SOLO las cajas (prealertas) NO facturadas
 *    de la OV que cubre esta recepción. 1 OV : N facturas.
 *  - IDEMPOTENTE: reclama las cajas con UPDATE ... WHERE invoice_id IS NULL ANTES de
 *    postear (guard anti-race). Si otra ejecución ya las reclamó → 0 filas → no
 *    factura ("ya facturada"). La factura se crea recién DESPUÉS de reclamar, y las
 *    cajas se re-apuntan al invoice_id real.
 *  - MONTO REAL: proporcional al snapshot por cajas (computeReceiptInvoiceAmount).
 *  - STATUS de la OV: parcial/facturada vía isAllowedTransition (no la UI).
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
    // ── 1. Leer la recepción (datos reales) ──
    const { data: receipt, error: rErr } = await admin
      .from("warehouse_receipts_cn")
      .select(
        "id, tenant_id, receipt_code, client_markbox, client_name, is_orphan, boxes, total_cbm, total_weight_kg, prealerta_id, sales_order_id",
      )
      .eq("id", receiptId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle<{
        id: string;
        tenant_id: string;
        receipt_code: string;
        client_markbox: string | null;
        client_name: string | null;
        is_orphan: boolean;
        boxes: number;
        total_cbm: number | null;
        total_weight_kg: number | null;
        prealerta_id: string | null;
        sales_order_id: string | null;
      }>();
    if (rErr || !receipt) {
      return { ok: false, reason: "recepción no encontrada", notApplicable: true };
    }

    // ── 2. Resolver la OV: denormalizada o vía la prealerta (caja → OV) ──
    let salesOrderId = receipt.sales_order_id;
    if (!salesOrderId && receipt.prealerta_id) {
      const { data: pre } = await admin
        .from("prealertas")
        .select("sales_order_id")
        .eq("id", receipt.prealerta_id)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .maybeSingle<{ sales_order_id: string | null }>();
      salesOrderId = pre?.sales_order_id ?? null;
    }
    if (!salesOrderId) {
      return {
        ok: false,
        reason: "la recepción no resuelve ninguna orden de venta",
        notApplicable: true,
      };
    }

    const { data: so, error: soErr } = await admin
      .from("sales_orders")
      .select("id, tenant_id, sales_order_code, client_markbox, client_name, total_usd, service, status")
      .eq("id", salesOrderId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle<{
        id: string;
        tenant_id: string;
        sales_order_code: string;
        client_markbox: string | null;
        client_name: string;
        total_usd: number;
        service: string;
        status: SalesOrderStatus;
      }>();
    if (soErr || !so) {
      return { ok: false, reason: "orden de venta no encontrada", notApplicable: true };
    }
    if (!salesOrderAcceptsInvoicing(so)) {
      return {
        ok: false,
        reason: `la OV ${so.sales_order_code} está ${so.status} y no admite facturación`,
        notApplicable: true,
      };
    }

    // ── 3. GATE de requisitos (§3.5) ──
    const hasWarehouseMeasure =
      num(receipt.total_cbm) > 0 && num(receipt.total_weight_kg) > 0;
    const { verification, hasAttachments } = await resolveReceiptVerification(
      admin,
      { prealertaId: receipt.prealerta_id, hasWarehouseMeasure },
    );
    const eligibility = canAutoInvoice({
      total_cbm: receipt.total_cbm,
      total_weight_kg: receipt.total_weight_kg,
      boxes: Math.round(num(receipt.boxes)),
      verification,
      hasAttachments,
      isOrphan: !!receipt.is_orphan,
    });
    if (!eligibility.ok) {
      return { ok: false, reason: eligibility.reason };
    }

    // ── 4. Reclamar las cajas NO facturadas de la OV (guard anti-race) ──
    // La caja a facturar = la prealerta de ESTA recepción (si tiene), siempre que
    // siga sin facturar. Reclamamos con un UPDATE condicional: solo gana quien
    // pone invoice_id de null→reservado. (Reservamos con un marcador temporal: el
    // propio receiptId no sirve como invoice_id porque es FK a invoices; en su
    // lugar reclamamos leyendo+actualizando con WHERE invoice_id IS NULL y luego
    // confirmamos con select.)
    //
    // Estrategia 1 OV : N facturas: solo la(s) prealerta(s) de esta recepción que
    // aún no tengan invoice_id. Si la recepción no tiene prealerta atada, NO hay
    // caja que reclamar → no facturamos (el gate ya exigía no-huérfana, pero sin
    // prealerta tampoco hay unidad de facturación trazable).
    if (!receipt.prealerta_id) {
      return {
        ok: false,
        reason: "la recepción no tiene una caja (prealerta) trazable para facturar",
        notApplicable: true,
      };
    }

    // Snapshot del universo de cajas de la OV (planeadas + ya facturadas) para el
    // prorrateo y el status final.
    const { data: ovBoxesRaw } = await admin
      .from("prealertas")
      .select("id, boxes, invoice_id")
      .eq("sales_order_id", so.id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .limit(1000);
    const ovBoxes = (ovBoxesRaw as { id: string; boxes: number; invoice_id: string | null }[] | null) ?? [];
    const totalBoxes = ovBoxes.reduce((s, p) => s + Math.round(num(p.boxes)), 0);

    // Guard anti-race (CRÍTICO · feature financiera): el UPDATE condicional es el
    // MUTEX. Solo gana quien flipea invoiced_at de NULL→claimedAt: Postgres
    // serializa el UPDATE sobre la misma fila, así dos consolidaciones concurrentes
    // de la misma caja NO crean dos facturas (la 2da ve invoiced_at != null → 0
    // filas). El cerrojo es `invoiced_at` (no `invoice_id`, que no puede setearse
    // hasta que exista la factura por la FK). `invoice_id IS NULL` también se exige
    // para no re-facturar una caja ya facturada en una corrida previa. Todo path de
    // fallo posterior revierte invoiced_at→null (las cajas vuelven al pool).
    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin
      .from("prealertas")
      .update({ invoiced_at: claimedAt })
      .eq("id", receipt.prealerta_id)
      .eq("sales_order_id", so.id)
      .eq("tenant_id", tenantId)
      .is("invoice_id", null)
      .is("invoiced_at", null)
      .is("deleted_at", null)
      .select("id, boxes");
    if (claimErr) {
      return { ok: false, reason: `no se pudo reclamar la caja: ${claimErr.message}` };
    }
    const claimedRows = (claimed as { id: string; boxes: number }[] | null) ?? [];
    if (claimedRows.length === 0) {
      // Otra ejecución ya la reclamó/facturó (invoiced_at o invoice_id no-null) →
      // idempotencia: NO doble-facturamos.
      return {
        ok: false,
        reason: "la caja de esta recepción ya fue facturada (o está en proceso)",
        notApplicable: true,
      };
    }
    const claimedBoxes = claimedRows.reduce(
      (s, p) => s + Math.round(num(p.boxes)),
      0,
    );
    const claimedIds = claimedRows.map((p) => p.id);

    // ── 5. Calcular monto real (proporcional al snapshot por cajas) ──
    // Ya facturado de la OV = suma de totales de las facturas previas de esta OV.
    const { data: prevInvoices } = await admin
      .from("invoices")
      .select("total_amount")
      .eq("sales_order_id", so.id)
      .eq("tenant_id", tenantId)
      .neq("status", "anulada")
      .is("deleted_at", null);
    const alreadyInvoicedUsd = (
      (prevInvoices as { total_amount: unknown }[] | null) ?? []
    ).reduce((s, r) => s + num(r.total_amount), 0);

    // ¿esta recepción cubre las últimas cajas pendientes? (las pendientes pre-claim
    // eran las de invoice_id null; si tras reclamar no quedan más → es final).
    const remainingBoxesAfter = ovBoxes
      .filter((p) => !p.invoice_id && !claimedIds.includes(p.id))
      .reduce((s, p) => s + Math.round(num(p.boxes)), 0);
    const isFinal = remainingBoxesAfter <= 0;

    const amountUsd = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: num(so.total_usd),
      totalBoxes,
      receivedBoxes: claimedBoxes,
      alreadyInvoicedUsd,
      isFinal,
    });

    if (amountUsd <= 0) {
      // Monto 0 (snapshot 0 o ya cubierto): NO emitimos factura vacía. Devolvemos
      // las cajas al pool (revertimos el cerrojo) para no marcarlas como facturadas.
      await admin
        .from("prealertas")
        .update({ invoiced_at: null })
        .in("id", claimedIds)
        .is("invoice_id", null);
      return {
        ok: false,
        reason: "monto a facturar = 0 (la OV no tiene total o ya está cubierta)",
        notApplicable: true,
      };
    }

    // ── 6. Crear la factura reusando el motor 0021 ──
    const ivaOn = await tenantIvaOn(admin, tenantId);
    const ivaRate = ivaOn ? 16 : 0;
    const baseAmount = round2usd(ivaOn ? amountUsd / 1.16 : amountUsd);
    const ivaAmount = round2usd(amountUsd - baseAmount);
    const today = new Date().toISOString().slice(0, 10);

    const { data: codeData, error: codeErr } = await admin.rpc(
      "next_invoice_code",
      { p_tenant_id: tenantId },
    );
    if (codeErr || !codeData) {
      // No se pudo generar code → revertir el cerrojo de las cajas.
      await admin
        .from("prealertas")
        .update({ invoiced_at: null })
        .in("id", claimedIds)
        .is("invoice_id", null);
      return { ok: false, reason: "no se pudo generar el código de factura" };
    }
    const invoiceCode = String(codeData);

    const clientMarkbox =
      (receipt.client_markbox ?? so.client_markbox ?? "").trim() || "—";
    const clientName =
      (receipt.client_name ?? so.client_name ?? "").trim() || "Cliente";

    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        invoice_code: invoiceCode,
        client_markbox: clientMarkbox,
        client_name: clientName,
        sales_order_id: so.id,
        currency: "USD",
        iva_rate: ivaRate,
        base_amount: baseAmount,
        iva_amount: ivaAmount,
        total_amount: amountUsd,
        lines: [
          {
            desc: `OV ${so.sales_order_code} · recepción ${receipt.receipt_code} (${claimedBoxes} caja${claimedBoxes === 1 ? "" : "s"})`,
            qty: 1,
            unitPrice: baseAmount,
          },
        ],
        notes: `Generada automáticamente al confirmar la recepción ${receipt.receipt_code} (SDD-0072 Fase 2).`,
        status: "emitida",
        issued_at: today,
        due_date: addDays(today, 30),
        fund_class: deriveFundClass(so.service),
      })
      .select("id")
      .single<{ id: string }>();
    if (invErr || !invoice) {
      // Insert falló → revertir el cerrojo (las cajas vuelven a ser facturables).
      await admin
        .from("prealertas")
        .update({ invoiced_at: null })
        .in("id", claimedIds)
        .is("invoice_id", null);
      return {
        ok: false,
        reason: `no se pudo crear la factura: ${invErr?.message ?? "sin detalle"}`,
      };
    }

    // ── 7. Confirmar la idempotencia: ligar las cajas al invoice_id real ──
    await admin
      .from("prealertas")
      .update({ invoice_id: invoice.id, invoiced_at: claimedAt })
      .in("id", claimedIds);

    // Denormalizar la OV en la recepción (provenance) — best-effort.
    await admin
      .from("warehouse_receipts_cn")
      .update({ sales_order_id: so.id })
      .eq("id", receipt.id);

    // ── 8. Asiento contable de venta (0040) — best-effort, no rompe ──
    try {
      const posting = await postInvoiceJournalEntry({
        tenantId,
        invoiceId: invoice.id,
        invoiceCode,
        baseAmount,
        ivaAmount,
        totalAmount: amountUsd,
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

    // ── 9. Status de la OV (parcial / facturada) vía el grafo ──
    let newStatus: SalesOrderStatus | undefined;
    const next = nextStatusAfterInvoice({
      current: so.status,
      remainingBoxes: remainingBoxesAfter,
    });
    if (next) {
      const { error: stErr } = await admin
        .from("sales_orders")
        .update({ status: next })
        .eq("id", so.id)
        .eq("tenant_id", tenantId);
      if (!stErr) newStatus = next;
    }

    // ── 10. Audit (best-effort) ──
    await audit(tenantId, so.id, null, "so_auto_invoiced", {
      sales_order_code: so.sales_order_code,
      invoice_code: invoiceCode,
      receipt_code: receipt.receipt_code,
      amount_usd: amountUsd,
      boxes: claimedBoxes,
      status: newStatus ?? so.status,
    });

    revalidatePath(SO_PATH);
    revalidatePath("/studio/facturacion");

    return {
      ok: true,
      invoiceCode,
      amountUsd,
      salesOrderStatus: newStatus,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

// ── helpers locales del motor de facturación ───────────────────

function round2usd(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function addDays(baseISO: string, days: number): string {
  const d = new Date(baseISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lee el flag iva_enabled del tenant (fuente del toggle fiscal · igual que 0021). */
async function tenantIvaOn(
  admin: SupabaseClient,
  tenantId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("tenants")
    .select("iva_enabled")
    .eq("id", tenantId)
    .maybeSingle<{ iva_enabled: boolean }>();
  return data?.iva_enabled ?? false;
}

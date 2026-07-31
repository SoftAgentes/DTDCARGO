/**
 * Server actions del módulo Órdenes de compra (SDD-0071) — la OC de DTD.
 *
 * "use server" + parsing manual + validate*Input (sin Zod) + revalidatePath.
 *
 *  - createPurchaseOrder  · crea la OC (proveedor + ítems) + total derivado.
 *  - updatePurchaseOrder  · edita la OC + reemplaza sus ítems (solo borrador/confirmada).
 *  - setPurchaseOrderStatus · transición de status (valida el grafo canTransition).
 *  - cancelPurchaseOrder  · marca 'cancelada' (atajo de transición).
 *  - receivePurchaseOrder · ⭐ el puente: genera el Bill (0044) + linka bill_id ↔ OC.
 *
 * El puente OC→Bill reusa `createBillFor` de Tesorería (NO duplica la lógica de
 * causación). El Bill exige un proveedor de Tesorería (suppliers PRV-) + una
 * cuenta de gasto: la action resuelve/crea el suppliers desde el nombre de la OC
 * y exige `expenseAccountId` (se elige al recibir, default COGS — decisión §10).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import { capabilityDenial, moduleEditDenial } from "@/lib/studio/rbac-guard";
import { createBillFor } from "@/lib/studio/treasury/treasury-actions";
import {
  buildBillPayloadFromPo,
  canReceive,
  canTransition,
  computeTotalCost,
  validatePurchaseOrderInput,
  type PurchaseOrderInput,
  type PurchaseOrderStatus,
} from "./types";

const PO_PATH = "/studio/ordenes-compra";

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

// ── Insertar/reemplazar ítems ──────────────────────────────────

async function insertItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  purchaseOrderId: string,
  items: PurchaseOrderInput["items"],
): Promise<{ error?: string }> {
  if (items.length === 0) return {};
  const rows = items.map((it, i) => ({
    tenant_id: tenantId,
    purchase_order_id: purchaseOrderId,
    description: it.description,
    qty: it.qty,
    unit_cost_usd: it.unitCostUsd,
    position: i,
  }));
  const { error } = await supabase.from("purchase_order_items").insert(rows);
  if (error) return { error: error.message };
  return {};
}

// ── Crear OC ───────────────────────────────────────────────────

export async function createPurchaseOrder(
  raw: Partial<PurchaseOrderInput>,
): Promise<{ ok?: boolean; error?: string; purchaseOrderCode?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "purchase-orders");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validatePurchaseOrderInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de la compra inválidos." };
  }

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_purchase_order_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de la orden de compra." };
  }
  const purchaseOrderCode = String(codeData);

  const total = computeTotalCost(
    input!.items.map((i) => ({ qty: i.qty, unit_cost_usd: i.unitCostUsd })),
  );

  const { data: inserted, error: insErr } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: tenantId,
      purchase_order_code: purchaseOrderCode,
      client_markbox: input!.clientMarkbox,
      supplier_id: input!.supplierId,
      supplier_name: input!.supplierName,
      sales_order_id: input!.salesOrderId,
      status: "borrador",
      total_cost_usd: total,
      notes: input!.notes,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return { error: `No se pudo crear la orden de compra: ${insErr?.message}` };
  }

  const itemsRes = await insertItems(
    supabase,
    tenantId,
    inserted.id,
    input!.items,
  );
  if (itemsRes.error) {
    return { error: `Compra creada pero fallaron los ítems: ${itemsRes.error}` };
  }

  revalidatePath(PO_PATH);
  return { ok: true, purchaseOrderCode };
}

// ── Editar OC (solo borrador/confirmada) ───────────────────────

export async function updatePurchaseOrder(
  purchaseOrderId: string,
  raw: Partial<PurchaseOrderInput>,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "purchase-orders");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validatePurchaseOrderInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de la compra inválidos." };
  }

  const { data: po, error: readErr } = await supabase
    .from("purchase_orders")
    .select("id, tenant_id, status, bill_id")
    .eq("id", purchaseOrderId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      bill_id: string | null;
    }>();
  if (readErr || !po) return { error: "Compra no encontrada." };
  if (po.status !== "borrador" && po.status !== "confirmada") {
    return {
      error: "Solo se puede editar una compra en borrador o confirmada.",
    };
  }

  const total = computeTotalCost(
    input!.items.map((i) => ({ qty: i.qty, unit_cost_usd: i.unitCostUsd })),
  );

  const { error: updErr } = await supabase
    .from("purchase_orders")
    .update({
      client_markbox: input!.clientMarkbox,
      supplier_id: input!.supplierId,
      supplier_name: input!.supplierName,
      sales_order_id: input!.salesOrderId,
      notes: input!.notes,
      total_cost_usd: total,
    })
    .eq("id", po.id);
  if (updErr) {
    return { error: `No se pudo actualizar la compra: ${updErr.message}` };
  }

  // Reemplazar ítems (borrar + insertar).
  const { error: delErr } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("purchase_order_id", po.id);
  if (delErr) {
    return { error: `No se pudieron reemplazar los ítems: ${delErr.message}` };
  }
  const itemsRes = await insertItems(
    supabase,
    po.tenant_id,
    po.id,
    input!.items,
  );
  if (itemsRes.error) {
    return { error: `Compra actualizada pero fallaron los ítems: ${itemsRes.error}` };
  }

  revalidatePath(PO_PATH);
  return { ok: true };
}

// ── Transición de status ───────────────────────────────────────

export async function setPurchaseOrderStatus(
  purchaseOrderId: string,
  to: PurchaseOrderStatus,
  reasonRaw?: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "purchase-orders");
  if (denial) return { error: denial };

  const { data: po, error: readErr } = await supabase
    .from("purchase_orders")
    .select("id, tenant_id, status, purchase_order_code")
    .eq("id", purchaseOrderId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      purchase_order_code: string;
    }>();
  if (readErr || !po) return { error: "Compra no encontrada." };

  if (!canTransition(po.status, to)) {
    return {
      error: `No se puede pasar la compra de "${po.status}" a "${to}".`,
    };
  }

  if (to === "cancelada") {
    const reasonResult = validateAuditReason(reasonRaw);
    if (!reasonResult.ok) return { error: reasonResult.error };

    const { data: cancelled, error: cancelErr } = await supabase.rpc(
      "cancel_purchase_order_with_audit_reason",
      { p_id: po.id, p_reason: reasonResult.reason },
    );
    if (cancelErr) {
      return { error: `No se pudo cancelar la compra: ${cancelErr.message}` };
    }
    if (!cancelled) {
      return { error: "La compra cambió de estado y ya no puede cancelarse." };
    }

    revalidatePath(PO_PATH);
    return { ok: true };
  }

  const { error: updErr } = await supabase
    .from("purchase_orders")
    .update({ status: to })
    .eq("id", po.id);
  if (updErr) return { error: `No se pudo cambiar el estado: ${updErr.message}` };

  revalidatePath(PO_PATH);
  return { ok: true };
}

export async function cancelPurchaseOrder(
  purchaseOrderId: string,
  reasonRaw: string,
): Promise<{ ok?: boolean; error?: string }> {
  return setPurchaseOrderStatus(purchaseOrderId, "cancelada", reasonRaw);
}

// ── Puente OC → Bill (recepción) ───────────────────────────────

/**
 * Asegura un proveedor de Tesorería (suppliers PRV-) para atar la CxP del Bill.
 * Estrategia (V1):
 *  - si la OC tiene supplier_name → busca un suppliers con ese name; si no
 *    existe, lo crea (type proveedor_cn) con next_supplier_code.
 *  - el suppliers_cn (proveedor chino del cliente) NO sirve como payee de la CxP
 *    (es del cliente, no de DTD): por eso se mapea por nombre a un suppliers.
 *
 * Devuelve `{ supplierId }` o `{ error }`.
 */
async function ensureTesorerySupplier(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  supplierName: string,
): Promise<{ supplierId?: string; error?: string }> {
  const name = supplierName.trim();
  if (!name) return { error: "La compra no tiene proveedor para atar el Bill." };

  // ¿Ya existe un proveedor de Tesorería con ese nombre?
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", name)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existing?.id) return { supplierId: existing.id };

  // Crear uno nuevo (PRV-NNNN) tipo proveedor_cn.
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_supplier_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del proveedor (PRV-)." };
  }
  const { data: inserted, error: insErr } = await supabase
    .from("suppliers")
    .insert({
      tenant_id: tenantId,
      supplier_code: String(codeData),
      name,
      type: "proveedor_cn",
      country: "CN",
      default_currency: "USD",
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return { error: `No se pudo crear el proveedor de Tesorería: ${insErr?.message}` };
  }
  return { supplierId: inserted.id };
}

/**
 * ⭐ Recibe la OC → genera el Bill (0044) + linka bidireccional.
 *
 * Pasos:
 *  1. lee la OC + valida que se puede recibir (canReceive) y no tiene Bill.
 *  2. resuelve el proveedor de Tesorería (PRV-) desde el nombre de la OC.
 *  3. valida `expenseAccountId` (cuenta de gasto). Si falta → "faltan datos".
 *  4. createBillFor (reusa la causación de Tesorería) con el payload de la OC.
 *  5. lee el Bill recién creado por su code → linka bill_id en la OC + status
 *     'facturada' (queda 'recibida' si el código no se pudo releer, defensivo).
 *
 * `dueDate` opcional (default = hoy, exigible al recibir).
 */
export async function receivePurchaseOrder(
  purchaseOrderId: string,
  opts: { expenseAccountId: string; dueDate?: string | null },
): Promise<{
  ok?: boolean;
  error?: string;
  billCode?: string;
}> {
  const supabase = await createClient();
  // Recibir la OC CAUSA el Bill (CxP) — es un acto de Tesorería/contabilidad,
  // no operativo. Capability `approve_money` (accounting+admin, SDD-0139):
  // nombra el ACTO en vez de prestarse el gate del módulo treasury. Cierra el
  // puente OC→Bill (SDD-0085 §C4).
  const denial = await capabilityDenial(supabase, "approve_money");
  if (denial) return { error: denial };

  const { data: po, error: readErr } = await supabase
    .from("purchase_orders")
    .select(
      "id, tenant_id, purchase_order_code, supplier_id, supplier_name, status, total_cost_usd, bill_id",
    )
    .eq("id", purchaseOrderId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      purchase_order_code: string;
      supplier_id: string | null;
      supplier_name: string | null;
      status: string;
      total_cost_usd: number;
      bill_id: string | null;
    }>();
  if (readErr || !po) return { error: "Compra no encontrada." };

  if (!canReceive({ status: po.status as PurchaseOrderStatus, bill_id: po.bill_id })) {
    if (po.bill_id) return { error: "Esta compra ya generó su Bill." };
    return {
      error:
        "Solo se puede recibir una compra confirmada (o ya recibida sin Bill).",
    };
  }

  if (Number(po.total_cost_usd) <= 0) {
    return { error: "La compra no tiene costo (agrega ítems antes de recibir)." };
  }

  const expenseAccountId = (opts.expenseAccountId ?? "").trim();
  if (!expenseAccountId) {
    return {
      error:
        "Faltan datos: elige la cuenta de costo/gasto para causar el Bill.",
    };
  }

  // Nombre del proveedor para el payee de la CxP: usa supplier_name; si la OC
  // referenció una ficha suppliers_cn sin nombre libre, lo levanta de ahí.
  let supplierName = (po.supplier_name ?? "").trim();
  if (!supplierName && po.supplier_id) {
    const { data: sc } = await supabase
      .from("suppliers_cn")
      .select("name")
      .eq("id", po.supplier_id)
      .maybeSingle<{ name: string }>();
    supplierName = (sc?.name ?? "").trim();
  }
  if (!supplierName) {
    return { error: "La compra no tiene proveedor para atar el Bill." };
  }

  const supRes = await ensureTesorerySupplier(
    supabase,
    po.tenant_id,
    supplierName,
  );
  if (supRes.error || !supRes.supplierId) {
    return { error: supRes.error ?? "No se pudo resolver el proveedor." };
  }

  // Marcar como recibida (si venía de 'confirmada') antes de causar el Bill.
  if (po.status === "confirmada") {
    await supabase
      .from("purchase_orders")
      .update({ status: "recibida" })
      .eq("id", po.id);
  }

  const payload = buildBillPayloadFromPo({
    po: {
      purchase_order_code: po.purchase_order_code,
      total_cost_usd: po.total_cost_usd,
    },
    tesorerySupplierId: supRes.supplierId,
    expenseAccountId,
    dueDate: opts.dueDate ?? null,
  });

  const billRes = await createBillFor(supabase, payload);
  if (!billRes.ok || !billRes.billCode) {
    const firstFieldError = billRes.fieldErrors
      ? Object.values(billRes.fieldErrors)[0]
      : undefined;
    return {
      error:
        billRes.error ?? firstFieldError ?? "No se pudo generar el Bill.",
    };
  }

  // Releer el Bill por su code para linkear bill_id ↔ OC (createBillFor no
  // devuelve el id, solo el code; el code es unique por tenant).
  const { data: bill } = await supabase
    .from("supplier_bills")
    .select("id")
    .eq("tenant_id", po.tenant_id)
    .eq("bill_code", billRes.billCode)
    .maybeSingle<{ id: string }>();

  const { error: linkErr } = await supabase
    .from("purchase_orders")
    .update({
      bill_id: bill?.id ?? null,
      status: "facturada",
    })
    .eq("id", po.id);
  if (linkErr) {
    return {
      error: `Bill ${billRes.billCode} creado pero no se vinculó a la compra: ${linkErr.message}`,
    };
  }

  revalidatePath(PO_PATH);
  revalidatePath("/studio/tesoreria");
  revalidatePath("/studio/contabilidad");
  return { ok: true, billCode: billRes.billCode };
}

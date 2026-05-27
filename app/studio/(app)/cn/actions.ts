/**
 * Server actions del módulo Almacén CN (SDD-0016).
 *
 * - createReceiptAction: autogenera receipt_code (o orphan_code) + insert
 *   receipt + insert items + insert event 'received' en una operación
 *   pseudo-atómica (rollback manual si falla items).
 * - changeReceiptStatusAction: update status + insert event 'status_change'.
 * - softDeleteReceiptAction: deleted_at = now() (no expuesto en UI V1).
 *
 * Validación con validateReceiptInput() — patrón del proyecto (sin zod).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateReceiptInput,
  type WarehouseReceiptActionState,
  type WarehouseReceiptInput,
  type WarehouseReceiptItemInput,
  type WarehouseReceiptStatus,
} from "@/lib/studio/warehouse-cn-types";

// ─────────────────────────────────────────────────────────────
// FormData parsing
// ─────────────────────────────────────────────────────────────

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: FormDataEntryValue | null): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "on";
}

/**
 * Items vienen serializados como JSON en un campo hidden `items_json`.
 * Mucho más simple que items[0][description], items[1][description]…
 * y permite que el client maneje el array internamente.
 */
function parseItemsJson(v: FormDataEntryValue | null): WarehouseReceiptItemInput[] {
  if (v == null) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => ({
      description: typeof it.description === "string" ? it.description : "",
      description_translated:
        typeof it.description_translated === "string"
          ? it.description_translated
          : null,
      hs_code: typeof it.hs_code === "string" ? it.hs_code : null,
      quantity:
        typeof it.quantity === "number" && Number.isFinite(it.quantity)
          ? it.quantity
          : null,
      unit_value_usd:
        typeof it.unit_value_usd === "number" && Number.isFinite(it.unit_value_usd)
          ? it.unit_value_usd
          : null,
      notes: typeof it.notes === "string" ? it.notes : null,
    }));
  } catch {
    return [];
  }
}

function inputFromFormData(
  formData: FormData,
): Partial<WarehouseReceiptInput> {
  return {
    warehouse_id: parseStringOrNull(formData.get("warehouse_id")) ?? undefined,
    client_markbox: parseStringOrNull(formData.get("client_markbox")),
    client_name: parseStringOrNull(formData.get("client_name")),
    is_orphan: parseBool(formData.get("is_orphan")),
    orphan_marks: parseStringOrNull(formData.get("orphan_marks")),
    orphan_brought_by: parseStringOrNull(formData.get("orphan_brought_by")),
    orphan_suspected_client: parseStringOrNull(
      formData.get("orphan_suspected_client"),
    ),
    supplier_name: parseStringOrNull(formData.get("supplier_name")),
    supplier_name_translated: parseStringOrNull(
      formData.get("supplier_name_translated"),
    ),
    boxes: (() => {
      const n = parseNumberOrNull(formData.get("boxes"));
      return n == null ? 0 : Math.round(n);
    })(),
    total_cbm: parseNumberOrNull(formData.get("total_cbm")),
    total_weight_kg: parseNumberOrNull(formData.get("total_weight_kg")),
    received_at:
      parseStringOrNull(formData.get("received_at")) ??
      new Date().toISOString().slice(0, 10),
    notes: parseStringOrNull(formData.get("notes")),
    items: parseItemsJson(formData.get("items_json")),
  };
}

// ─────────────────────────────────────────────────────────────
// createReceiptAction
// ─────────────────────────────────────────────────────────────

export async function createReceiptAction(
  _prev: WarehouseReceiptActionState,
  formData: FormData,
): Promise<WarehouseReceiptActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateReceiptInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Resolver tenant_id
  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  // Generar receipt_code (normal o huérfana)
  const rpcName = input!.is_orphan ? "next_orphan_code" : "next_receipt_code";
  const { data: codeData, error: codeErr } = await supabase.rpc(rpcName, {
    p_tenant_id: link.tenant_id,
  });
  if (codeErr || !codeData) {
    return {
      error: `No se pudo generar el código de recepción${codeErr ? ` (${codeErr.message})` : ""}.`,
    };
  }
  const receipt_code = String(codeData);

  // Insertar receipt
  const { data: receipt, error: insertErr } = await supabase
    .from("warehouse_receipts_cn")
    .insert({
      tenant_id: link.tenant_id,
      receipt_code,
      warehouse_id: input!.warehouse_id,
      client_markbox: input!.client_markbox,
      client_name: input!.client_name,
      is_orphan: input!.is_orphan,
      orphan_marks: input!.orphan_marks,
      orphan_brought_by: input!.orphan_brought_by,
      orphan_suspected_client: input!.orphan_suspected_client,
      supplier_name: input!.supplier_name,
      supplier_name_translated: input!.supplier_name_translated,
      boxes: input!.boxes,
      total_cbm: input!.total_cbm,
      total_weight_kg: input!.total_weight_kg,
      received_at: input!.received_at,
      notes: input!.notes,
      status: "pendiente_consolidacion",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !receipt) {
    return {
      error: `No se pudo crear la recepción: ${insertErr?.message ?? "sin detalle"}`,
    };
  }

  // Insertar items (rollback manual si falla)
  const itemsToInsert = input!.items.map((it, idx) => ({
    tenant_id: link.tenant_id,
    receipt_id: receipt.id,
    description: it.description,
    description_translated: it.description_translated,
    hs_code: it.hs_code,
    quantity: it.quantity,
    unit_value_usd: it.unit_value_usd,
    notes: it.notes,
    position: idx,
  }));

  const { error: itemsErr } = await supabase
    .from("warehouse_receipt_items")
    .insert(itemsToInsert);

  if (itemsErr) {
    // Rollback: borrar el receipt huérfano
    await supabase.from("warehouse_receipts_cn").delete().eq("id", receipt.id);
    return {
      error: `No se pudieron registrar los items: ${itemsErr.message}`,
    };
  }

  // Insertar event 'received' (best effort — no rollback si falla)
  await supabase.from("warehouse_receipt_events").insert({
    tenant_id: link.tenant_id,
    receipt_id: receipt.id,
    event_type: "received",
    description: `Recepción ${receipt_code} registrada${
      input!.supplier_name ? ` · supplier: ${input!.supplier_name}` : ""
    } · ${input!.items.length} item${input!.items.length === 1 ? "" : "s"}`,
  });

  revalidatePath("/studio/cn");
  return { ok: true, createdReceiptCode: receipt_code };
}

// ─────────────────────────────────────────────────────────────
// changeReceiptStatusAction
// ─────────────────────────────────────────────────────────────

const VALID_NEW_STATUSES: WarehouseReceiptStatus[] = [
  "pendiente_consolidacion",
  "consolidado",
  "incidencia",
];

export async function changeReceiptStatusAction(
  receiptId: string,
  newStatus: WarehouseReceiptStatus,
  options?: {
    note?: string;
    /**
     * Ciudad destino. REQUIRED si newStatus = 'consolidado' (Opción A SDD-0029 ·
     * migración 0044 agregó la columna). Ignorado para otros status.
     * Validar contra dispatch_city_catalog del tenant lo hace el caller (UI).
     */
    destinationCity?: string;
  },
): Promise<{ ok?: boolean; error?: string }> {
  if (!VALID_NEW_STATUSES.includes(newStatus)) {
    return { error: "Estado inválido." };
  }

  const destinationCity = options?.destinationCity?.trim();
  const note = options?.note?.trim();

  // Consolidar requiere city. Para volver a pendiente_consolidacion o incidencia,
  // no se toca la city (puede quedar de un consolidado previo).
  if (newStatus === "consolidado" && !destinationCity) {
    return { error: "Indicá la ciudad destino para consolidar." };
  }

  const supabase = await createClient();

  // Resolver tenant_id (necesario para el event)
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  // Leer current status para no insertar event redundante
  const { data: current, error: readErr } = await supabase
    .from("warehouse_receipts_cn")
    .select("status, receipt_code, destination_city")
    .eq("id", receiptId)
    .maybeSingle<{
      status: WarehouseReceiptStatus;
      receipt_code: string;
      destination_city: string | null;
    }>();

  if (readErr || !current) {
    return { error: "Recepción no encontrada." };
  }

  if (
    current.status === newStatus &&
    (newStatus !== "consolidado" || current.destination_city === destinationCity)
  ) {
    return { ok: true }; // no-op
  }

  // Update: solo persiste destination_city si estamos consolidando
  const patch: { status: WarehouseReceiptStatus; destination_city?: string } = {
    status: newStatus,
  };
  if (newStatus === "consolidado" && destinationCity) {
    patch.destination_city = destinationCity;
  }

  const { error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update(patch)
    .eq("id", receiptId);

  if (updateErr) {
    return { error: `No se pudo cambiar el estado: ${updateErr.message}` };
  }

  // Insertar event 'status_change' (o 'consolidated' / 'incident' según el destino)
  const eventType =
    newStatus === "consolidado"
      ? "consolidated"
      : newStatus === "incidencia"
        ? "incident"
        : "status_change";

  let description =
    note ||
    `Estado: ${current.status} → ${newStatus} · ${current.receipt_code}`;
  if (newStatus === "consolidado" && destinationCity) {
    description += ` · destino: ${destinationCity}`;
  }

  await supabase.from("warehouse_receipt_events").insert({
    tenant_id: link.tenant_id,
    receipt_id: receiptId,
    event_type: eventType,
    description,
  });

  revalidatePath("/studio/cn");
  revalidatePath("/studio/despacho");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// changeReceiptPaymentStatusAction (Opción A · SDD-0029)
//
// Admin marca pago del paquete · alimenta scoring de Despacho.
// Permitido en cualquier status (paquete pendiente, consolidado, etc).
// ─────────────────────────────────────────────────────────────

const VALID_PAYMENT_STATUSES = ["pagado", "parcial", "pendiente"] as const;
type PaymentStatusOpt = (typeof VALID_PAYMENT_STATUSES)[number];

export async function changeReceiptPaymentStatusAction(
  receiptId: string,
  newPaymentStatus: PaymentStatusOpt,
): Promise<{ ok?: boolean; error?: string }> {
  if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) {
    return { error: "Estado de pago inválido." };
  }

  const supabase = await createClient();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  const { data: current, error: readErr } = await supabase
    .from("warehouse_receipts_cn")
    .select("payment_status, receipt_code")
    .eq("id", receiptId)
    .maybeSingle<{ payment_status: PaymentStatusOpt; receipt_code: string }>();

  if (readErr || !current) {
    return { error: "Recepción no encontrada." };
  }

  if (current.payment_status === newPaymentStatus) {
    return { ok: true }; // no-op
  }

  const { error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update({ payment_status: newPaymentStatus })
    .eq("id", receiptId);

  if (updateErr) {
    return { error: `No se pudo cambiar el pago: ${updateErr.message}` };
  }

  // Audit event
  await supabase.from("warehouse_receipt_events").insert({
    tenant_id: link.tenant_id,
    receipt_id: receiptId,
    event_type: "status_change",
    description: `Pago: ${current.payment_status} → ${newPaymentStatus} · ${current.receipt_code}`,
  });

  revalidatePath("/studio/cn");
  revalidatePath("/studio/despacho");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Bulk actions · marcar N recibos en una sola operación
//
// MVP intencionalmente NO incluye bulk-consolidar (cada destino_city
// puede diferir por row · forzaría UI multi-step). Sí cubre pago bulk
// y status bulk excluyendo "consolidado" (pendiente / incidencia OK).
// ─────────────────────────────────────────────────────────────

const MAX_BULK_RECEIPTS = 100;

export async function bulkChangeReceiptPaymentStatusAction(
  receiptIds: string[],
  newPaymentStatus: PaymentStatusOpt,
): Promise<{ ok?: boolean; updated?: number; error?: string }> {
  if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
    return { error: "Seleccioná al menos 1 recepción." };
  }
  if (receiptIds.length > MAX_BULK_RECEIPTS) {
    return { error: `Máximo ${MAX_BULK_RECEIPTS} recepciones por bulk.` };
  }
  if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) {
    return { error: "Estado de pago inválido." };
  }

  const supabase = await createClient();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  // Update atómico · RLS filtra por tenant
  const { data: updated, error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update({ payment_status: newPaymentStatus })
    .in("id", receiptIds)
    .select("id");

  if (updateErr) {
    return { error: `No se pudo cambiar el pago: ${updateErr.message}` };
  }

  const updatedCount = updated?.length ?? 0;

  // Audit event 1 por receipt (best effort · no falla la operación)
  if (updatedCount > 0) {
    const events = (updated ?? []).map((r) => ({
      tenant_id: link.tenant_id,
      receipt_id: r.id,
      event_type: "status_change" as const,
      description: `Pago bulk → ${newPaymentStatus} (${updatedCount} recepciones)`,
    }));
    await supabase.from("warehouse_receipt_events").insert(events);
  }

  revalidatePath("/studio/cn");
  revalidatePath("/studio/despacho");
  return { ok: true, updated: updatedCount };
}

const BULK_VALID_STATUSES: WarehouseReceiptStatus[] = [
  "pendiente_consolidacion",
  "incidencia",
];

export async function bulkChangeReceiptStatusAction(
  receiptIds: string[],
  newStatus: (typeof BULK_VALID_STATUSES)[number],
): Promise<{ ok?: boolean; updated?: number; error?: string }> {
  if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
    return { error: "Seleccioná al menos 1 recepción." };
  }
  if (receiptIds.length > MAX_BULK_RECEIPTS) {
    return { error: `Máximo ${MAX_BULK_RECEIPTS} recepciones por bulk.` };
  }
  if (!BULK_VALID_STATUSES.includes(newStatus)) {
    return {
      error:
        "Bulk solo permite pendiente_consolidacion o incidencia. Consolidar requiere destino por row.",
    };
  }

  const supabase = await createClient();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  const { data: updated, error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update({ status: newStatus })
    .in("id", receiptIds)
    .select("id");

  if (updateErr) {
    return { error: `No se pudo cambiar el estado: ${updateErr.message}` };
  }

  const updatedCount = updated?.length ?? 0;
  if (updatedCount > 0) {
    const eventType = newStatus === "incidencia" ? "incident" : "status_change";
    const events = (updated ?? []).map((r) => ({
      tenant_id: link.tenant_id,
      receipt_id: r.id,
      event_type: eventType,
      description: `Estado bulk → ${newStatus} (${updatedCount} recepciones)`,
    }));
    await supabase.from("warehouse_receipt_events").insert(events);
  }

  revalidatePath("/studio/cn");
  revalidatePath("/studio/despacho");
  return { ok: true, updated: updatedCount };
}

// ─────────────────────────────────────────────────────────────
// softDeleteReceiptAction (no expuesto en UI V1)
// ─────────────────────────────────────────────────────────────

export async function softDeleteReceiptAction(
  receiptId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("warehouse_receipts_cn")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", receiptId);

  if (error) return { error: error.message };

  revalidatePath("/studio/cn");
  return { ok: true };
}

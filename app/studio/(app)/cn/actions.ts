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
  note?: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!VALID_NEW_STATUSES.includes(newStatus)) {
    return { error: "Estado inválido." };
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
    .select("status, receipt_code")
    .eq("id", receiptId)
    .maybeSingle<{ status: WarehouseReceiptStatus; receipt_code: string }>();

  if (readErr || !current) {
    return { error: "Recepción no encontrada." };
  }

  if (current.status === newStatus) {
    return { ok: true }; // no-op
  }

  const { error: updateErr } = await supabase
    .from("warehouse_receipts_cn")
    .update({ status: newStatus })
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

  const description =
    note?.trim() ||
    `Estado: ${current.status} → ${newStatus} · ${current.receipt_code}`;

  await supabase.from("warehouse_receipt_events").insert({
    tenant_id: link.tenant_id,
    receipt_id: receiptId,
    event_type: eventType,
    description,
  });

  revalidatePath("/studio/cn");
  return { ok: true };
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

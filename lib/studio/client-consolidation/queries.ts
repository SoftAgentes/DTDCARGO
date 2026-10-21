import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingNormalSchema, normalFlowError } from "./normal-flow";
import type {
  NormalContext, NormalContextPage, NormalManifest, NormalReceipt,
  NormalPlanInput, NormalRpcError, NormalShipmentContext, ObservedRates,
} from "./types";

export class NormalReadError extends Error {
  constructor(message: string, readonly code: "missing_schema" | "incomplete" | "unavailable") {
    super(message);
    this.name = "NormalReadError";
  }
}

type NormalAssociations = {
  available: boolean;
  receiptIds: string[];
  shipmentIds: string[];
  containerIds: string[];
  boxIds: string[];
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string") && new Set(value).size === value.length;
}

function whole(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function measures(value: unknown): boolean {
  return object(value) && typeof value.cbm === "string" && /^[0-9]+(?:\.[0-9]+)?$/.test(value.cbm)
    && !/^0*(?:\.0*)?$/.test(value.cbm) && typeof value.weightKg === "string"
    && /^[0-9]+(?:\.[0-9]+)?$/.test(value.weightKg) && whole(value.boxes) && value.boxes > 0;
}

function space(value: unknown): boolean {
  if (!object(value) || typeof value.code !== "string" || typeof value.label !== "string"
    || typeof value.cbmCapacity !== "number" || !Number.isFinite(value.cbmCapacity) || value.cbmCapacity <= 0
    || !object(value.layout)) return false;
  const layout = value.layout;
  return ["nx", "ny", "nz"].every((key) => whole(layout[key]) && Number(layout[key]) > 0);
}

function isRates(value: unknown): value is ObservedRates {
  if (!object(value) || !whole(value.membershipRevision) || !whole(value.receiptCount)
    || typeof value.observedAt !== "string" || !strings(value.snapshotIds) || !strings(value.missingReceiptIds)
    || typeof value.knownSubtotalCents !== "string" || !/^[0-9]+$/.test(value.knownSubtotalCents)
    || typeof value.complete !== "boolean") return false;
  if (value.snapshotIds.length + value.missingReceiptIds.length !== value.receiptCount) return false;
  return value.complete && value.missingReceiptIds.length === 0
    ? value.totalCents === value.knownSubtotalCents : value.totalCents === null;
}

function isManifest(value: unknown): value is NormalManifest {
  if (!object(value) || typeof value.containerId !== "string" || !whole(value.revision)
    || typeof value.status !== "string" || typeof value.sealed !== "boolean"
    || !(value.sealId === null || typeof value.sealId === "string")
    || typeof value.canConfirm !== "boolean" || typeof value.canClose !== "boolean"
    || !strings(value.expectedBoxIds) || !strings(value.stowedBoxIds) || !strings(value.missingBoxIds)
    || !strings(value.unexpectedBoxIds) || !Array.isArray(value.groups)) return false;
  if (!(value.currentPlan === null || (object(value.currentPlan) && typeof value.currentPlan.id === "string"
    && whole(value.currentPlan.version) && whole(value.currentPlan.manifestRevision)))) return false;
  return value.groups.every((group: unknown) => object(group)
    && ["groupId", "shipmentId", "itemId", "clientId", "clientMarkbox", "code", "destination", "status"].every((key) => typeof group[key] === "string")
    && (group.clientName === null || typeof group.clientName === "string")
    && ["consolidado_lcl", "puerta_a_puerta_DDP"].includes(String(group.service))
    && whole(group.revision) && strings(group.receiptIds) && strings(group.boxIds)
    && measures(group.measures) && isRates(group.rates));
}

function isReceipt(value: unknown): value is NormalReceipt {
  return object(value) && ["receiptId", "receiptCode", "warehouseId", "sourceVersion"].every((key) => typeof value[key] === "string")
    && ["clientId", "clientMarkbox", "clientName", "destination", "blockedReason", "shipmentId", "groupId"].every((key) => value[key] === null || typeof value[key] === "string")
    && (value.service === null || ["consolidado_lcl", "puerta_a_puerta_DDP"].includes(String(value.service)))
    && typeof value.eligible === "boolean"
    && (value.measures === null || measures(value.measures));
}

function page(value: unknown): NormalContextPage | null {
  if (!object(value) || !["off", "ready"].includes(String(value.availability)) || typeof value.readToken !== "string"
    || typeof value.observedAt !== "string" || !(value.manifest === null || isManifest(value.manifest))
    || !Array.isArray(value.destinations) || !value.destinations.every((d: unknown) => object(d) && typeof d.id === "string" && typeof d.label === "string" && typeof d.destination === "string")
    || !Array.isArray(value.receipts) || !value.receipts.every(isReceipt)
    || !(value.nextReceiptId === null || typeof value.nextReceiptId === "string")) return null;
  return value as NormalContextPage;
}

/**
 * Dedicated keyset reader. Each continuation must preserve the full input fingerprint.
 * A transport error, a repeated cursor or a changed page is NEVER an empty/complete list.
 */
export async function readNormalContext(supabase: SupabaseClient, containerId: string): Promise<NormalContext> {
  let after: string | null = null;
  let first: NormalContextPage | null = null;
  const receipts: NormalReceipt[] = [];
  const seen = new Set<string>();
  const cursors = new Set<string>();
  do {
    const { data, error } = await supabase.rpc("client_consolidation_read", {
      p_container_id: containerId, p_after_receipt_id: after, p_page_size: 200,
    });
    if (error) throw new NormalReadError(normalFlowError(error), isMissingNormalSchema(error) ? "missing_schema" : "unavailable");
    const current = page(data);
    if (!current) throw new NormalReadError("No se pudo leer el manifiesto completo.", "incomplete");
    if (first && (current.readToken !== first.readToken || current.availability !== first.availability)) {
      throw new NormalReadError("La carga cambió durante la lectura. Actualiza el manifiesto.", "incomplete");
    }
    first ??= current;
    for (const receipt of current.receipts) {
      if (seen.has(receipt.receiptId)) throw new NormalReadError("La lectura contiene recepciones repetidas. Actualiza el manifiesto.", "incomplete");
      seen.add(receipt.receiptId);
      receipts.push(receipt);
    }
    after = current.nextReceiptId;
    if (after !== null) {
      if (current.receipts.length === 0 || cursors.has(after)) throw new NormalReadError("La lectura quedó incompleta. Actualiza el manifiesto.", "incomplete");
      cursors.add(after);
    }
  } while (after !== null);
  return { availability: first!.availability, readToken: first!.readToken, observedAt: first!.observedAt,
    manifest: first!.manifest, destinations: first!.destinations, receipts, complete: true };
}

/** Used before every legacy writer, including BEFORE the C-/OV helper in CN. */
export async function readNormalAssociations(
  supabase: SupabaseClient,
  ids: { receiptIds?: readonly string[]; shipmentIds?: readonly string[]; containerIds?: readonly string[]; boxIds?: readonly string[] },
): Promise<NormalAssociations> {
  const { data, error } = await supabase.rpc("client_consolidation_scope", {
    p_receipt_ids: [...new Set(ids.receiptIds ?? [])].sort(),
    p_shipment_ids: [...new Set(ids.shipmentIds ?? [])].sort(),
    p_container_ids: [...new Set(ids.containerIds ?? [])].sort(),
    p_box_ids: [...new Set(ids.boxIds ?? [])].sort(),
  });
  // Missing RPC can also mean stale PostgREST metadata while enrolled rows do
  // exist. Never fall through to C-/OV or a generic writer on that uncertainty.
  if (isMissingNormalSchema(error)) throw new NormalReadError(normalFlowError(error), "missing_schema");
  if (error) throw new NormalReadError(normalFlowError(error), "unavailable");
  if (!object(data) || data.available !== true || !["receiptIds", "shipmentIds", "containerIds", "boxIds"].every((key) => strings(data[key]))) {
    throw new NormalReadError("No se pudo comprobar la pertenencia de la carga.", "incomplete");
  }
  return data as NormalAssociations;
}

export async function readNormalShipment(supabase: SupabaseClient, shipmentId: string): Promise<NormalShipmentContext> {
  const { data, error } = await supabase.rpc("client_consolidation_shipment", { p_shipment_id: shipmentId });
  if (isMissingNormalSchema(error)) throw new NormalReadError(normalFlowError(error), "missing_schema");
  if (error) throw new NormalReadError(normalFlowError(error), "unavailable");
  if (!object(data) || typeof data.cohort !== "boolean" || data.complete !== true
    || !(data.manifest === null || isManifest(data.manifest))) {
    throw new NormalReadError("No se pudo leer la pertenencia completa del envío.", "incomplete");
  }
  if (!data.cohort) return { cohort: false, group: null, manifest: null, complete: true };
  const manifest = data.manifest as NormalManifest | null;
  const group = manifest?.groups.find((g) => g.shipmentId === shipmentId);
  if (!manifest || !group) throw new NormalReadError("Falta la identidad completa del envío por cliente.", "incomplete");
  // The shipment reader only returns this client's group, never neighbouring identities.
  return { cohort: true, group, manifest, complete: true };
}

export function normalReadMessage(error: unknown): string {
  return error instanceof NormalReadError ? error.message : normalFlowError(error as NormalRpcError);
}

export async function readNormalPlanInput(supabase: SupabaseClient, containerId: string): Promise<NormalPlanInput> {
  const { data, error } = await supabase.rpc("client_consolidation_plan_input", { p_container_id: containerId });
  if (error) throw new NormalReadError(normalFlowError(error), isMissingNormalSchema(error) ? "missing_schema" : "unavailable");
  if (!object(data) || !whole(data.manifestRevision) || typeof data.manifestHash !== "string"
    || !whole(data.previousPlanVersion) || !object(data.groupRevisions) || !Object.values(data.groupRevisions).every(whole)
    || !Array.isArray(data.input) || data.input.length === 0 || !data.input.every((lot: unknown) => object(lot)
      && typeof lot.id === "string" && whole(lot.cajas) && lot.cajas > 0
      && typeof lot.cbm === "number" && Number.isFinite(lot.cbm) && lot.cbm > 0)
    || !space(data.space)) {
    throw new NormalReadError("No se pudo leer la carga completa para el plan.", "incomplete");
  }
  return data as NormalPlanInput;
}

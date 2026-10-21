import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingNormalSchema, normalFlowError } from "./normal-flow";
import { CONTAINER_STATUSES } from "../naviera/types";
import { STATUS_LABELS } from "../shipment-types";
import type {
  MembershipResult, NormalContext, NormalContextPage, NormalManifest, NormalMutationResult, NormalReceipt,
  NormalPlanInput, NormalRpcError, NormalShipmentContext, ObservedRates, NormalGroup, NormalMobileContext, CloseManifestResult,
} from "./types";

export class NormalReadError extends Error {
  constructor(message: string, readonly code: "missing_schema" | "incomplete" | "unavailable") {
    super(message);
    this.name = "NormalReadError";
  }
}

type NormalAssociations = {
  available: true;
  complete: true;
  /** Every requested entity was found in the authenticated tenant. */
  checked: { receiptIds: string[]; shipmentIds: string[]; containerIds: string[]; boxIds: string[] };
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
function instant(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}
function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const rightIds = new Set(right);
  return left.length === right.length && left.every((id) => rightIds.has(id));
}

function measures(value: unknown): boolean {
  return object(value) && typeof value.cbm === "string" && /^[0-9]+(?:\.[0-9]{1,3})?$/.test(value.cbm)
    && !/^0*(?:\.0*)?$/.test(value.cbm) && typeof value.weightKg === "string"
    && /^[0-9]+(?:\.[0-9]{1,2})?$/.test(value.weightKg) && whole(value.boxes) && value.boxes > 0;
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
    || !instant(value.observedAt) || !strings(value.snapshotIds) || !strings(value.missingReceiptIds)
    || typeof value.knownSubtotalCents !== "string" || !/^[0-9]+$/.test(value.knownSubtotalCents)
    || typeof value.complete !== "boolean") return false;
  if (value.snapshotIds.length + value.missingReceiptIds.length !== value.receiptCount) return false;
  return value.complete && value.missingReceiptIds.length === 0
    ? value.totalCents === value.knownSubtotalCents : value.totalCents === null;
}
function isGroup(group: unknown): group is NormalGroup {
  if (!object(group) || !["groupId", "shipmentId", "itemId", "clientId", "clientMarkbox", "code", "destinationId", "destination", "status"].every((key) => typeof group[key] === "string" && group[key].length > 0)
    || !(group.clientName === null || typeof group.clientName === "string")
    || !["consolidado_lcl", "puerta_a_puerta_DDP"].includes(String(group.service))
    || typeof group.status !== "string" || !Object.prototype.hasOwnProperty.call(STATUS_LABELS, group.status) || !whole(group.revision) || group.revision < 1
    || !strings(group.receiptIds) || group.receiptIds.length === 0 || !strings(group.boxIds)
    || !measures(group.measures) || !object(group.measures) || !isRates(group.rates)) return false;
  const receiptIds = group.receiptIds;
  return group.boxIds.length === group.measures.boxes && group.rates.membershipRevision === group.revision
    && group.rates.receiptCount === receiptIds.length && group.rates.missingReceiptIds.every((id) => receiptIds.includes(id));
}

function isManifest(value: unknown): value is NormalManifest {
  if (!object(value) || typeof value.containerId !== "string" || !whole(value.revision)
    || !CONTAINER_STATUSES.some((status) => status === value.status) || typeof value.sealed !== "boolean"
    || !(value.sealId === null || typeof value.sealId === "string")
    || typeof value.canConfirm !== "boolean" || typeof value.canClose !== "boolean"
    || !strings(value.expectedBoxIds) || !strings(value.stowedBoxIds) || !strings(value.missingBoxIds)
    || !strings(value.unexpectedBoxIds) || !Array.isArray(value.groups)) return false;
  if (!(value.currentPlan === null || (object(value.currentPlan) && typeof value.currentPlan.id === "string"
    && whole(value.currentPlan.version) && whole(value.currentPlan.manifestRevision)))) return false;
  if (!value.groups.every(isGroup) || value.sealed !== (value.sealId !== null)) return false;
  const groups = value.groups;
  if (![groups.map((group) => group.groupId), groups.map((group) => group.shipmentId), groups.map((group) => group.itemId), groups.map((group) => group.clientId)].every(strings)
    || !strings(groups.flatMap((group) => group.receiptIds)) || !strings(groups.flatMap((group) => group.boxIds))) return false;
  const stowed = new Set(value.stowedBoxIds); const expected = new Set(value.expectedBoxIds);
  return sameIds(groups.flatMap((group) => group.boxIds), value.expectedBoxIds)
    && sameIds(value.missingBoxIds, value.expectedBoxIds.filter((id) => !stowed.has(id)))
    && sameIds(value.unexpectedBoxIds, value.stowedBoxIds.filter((id) => !expected.has(id)))
    && (groups.length === 0 ? !value.sealed : value.revision > 0);
}

export function membershipResult(value: unknown): MembershipResult | null {
  if (!object(value) || !["confirmed", "replay"].includes(String(value.outcome)) || !["form", "extend"].includes(String(value.operation))
    || typeof value.reference !== "string" || !instant(value.occurredAt) || typeof value.containerId !== "string"
    || !whole(value.containerRevision) || value.containerRevision < 1 || !Array.isArray(value.groups)) return null;
  if (value.groups.length === 0 || !value.groups.every(isGroup)) return null;
  const groups = value.groups;
  return [groups.map((group) => group.groupId), groups.map((group) => group.shipmentId), groups.map((group) => group.itemId),
    groups.map((group) => group.clientId), groups.flatMap((group) => group.receiptIds), groups.flatMap((group) => group.boxIds)].every(strings)
    ? value as MembershipResult : null;
}

export function mutationResult(value: unknown): NormalMutationResult | null {
  return object(value) && ["closed", "transitioned", "recorded", "replay"].includes(String(value.outcome))
    && typeof value.reference === "string" && instant(value.occurredAt) ? value as NormalMutationResult : null;
}

/** A generic mutation envelope cannot certify a manifest seal. */
export function closeManifestResult(value: unknown): CloseManifestResult | null {
  const result = mutationResult(value);
  if (!result || !object(value) || (result.outcome !== "closed" && result.outcome !== "replay")
    || typeof value.containerId !== "string" || !value.containerId || !whole(value.containerRevision) || value.containerRevision < 1
    || typeof value.sealId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.sealId)
    || ["shipmentId", "from", "to", "status"].some((key) => value[key] !== undefined)) return null;
  return { ...result, outcome: result.outcome, containerId: value.containerId, containerRevision: value.containerRevision, sealId: value.sealId };
}

export async function readNormalMobileContext(supabase: SupabaseClient, operarioId: string, containerId: string): Promise<NormalMobileContext> {
  const { data, error } = await supabase.rpc("client_consolidation_operario_read", { p_operario_id: operarioId, p_container_id: containerId });
  if (error) throw new NormalReadError(normalFlowError(error), isMissingNormalSchema(error) ? "missing_schema" : "unavailable");
  if (!object(data) || data.available !== true || data.complete !== true || data.containerId !== containerId || typeof data.cohort !== "boolean"
    || !CONTAINER_STATUSES.some((status) => status === data.status) || typeof data.sealed !== "boolean"
    || !(data.cohort ? whole(data.revision) && data.revision > 0 : data.revision === null && data.sealed === false)
    || !strings(data.expectedBoxIds) || !strings(data.stowedBoxIds) || !strings(data.missingBoxIds) || !strings(data.unexpectedBoxIds)
    || !whole(data.stuffedCount) || data.stuffedCount !== data.stowedBoxIds.length || !whole(data.lotsCount)
    || data.lotsCount > data.stuffedCount) throw new NormalReadError("No se pudo comprobar la cobertura del contenedor.", "incomplete");
  if (data.cohort) {
    const stowed = new Set(data.stowedBoxIds); const expected = new Set(data.expectedBoxIds);
    if (!sameIds(data.missingBoxIds, data.expectedBoxIds.filter((id) => !stowed.has(id)))
      || !sameIds(data.unexpectedBoxIds, data.stowedBoxIds.filter((id) => !expected.has(id)))) {
      throw new NormalReadError("La cobertura no corresponde al manifiesto.", "incomplete");
    }
  } else if (data.expectedBoxIds.length || data.missingBoxIds.length || data.unexpectedBoxIds.length) {
    throw new NormalReadError("La clasificación legacy no es íntegra.", "incomplete");
  }
  if (data.plan !== null) {
    const plan = data.plan;
    if (!object(plan) || typeof plan.id !== "string" || !whole(plan.version) || plan.version < 1 || !whole(plan.nz) || plan.nz < 1
      || !whole(plan.totalLots) || !Array.isArray(plan.steps) || (data.cohort ? plan.manifestRevision !== data.revision : plan.manifestRevision !== null)
      || plan.steps.length > plan.totalLots || !plan.steps.every((step: unknown) => object(step)
        && (step.markbox === null || typeof step.markbox === "string") && typeof step.destination === "string"
        && whole(step.width) && step.width < plan.nz)) throw new NormalReadError("No se pudo comprobar la vigencia del plan.", "incomplete");
  }
  return data as NormalMobileContext;
}

function isReceipt(value: unknown): value is NormalReceipt {
  return object(value) && ["receiptId", "receiptCode", "warehouseId", "sourceVersion"].every((key) => typeof value[key] === "string")
    && ["clientId", "clientMarkbox", "clientName", "destination", "blockedReason", "shipmentId", "groupId"].every((key) => value[key] === null || typeof value[key] === "string")
    && (value.service === null || ["consolidado_lcl", "puerta_a_puerta_DDP"].includes(String(value.service)))
    && typeof value.eligible === "boolean"
    && (value.rate === null || (object(value.rate) && typeof value.rate.snapshotId === "string"
      && typeof value.rate.amountCents === "string" && /^[0-9]+$/.test(value.rate.amountCents)))
    && (value.measures === null || measures(value.measures));
}

function page(value: unknown): NormalContextPage | null {
  if (!object(value) || !["off", "ready"].includes(String(value.availability)) || typeof value.readToken !== "string"
    || !instant(value.observedAt) || !(value.manifest === null || isManifest(value.manifest))
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
    if ((current.manifest !== null && current.manifest.containerId !== containerId)
      || (current.availability === "off" && (current.manifest !== null || current.receipts.length > 0))) {
      throw new NormalReadError("La lectura no corresponde al contexto completo solicitado.", "incomplete");
    }
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
  if ([ids.receiptIds, ids.shipmentIds, ids.containerIds, ids.boxIds].some((values) => values !== undefined && !strings(values))) {
    throw new NormalReadError("La consulta de pertenencia contiene identidades repetidas o inválidas.", "incomplete");
  }
  const requested = { receiptIds: [...new Set(ids.receiptIds ?? [])].sort(), shipmentIds: [...new Set(ids.shipmentIds ?? [])].sort(),
    containerIds: [...new Set(ids.containerIds ?? [])].sort(), boxIds: [...new Set(ids.boxIds ?? [])].sort() };
  const { data, error } = await supabase.rpc("client_consolidation_scope", { p_receipt_ids: requested.receiptIds,
    p_shipment_ids: requested.shipmentIds, p_container_ids: requested.containerIds, p_box_ids: requested.boxIds });
  // Missing RPC can also mean stale PostgREST metadata while enrolled rows do
  // exist. Never fall through to C-/OV or a generic writer on that uncertainty.
  if (isMissingNormalSchema(error)) throw new NormalReadError(normalFlowError(error), "missing_schema");
  if (error) throw new NormalReadError(normalFlowError(error), "unavailable");
  const keys = ["receiptIds", "shipmentIds", "containerIds", "boxIds"] as const;
  const checked = object(data) && object(data.checked) ? data.checked : null;
  if (!object(data) || data.available !== true || data.complete !== true || !checked
    || !keys.every((key) => {
      const cohort = data[key];
      const covered = checked[key];
      return strings(covered) && strings(cohort)
        && covered.length === requested[key].length && covered.every((id) => requested[key].includes(id))
        && cohort.every((id) => requested[key].includes(id));
    })) {
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
  if (data.shipmentId !== shipmentId || (!data.cohort && data.manifest !== null)) {
    throw new NormalReadError("La pertenencia no corresponde al envío solicitado.", "incomplete");
  }
  if (!data.cohort) return { shipmentId, cohort: false, group: null, manifest: null, complete: true };
  const manifest = data.manifest as NormalManifest | null;
  const group = manifest?.groups.find((g) => g.shipmentId === shipmentId);
  if (!manifest || !group || manifest.groups.length !== 1) throw new NormalReadError("Falta la identidad completa del envío por cliente.", "incomplete");
  // The shipment reader only returns this client's group, never neighbouring identities.
  return { shipmentId, cohort: true, group, manifest, complete: true };
}

export async function readNormalManifest(supabase: SupabaseClient, containerId: string): Promise<NormalManifest> {
  const { data, error } = await supabase.rpc("client_consolidation_manifest", { p_container_id: containerId });
  if (error) throw new NormalReadError(normalFlowError(error), isMissingNormalSchema(error) ? "missing_schema" : "unavailable");
  if (!object(data) || data.complete !== true || !isManifest(data.manifest) || data.manifest.containerId !== containerId) {
    throw new NormalReadError("No se pudo leer el manifiesto completo del contenedor.", "incomplete");
  }
  return data.manifest;
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

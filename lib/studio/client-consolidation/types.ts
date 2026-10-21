/** SDD-0578: the prospective path is identified by a durable DB enrolment. */
import type { ShipmentService, ShipmentStatus } from "../shipment-types";
import type { EspacioCarga, Lote } from "@/lib/shared/estiba-plan";
import type { ContainerStatus } from "../naviera/types";

export type NormalService = Extract<ShipmentService, "consolidado_lcl" | "puerta_a_puerta_DDP">;
export type MembershipOperation = "form" | "extend";

export type FixedMeasures = {
  cbm: string;
  weightKg: string;
  boxes: number;
};

/** A read projection, never a balance or an invoice. Amounts are integer cents. */
export type ObservedRates = {
  membershipRevision: number;
  observedAt: string;
  snapshotIds: string[];
  receiptCount: number;
  missingReceiptIds: string[];
  knownSubtotalCents: string;
  totalCents: string | null;
  complete: boolean;
};

export type NormalReceipt = {
  receiptId: string;
  receiptCode: string;
  warehouseId: string;
  clientId: string | null;
  clientMarkbox: string | null;
  /** Omitted by the RPC when the current operator cannot see names. */
  clientName: string | null;
  service: NormalService | null;
  destination: string | null;
  measures: FixedMeasures | null;
  sourceVersion: string;
  eligible: boolean;
  blockedReason: string | null;
  shipmentId: string | null;
  groupId: string | null;
  rate: { snapshotId: string; amountCents: string } | null;
};

export type NormalGroup = {
  groupId: string;
  shipmentId: string;
  itemId: string;
  clientId: string;
  clientMarkbox: string;
  clientName: string | null;
  code: string;
  service: NormalService;
  destinationId: string;
  destination: string;
  revision: number;
  status: ShipmentStatus;
  receiptIds: string[];
  boxIds: string[];
  measures: FixedMeasures;
  rates: ObservedRates;
};

export type NormalManifest = {
  containerId: string;
  revision: number;
  status: ContainerStatus;
  sealed: boolean;
  sealId: string | null;
  canConfirm: boolean;
  canClose: boolean;
  groups: NormalGroup[];
  expectedBoxIds: string[];
  stowedBoxIds: string[];
  missingBoxIds: string[];
  unexpectedBoxIds: string[];
  currentPlan: { id: string; version: number; manifestRevision: number } | null;
};

/** Canonical CN/dispatch city text is distinct from the disambiguated picker label. */
export type NormalDestination = { id: string; label: string; destination: string };

/** Every page carries the same server fingerprint; a changed page invalidates the read. */
export type NormalContextPage = {
  availability: "off" | "ready";
  readToken: string;
  observedAt: string;
  manifest: NormalManifest | null;
  destinations: NormalDestination[];
  receipts: NormalReceipt[];
  nextReceiptId: string | null;
};

export type NormalContext = Omit<NormalContextPage, "nextReceiptId"> & {
  complete: true;
};

export type ReceiptSelection = { receiptId: string; sourceVersion: string };

export type GroupSelection = {
  clientId: string;
  service: NormalService;
  destinationId: string;
  /** Required only for a NEW group; extending cannot rename an existing code. */
  code: string | null;
  groupId: string | null;
  expectedGroupRevision: number | null;
  receipts: ReceiptSelection[];
};

export type ConfirmMembershipInput = {
  operation: MembershipOperation;
  containerId: string;
  expectedContainerRevision: number;
  reference: string;
  reason: string;
  groups: GroupSelection[];
};

/** Historical result of one durable intention; current state is read separately. */
export type MembershipResult = {
  outcome: "confirmed" | "replay";
  operation: MembershipOperation;
  reference: string;
  occurredAt: string;
  containerId: string;
  containerRevision: number;
  groups: NormalGroup[];
};

export type CloseManifestInput = {
  containerId: string;
  expectedContainerRevision: number;
  reference: string;
  reason: string;
};

export type NormalMutationResult = {
  outcome: "closed" | "transitioned" | "recorded" | "replay";
  reference: string;
  occurredAt: string;
  shipmentId?: string;
  containerId?: string;
  containerRevision?: number;
  sealId?: string;
  from?: ShipmentStatus;
  to?: ShipmentStatus;
  status?: ShipmentStatus;
};

export type CloseManifestResult = NormalMutationResult & {
  outcome: "closed" | "replay";
  containerId: string;
  containerRevision: number;
  sealId: string;
};

export type NormalPlanInput = {
  manifestRevision: number;
  manifestHash: string;
  groupRevisions: Record<string, number>;
  previousPlanVersion: number;
  input: Lote[];
  space: EspacioCarga;
};

export type NormalShipmentContext = {
  shipmentId: string;
  cohort: boolean;
  group: NormalGroup | null;
  manifest: NormalManifest | null;
  complete: boolean;
};
export type NormalShipmentRead = { available: true; context: NormalShipmentContext } | { available: false; error: string };

export type NormalTransition = "transit" | "release_ve" | "dispatch_ve";
export type NormalTransitionInput = {
  shipmentId: string;
  operation: NormalTransition;
  expectedStatus: ShipmentStatus;
  expectedGroupRevision: number;
  expectedContainerRevision: number;
  reference: string;
  reason: string;
  /** Existing VE delivery address/note; never an authority claim. */
  deliveryAddress?: string;
  note?: string;
};
export type NormalNoteInput = {
  shipmentId: string; expectedStatus: ShipmentStatus; expectedGroupRevision: number; expectedContainerRevision: number;
  reference: string; reason: string; note: string;
};
export type NormalDeliveryInput = Omit<NormalNoteInput, "note"> & {
  sealId: string; receiptIds: string[]; receivedBy: string; attestComplete: true;
};

export type NormalActionState<T = MembershipResult> = {
  ok?: true;
  result?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
  warning?: string;
};

export type NormalRpcError = { code?: string; message?: string; hint?: string | null };

/** Operario projection: no client names, rates or neighbouring shipment data. */
export type NormalMobileContext = {
  available: true; complete: true; containerId: string; cohort: boolean; revision: number | null; sealed: boolean;
  status: ContainerStatus; expectedBoxIds: string[]; stowedBoxIds: string[]; missingBoxIds: string[]; unexpectedBoxIds: string[];
  stuffedCount: number; lotsCount: number;
  plan: null | { id: string; version: number; manifestRevision: number | null; nz: number; totalLots: number;
    steps: Array<{ markbox: string | null; destination: string; width: number }> };
};

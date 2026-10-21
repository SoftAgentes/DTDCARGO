/** Pure validation/projection. SQL remains the authority for identity, scope and locks. */
import { validateAuditReason } from "../audit/reason";
import type {
  CloseManifestInput, ConfirmMembershipInput, GroupSelection, NormalActionState,
  NormalRpcError, NormalService, ObservedRates, ReceiptSelection,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_VERSION = /^[0-9a-f]{32,64}$/;
const MANUAL_CODE = /^S-[0-9]{4}-[0-9]{4,10}$/;
const SERVICES: readonly NormalService[] = ["consolidado_lcl", "puerta_a_puerta_DDP"];

/** Matches SQL btrim(text) (ASCII SPACE), deliberately NOT JavaScript trim(). */
export function normalizeManualShipmentCode(raw: unknown): string {
  return (typeof raw === "string" ? raw : "").replace(/^ +| +$/g, "").toUpperCase();
}

export function manualShipmentCodeError(raw: unknown): string | null {
  const code = normalizeManualShipmentCode(raw);
  // JS `$` also matches before a final line break; SQL's exact canonical
  // value must not inherit that extra acceptance from the UI validator.
  return code.match(MANUAL_CODE)?.[0] === code
    ? null
    : "Usa S-, cuatro dígitos de año y de cuatro a diez dígitos de correlativo.";
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function uuid(raw: unknown): string | null {
  return typeof raw === "string" && raw.length === 36 && UUID.test(raw) ? raw.toLowerCase() : null;
}

function revision(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
}

function selection(raw: unknown): ReceiptSelection[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const seen = new Set<string>();
  const receipts: ReceiptSelection[] = [];
  for (const entry of raw) {
    const value = record(entry);
    const receiptId = uuid(value?.receiptId);
    const sourceVersion = value?.sourceVersion;
    if (!receiptId || seen.has(receiptId) || typeof sourceVersion !== "string" || sourceVersion.match(SOURCE_VERSION)?.[0] !== sourceVersion) return null;
    seen.add(receiptId);
    receipts.push({ receiptId, sourceVersion });
  }
  return receipts.sort((a, b) => a.receiptId.localeCompare(b.receiptId));
}

/** The browser sends fixed source versions, not client-authored measures or hashes. */
export function validateMembershipInput(raw: unknown): {
  input?: ConfirmMembershipInput;
  fieldErrors?: Record<string, string>;
} {
  const value = record(raw);
  if (!value) return { fieldErrors: { selection: "Revisa la selección." } };
  const fieldErrors: Record<string, string> = {};
  const operation = value.operation;
  const containerId = uuid(value.containerId);
  const expectedContainerRevision = revision(value.expectedContainerRevision);
  const reference = uuid(value.reference);
  const reason = validateAuditReason(value.reason);
  if (operation !== "form" && operation !== "extend") fieldErrors.selection = "Operación inválida.";
  if (!containerId) fieldErrors.container = "Selecciona un contenedor.";
  if (expectedContainerRevision == null) fieldErrors.revision = "Actualiza la revisión del contenedor.";
  if (!reference) fieldErrors.reference = "Falta la referencia del intento. Vuelve a revisar la selección.";
  if (!reason.ok) fieldErrors.reason = reason.error;
  const groups: GroupSelection[] = [];
  const clients = new Set<string>();
  const receipts = new Set<string>();
  const codes = new Set<string>();
  if (!Array.isArray(value.groups) || value.groups.length === 0) {
    fieldErrors.selection = "Selecciona recepciones para confirmar.";
  } else {
    if (operation === "extend" && value.groups.length !== 1) fieldErrors.selection = "Agrega carga a un envío por operación.";
    for (const [index, rawGroup] of value.groups.entries()) {
      const group = record(rawGroup);
      const clientId = uuid(group?.clientId);
      const destinationId = uuid(group?.destinationId);
      const service = group?.service as NormalService;
      const selected = selection(group?.receipts);
      const groupId = group?.groupId == null ? null : uuid(group.groupId);
      const expectedGroupRevision = group?.expectedGroupRevision == null ? null : revision(group.expectedGroupRevision);
      const code = operation === "form" ? normalizeManualShipmentCode(group?.code) : null;
      let invalid = !clientId || !destinationId || !SERVICES.includes(service) || !selected;
      if (clientId && clients.has(clientId)) invalid = true;
      if (clientId) clients.add(clientId);
      if (selected) for (const receipt of selected) {
        if (receipts.has(receipt.receiptId)) invalid = true;
        receipts.add(receipt.receiptId);
      }
      if (operation === "form") {
        if (manualShipmentCodeError(code) || codes.has(code!) || group?.groupId != null || group?.expectedGroupRevision != null) invalid = true;
        if (code) codes.add(code);
      } else if (!groupId || expectedGroupRevision == null || group?.code != null) {
        invalid = true;
      }
      if (invalid) fieldErrors[`group.${index}`] = "Revisa cliente, servicio, destino, código y recepciones. No se admiten duplicados.";
      else groups.push({ clientId: clientId!, destinationId: destinationId!, service, code, groupId, expectedGroupRevision, receipts: selected! });
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: {
    operation: operation as ConfirmMembershipInput["operation"], containerId: containerId!,
    expectedContainerRevision: expectedContainerRevision!, reference: reference!,
    reason: reason.ok ? reason.reason : "", groups: groups.sort((a, b) => a.clientId.localeCompare(b.clientId)),
  } };
}

export function membershipRpcArgs(input: ConfirmMembershipInput): Record<string, unknown> {
  return {
    p_operation: input.operation, p_container_id: input.containerId,
    p_expected_revision: input.expectedContainerRevision, p_reference: input.reference,
    p_reason: input.reason, p_groups: input.groups,
  };
}

export function validateCloseManifestInput(raw: unknown): {
  input?: CloseManifestInput; fieldErrors?: Record<string, string>;
} {
  const value = record(raw);
  const containerId = uuid(value?.containerId);
  const expectedContainerRevision = revision(value?.expectedContainerRevision);
  const reference = uuid(value?.reference);
  const reason = validateAuditReason(value?.reason);
  const errors: Record<string, string> = {};
  if (!containerId || expectedContainerRevision == null) errors.revision = "Actualiza el manifiesto completo antes de cerrar.";
  if (!reference) errors.reference = "Falta la referencia del cierre.";
  if (!reason.ok) errors.reason = reason.error;
  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { input: { containerId: containerId!, expectedContainerRevision: expectedContainerRevision!, reference: reference!, reason: reason.ok ? reason.reason : "" } };
}

/** No Number conversion: the maximum generated SQL numeric can exceed safe cents. */
export function observedRatesTotal(parts: readonly ObservedRates[]): {
  knownSubtotalCents: string; totalCents: string | null; missing: number; complete: boolean;
} {
  let known = BigInt(0);
  let missing = 0;
  let complete = true;
  for (const part of parts) {
    if (!/^[0-9]+$/.test(part.knownSubtotalCents)) throw new Error("La tarifa observada no es válida.");
    known += BigInt(part.knownSubtotalCents);
    missing += part.missingReceiptIds.length;
    complete = complete && part.complete;
    if (part.totalCents !== null && part.totalCents !== part.knownSubtotalCents) throw new Error("La tarifa observada no es coherente.");
    if (part.totalCents === null) complete = false;
  }
  return { knownSubtotalCents: known.toString(), totalCents: complete && missing === 0 ? known.toString() : null, missing, complete };
}

export const LEGACY_COHORT_DENIAL = "Esta recepción o envío usa el manifiesto por cliente. Abre el contenedor para continuar.";

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NORMAL_FORBIDDEN: "No tienes permiso para esta operación.",
  NORMAL_OFF: "El camino por cliente no está habilitado para este ámbito.",
  NORMAL_PREREQUISITE: "Falta un prerrequisito del camino por cliente. No se guardó ningún cambio.",
  NORMAL_CONFLICT: "La carga o su revisión cambió. Actualiza y revisa la selección.",
  NORMAL_INTENT_CONFLICT: "Esta referencia corresponde a otro intento. Revisa el resultado anterior.",
  NORMAL_CODE_UNAVAILABLE: "Código no disponible.",
  NORMAL_INVALID_CODE: "El código no tiene el formato S-AAAA-NNNN requerido.",
  NORMAL_INCOMPLETE: "No se pudo leer el manifiesto completo. Actualiza antes de continuar.",
  NORMAL_INCOMPATIBLE: "Hay carga incompatible con el cliente, servicio o destino del envío.",
  NORMAL_COVERAGE: "Falta estibar parte del manifiesto o hay cajas ajenas. Revisa la cobertura.",
  NORMAL_SEALED: "El manifiesto está sellado. No admite cambios de carga.",
  NORMAL_GOVERNED: LEGACY_COHORT_DENIAL,
};

export function isMissingNormalSchema(error: NormalRpcError | null | undefined): boolean {
  return !!error && ["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "");
}

/** Never expose raw SQL, another tenant's identity, or existence through the error. */
export function normalFlowError(error: NormalRpcError | null | undefined): string {
  if (isMissingNormalSchema(error)) return ERROR_MESSAGES.NORMAL_PREREQUISITE;
  if (error?.hint === "dtd-client-normal") {
    return ERROR_MESSAGES[(error.message ?? "").split(":")[0]] ?? "No se pudo confirmar la operación. Revisa el manifiesto e inténtalo de nuevo.";
  }
  return "No se pudo confirmar la operación. Conserva la referencia y revisa el manifiesto antes de reintentar.";
}

export function invalidMembershipState(fieldErrors: Record<string, string>): NormalActionState {
  return { fieldErrors, error: "Revisa los campos indicados. La selección se conserva." };
}

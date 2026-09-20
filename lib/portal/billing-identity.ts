/**
 * SDD-0487 · Identidad de facturación del cliente del Portal.
 *
 * Cada cliente tiene una identidad PRINCIPAL (la de su registro: persona con
 * cédula o empresa con RIF) y puede agregar una SECUNDARIA del tipo opuesto:
 * la empresa de una persona, o los datos personales de una empresa. Con
 * «Facturar a nombre de» elige cuál sale en sus próximas facturas; el Studio la
 * sella al emitir (migración 0466). Nada de esto gasta los 3 cambios del perfil.
 *
 * PURO: normaliza y valida antes de llamar a las RPC de 0466, que repiten las
 * reglas en SQL. Sin I/O.
 */
import {
  normalizeDocByKind,
  type ClientDocKind,
} from "@/lib/studio/client-types";

export type BillingKind = ClientDocKind;

export type BillingIdentity = {
  kind: BillingKind;
  legalName: string;
  doc: string;
  fiscalAddress: string | null;
};

export type BillingProfile = {
  principalKind: BillingKind;
  principalName: string;
  principalDoc: string | null;
  secondary: BillingIdentity | null;
  billingKind: BillingKind;
};

/** La secundaria siempre es del tipo opuesto a la principal. */
export function secondaryKindFor(principal: ClientDocKind | null | undefined): BillingKind {
  return principal === "empresa" ? "persona" : "empresa";
}

export type BillingIdentityInput = {
  legalName: string;
  doc: string;
  fiscalAddress: string;
};

export type BillingIdentityField = "legalName" | "doc" | "fiscalAddress";

export type BillingIdentityValidation =
  | { ok: true; values: { legalName: string; doc: string; fiscalAddress: string | null } }
  | { ok: false; fieldErrors: Partial<Record<BillingIdentityField, string>> };

export function validateBillingIdentity(
  kind: BillingKind,
  input: BillingIdentityInput,
): BillingIdentityValidation {
  const fieldErrors: Partial<Record<BillingIdentityField, string>> = {};

  const legalName = input.legalName.trim().replace(/\s+/g, " ");
  if (legalName.length < 2 || legalName.length > 200) {
    fieldErrors.legalName =
      kind === "empresa"
        ? "Escribe la razón social tal como aparece en el RIF."
        : "Escribe tu nombre completo.";
  }

  const doc = normalizeDocByKind(kind, input.doc);
  if (!doc) {
    fieldErrors.doc =
      kind === "empresa"
        ? "RIF inválido. Formato J-12345678-9."
        : "Cédula o pasaporte inválido. Formato V-12345678 o P-A1234567.";
  }

  const fiscalAddress = input.fiscalAddress.trim().replace(/\s+/g, " ");
  if (kind === "empresa" && fiscalAddress && (fiscalAddress.length < 5 || fiscalAddress.length > 300)) {
    fieldErrors.fiscalAddress = "El domicilio fiscal debe tener entre 5 y 300 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0 || !doc) return { ok: false, fieldErrors };
  return {
    ok: true,
    values: {
      legalName,
      doc,
      // Sólo una empresa lleva domicilio fiscal en la factura.
      fiscalAddress: kind === "empresa" && fiscalAddress ? fiscalAddress : null,
    },
  };
}

export type BillingOutcome =
  | "applied"
  | "no_changes"
  | "blocked"
  | "rate_limited"
  | "missing_identity";

export function isBillingOutcome(value: unknown): value is BillingOutcome {
  return (
    value === "applied" ||
    value === "no_changes" ||
    value === "blocked" ||
    value === "rate_limited" ||
    value === "missing_identity"
  );
}

/** Mensajes al cliente. `blocked` no revela que el documento exista en otra ficha. */
export const BILLING_MESSAGES = {
  noChanges: "No cambiaste ningún dato.",
  blocked: "No pudimos guardar ese dato. Escríbenos por soporte y lo revisamos.",
  rateLimited:
    "Por seguridad, espera 24 horas para volver a cambiar un documento, o escríbenos por soporte.",
  missingIdentity: "Primero agrega esos datos para poder facturar a ese nombre.",
  unavailable: "No está disponible ahora. Prueba de nuevo en un rato.",
  failed: "No pudimos guardar tus datos. Prueba de nuevo.",
} as const;

function isKind(value: unknown): value is BillingKind {
  return value === "persona" || value === "empresa";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Lee la respuesta de `portal_get_my_billing_profile`. Algo raro → null. */
export function parseBillingProfile(raw: unknown): BillingProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (!isKind(row.principal_kind) || !isKind(row.billing_kind)) return null;

  let secondary: BillingIdentity | null = null;
  if (row.secondary && typeof row.secondary === "object") {
    const s = row.secondary as Record<string, unknown>;
    const legalName = text(s.legal_name);
    const doc = text(s.doc);
    if (!isKind(s.kind) || !legalName || !doc) return null;
    secondary = { kind: s.kind, legalName, doc, fiscalAddress: text(s.fiscal_address) };
  }

  return {
    principalKind: row.principal_kind,
    principalName: text(row.principal_name) ?? "",
    principalDoc: text(row.principal_doc),
    secondary,
    billingKind: row.billing_kind,
  };
}

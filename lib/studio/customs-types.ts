/**
 * Tipos + labels + tones + helpers del módulo Aduana SENIAT (SDD-0018).
 *
 * Matchea schema de supabase/migrations/0010_customs_seniat.sql.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─────────────────────────────────────────────────────────────
// Enums (matchean Postgres)
// ─────────────────────────────────────────────────────────────

export type CustomsStatus =
  | "en_revision"
  | "observacion"
  | "liberacion"
  | "pagado"
  | "liberado";

export type CustomsDocType =
  | "commercial"
  | "packing"
  | "bl"
  | "cert_origin"
  | "sanitary"
  | "dua"
  | "payment";

// ─────────────────────────────────────────────────────────────
// Row types
// ─────────────────────────────────────────────────────────────

export type CustomsAgent = {
  id: string;
  code: string;
  name: string;
  rif: string | null;
  port_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  shipments_count: number;
  active: boolean;
  notes: string | null;
  created_at: string;
};

export type CustomsFiling = {
  id: string;
  tenant_id: string;
  shipment_id: string;
  dua_code: string;
  port_code: string;
  agent_id: string | null;
  status: CustomsStatus;
  hs_codes: string[];
  total_duty: number;
  igtf: number;
  iva: number;
  agent_fee: number;
  observations: string | null;
  alert: string | null;
  arrived_at: string;
  cleared_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomsDocument = {
  id: string;
  tenant_id: string;
  filing_id: string;
  doc_type: CustomsDocType;
  uploaded: boolean;
  uploaded_at: string | null;
  uploaded_by: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Filing + agente joined + counts de docs (para listado). */
export type CustomsFilingRow = CustomsFiling & {
  agent: Pick<CustomsAgent, "id" | "code" | "name" | "rating"> | null;
  shipment: {
    id: string;
    code: string;
    client_name: string | null;
    client_markbox: string | null;
  } | null;
  docs_uploaded: number;
  docs_total: number;
  total: number; // computed sum de duty+igtf+iva+agent_fee
};

// ─────────────────────────────────────────────────────────────
// Labels + tonos
// ─────────────────────────────────────────────────────────────

export const CUSTOMS_STATUS_LABELS: Record<CustomsStatus, string> = {
  en_revision: "En revisión",
  observacion: "Observación",
  liberacion: "Por liberar",
  pagado: "Pagado",
  liberado: "Liberado",
};

export const CUSTOMS_STATUS_TONES: Record<CustomsStatus, BadgeTone> = {
  en_revision: "info",
  observacion: "danger",
  liberacion: "info",
  pagado: "info",
  liberado: "success",
};

export const CUSTOMS_STATUS_OPTIONS: { value: CustomsStatus; label: string }[] =
  (Object.keys(CUSTOMS_STATUS_LABELS) as CustomsStatus[]).map((s) => ({
    value: s,
    label: CUSTOMS_STATUS_LABELS[s],
  }));

// Documentos
export const CUSTOMS_DOC_LABELS: Record<CustomsDocType, string> = {
  commercial: "Factura comercial",
  packing: "Packing list",
  bl: "Bill of Lading (BL)",
  cert_origin: "Certificado de origen",
  sanitary: "Permiso sanitario",
  dua: "DUA firmada",
  payment: "Comprobante pago aranceles",
};

export const CUSTOMS_DOC_REQUIRED: Record<CustomsDocType, boolean> = {
  commercial: true,
  packing: true,
  bl: true,
  cert_origin: true,
  sanitary: false,
  dua: true,
  payment: true,
};

/** Orden canónico para mostrar el checklist (matchea JSX). */
export const CUSTOMS_DOC_ORDER: CustomsDocType[] = [
  "commercial",
  "packing",
  "bl",
  "cert_origin",
  "sanitary",
  "dua",
  "payment",
];

// ─────────────────────────────────────────────────────────────
// Puertos VE (catálogo hardcoded V1)
// ─────────────────────────────────────────────────────────────

export const VE_PORTS: { code: string; name: string; state: string }[] = [
  { code: "PBL", name: "Puerto Cabello", state: "Carabobo" },
  { code: "LGU", name: "La Guaira", state: "La Guaira" },
  { code: "MAR", name: "Maracaibo", state: "Zulia" },
  { code: "PFI", name: "Punto Fijo", state: "Falcón" },
];

export function vePortLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const p = VE_PORTS.find((x) => x.code === code);
  return p ? `${p.name} · ${code}` : code;
}

// ─────────────────────────────────────────────────────────────
// Helpers de cálculo
// ─────────────────────────────────────────────────────────────

export function filingTotal(f: {
  total_duty: number | string;
  igtf: number | string;
  iva: number | string;
  agent_fee: number | string;
}): number {
  return (
    Number(f.total_duty || 0) +
    Number(f.igtf || 0) +
    Number(f.iva || 0) +
    Number(f.agent_fee || 0)
  );
}

export type DocsProgress = {
  done: number;
  total: number;
  requiredDone: number;
  requiredTotal: number;
  pct: number;
  missingRequired: CustomsDocType[];
};

export function computeFilingDocsProgress(
  docs: Pick<CustomsDocument, "doc_type" | "uploaded">[],
): DocsProgress {
  const done = docs.filter((d) => d.uploaded).length;
  const total = docs.length;
  const required = docs.filter((d) => CUSTOMS_DOC_REQUIRED[d.doc_type]);
  const requiredDone = required.filter((d) => d.uploaded).length;
  const requiredTotal = required.length;
  const missingRequired = required
    .filter((d) => !d.uploaded)
    .map((d) => d.doc_type);
  return {
    done,
    total,
    requiredDone,
    requiredTotal,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
    missingRequired,
  };
}

// IVA/IGTF tasas vigentes 2026 — V1 hardcoded
export const IVA_RATE = 0.16;
export const IGTF_RATE = 0.03;

// ─────────────────────────────────────────────────────────────
// Form input + validación
// ─────────────────────────────────────────────────────────────

export type CustomsFilingInput = {
  shipment_id: string;
  agent_id: string | null;
  port_code: string;
  hs_codes: string[];
  total_duty: number;
  igtf: number;
  iva: number;
  agent_fee: number;
  observations: string | null;
};

export type CustomsFilingActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof CustomsFilingInput, string>>;
  createdId?: string;
  createdDuaCode?: string;
};

export type CustomsClearanceInput = {
  filing_id: string;
  from: "pagado";
  effective_date: string;
  reason: string;
  request_ref: string;
};

export type CustomsClearanceValidation =
  | { ok: true; input: CustomsClearanceInput }
  | { ok: false; error: string };

/** Contrato público de la decisión R3 `pagado → liberado`. */
export function validateCustomsClearanceInput(
  raw: Record<string, unknown>,
  today = new Date().toISOString().slice(0, 10),
): CustomsClearanceValidation {
  const filingId = String(raw.filing_id ?? "").trim();
  const from = String(raw.from ?? "").trim();
  const effectiveDate = String(raw.effective_date ?? "").trim();
  const reason = String(raw.reason ?? "").trim();
  const requestRef = String(raw.request_ref ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filingId)) {
    return { ok: false, error: "Trámite aduanal inválido." };
  }
  if (from !== "pagado") {
    return { ok: false, error: "El trámite cambió de estado. Actualiza la página." };
  }
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
    ? new Date(`${effectiveDate}T00:00:00.000Z`)
    : null;
  if (
    !parsedDate ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== effectiveDate ||
    effectiveDate > today
  ) {
    return { ok: false, error: "La fecha efectiva debe ser válida y no futura." };
  }
  if (reason.length < 4 || reason.length > 1_000) {
    return { ok: false, error: "El motivo debe tener entre 4 y 1000 caracteres." };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(requestRef)) {
    return { ok: false, error: "La referencia de la operación es inválida." };
  }

  return {
    ok: true,
    input: {
      filing_id: filingId,
      from: "pagado",
      effective_date: effectiveDate,
      reason,
      request_ref: requestRef,
    },
  };
}

const HS_RE = /^\d{4}\.\d{2}(\.\d{2})?$/;

export function validateFilingInput(
  input: Partial<CustomsFilingInput>,
): {
  input?: CustomsFilingInput;
  fieldErrors?: CustomsFilingActionState["fieldErrors"];
} {
  const errors: CustomsFilingActionState["fieldErrors"] = {};

  const shipment_id = input.shipment_id?.trim() ?? "";
  if (!shipment_id) errors.shipment_id = "Indica el shipment.";

  const port_code = input.port_code?.trim() ?? "";
  if (!port_code) errors.port_code = "Indica el puerto.";
  else if (!VE_PORTS.some((p) => p.code === port_code)) {
    errors.port_code = `Puerto desconocido (esperados: ${VE_PORTS.map((p) => p.code).join(", ")}).`;
  }

  const hs_codes = (input.hs_codes ?? [])
    .map((h) => h.trim())
    .filter(Boolean);
  if (hs_codes.length === 0) {
    errors.hs_codes = "Agrega al menos 1 HS code.";
  } else if (hs_codes.some((h) => !HS_RE.test(h))) {
    errors.hs_codes = "Formato HS inválido (esperado 0000.00 o 0000.00.00).";
  }

  const checkNum = (
    raw: unknown,
    key: keyof Pick<
      CustomsFilingInput,
      "total_duty" | "igtf" | "iva" | "agent_fee"
    >,
  ): number => {
    const n = Number(raw ?? 0);
    if (!Number.isFinite(n) || n < 0) {
      errors[key] = "Debe ser un número >= 0.";
      return 0;
    }
    return n;
  };

  const total_duty = checkNum(input.total_duty, "total_duty");
  const igtf = checkNum(input.igtf, "igtf");
  const iva = checkNum(input.iva, "iva");
  const agent_fee = checkNum(input.agent_fee, "agent_fee");

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      shipment_id,
      agent_id: input.agent_id?.trim() || null,
      port_code,
      hs_codes,
      total_duty,
      igtf,
      iva,
      agent_fee,
      observations: input.observations?.trim() || null,
    },
  };
}

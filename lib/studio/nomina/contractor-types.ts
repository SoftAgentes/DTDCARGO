/**
 * Tipos + helpers PUROS del módulo Nómina · Prestadores (SDD-0103 · Slice A).
 * Matchea supabase/migrations/0161_nomina_contractors.sql.
 *
 * Prestadores freelance (pago por sesión, fuera de la nómina fija) + sus pagos.
 * Reusa los helpers base (num/round2/strOrNull) y tonos de `employee-types`.
 */

import {
  num,
  round2,
  strOrNull,
  type NominaBadgeTone,
} from "./employee-types";

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado del prestador · activo / inactivo                   ║
// ╚═══════════════════════════════════════════════════════════╝
export type ContractorStatus = "activo" | "inactivo";

export const CONTRACTOR_STATUSES: ContractorStatus[] = ["activo", "inactivo"];

export const CONTRACTOR_STATUS_META: Record<
  ContractorStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  activo: { label: "Activo", tone: "success" },
  inactivo: { label: "Inactivo", tone: "neutral" },
};

export function contractorStatusLabel(s: string): string {
  return CONTRACTOR_STATUS_META[s as ContractorStatus]?.label ?? s;
}
export function contractorStatusTone(s: string): NominaBadgeTone {
  return CONTRACTOR_STATUS_META[s as ContractorStatus]?.tone ?? "neutral";
}
export function isContractorStatus(v: unknown): v is ContractorStatus {
  return typeof v === "string" && (CONTRACTOR_STATUSES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                          ║
// ╚═══════════════════════════════════════════════════════════╝
export type Contractor = {
  id: string;
  tenant_id: string;
  full_name: string;
  service: string;
  phone: string | null;
  national_id: string | null;
  default_rate_usd: number;
  status: ContractorStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ContractorPayment = {
  id: string;
  tenant_id: string;
  contractor_id: string;
  paid_on: string;
  concept: string;
  amount_usd: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ContractorKpis = {
  active_count: number;
  total_count: number;
  payments_count: number;
  /** Σ de todos los pagos vivos (USD). */
  total_paid_usd: number;
};

/** KPIs de la pestaña Prestadores (PURO — testeable sin DB). */
export function computeContractorKpis(
  contractors: { status: ContractorStatus }[],
  payments: { amount_usd: unknown }[],
): ContractorKpis {
  let active = 0;
  for (const c of contractors) if (c.status === "activo") active += 1;
  let paid = 0;
  for (const p of payments) paid += num(p.amount_usd);
  return {
    active_count: active,
    total_count: contractors.length,
    payments_count: payments.length,
    total_paid_usd: round2(paid),
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input (sin Zod)                              ║
// ╚═══════════════════════════════════════════════════════════╝
export type ContractorInput = {
  full_name: string;
  service: string;
  phone: string | null;
  national_id: string | null;
  default_rate_usd: number;
  status: ContractorStatus;
  notes: string | null;
};

export function validateContractorInput(
  raw: Partial<Record<string, unknown>>,
): { input: ContractorInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const fullName = String(raw.full_name ?? "").trim();
  if (!fullName) errors.full_name = "Indica el nombre del prestador.";
  else if (fullName.length > 120) errors.full_name = "Nombre demasiado largo (máx 120).";

  const service = String(raw.service ?? "").trim();
  if (!service) errors.service = "Indica el servicio que presta.";
  else if (service.length > 120) errors.service = "Servicio demasiado largo (máx 120).";

  const rate = Number(raw.default_rate_usd ?? 0);
  if (!Number.isFinite(rate) || rate < 0) {
    errors.default_rate_usd = "La tarifa no puede ser negativa.";
  }

  const status = String(raw.status ?? "activo").trim();
  if (!isContractorStatus(status)) errors.status = "Estado inválido.";

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      full_name: fullName,
      service,
      phone: strOrNull(raw.phone),
      national_id: strOrNull(raw.national_id),
      default_rate_usd: round2(rate),
      status: status as ContractorStatus,
      notes: strOrNull(raw.notes),
    },
  };
}

export type ContractorPaymentInput = {
  contractor_id: string;
  paid_on: string;
  concept: string;
  amount_usd: number;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateContractorPaymentInput(
  raw: Partial<Record<string, unknown>>,
): { input: ContractorPaymentInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const contractorId = String(raw.contractor_id ?? "").trim();
  if (!contractorId) errors.contractor_id = "Indica el prestador.";

  const concept = String(raw.concept ?? "").trim();
  if (!concept) errors.concept = "Describe el concepto del pago.";
  else if (concept.length > 200) errors.concept = "Concepto demasiado largo (máx 200).";

  const amount = Number(raw.amount_usd ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount_usd = "El monto debe ser mayor a 0.";
  }

  const paidOnRaw = strOrNull(raw.paid_on);
  let paidOn = paidOnRaw;
  if (paidOnRaw !== null && (!ISO_DATE_RE.test(paidOnRaw) || Number.isNaN(Date.parse(paidOnRaw)))) {
    errors.paid_on = "Fecha inválida.";
    paidOn = null;
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      contractor_id: contractorId,
      paid_on: paidOn ?? new Date().toISOString().slice(0, 10),
      concept,
      amount_usd: round2(amount),
    },
  };
}

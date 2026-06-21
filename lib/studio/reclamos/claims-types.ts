/**
 * Tipos + helpers PUROS del módulo Reclamos y siniestros del cliente
 * (SDD-0101 · Slice A). Matchea el schema de
 * supabase/migrations/0152_client_claims.sql.
 *
 * Lado CLIENTE (incidencia post-venta) — NO confundir con
 * `supplier_claim_offsets` (SDD-0059, lado proveedor / cruce contable).
 *
 * Sin React, sin server-only → importable desde client y server. Validadores
 * manuales (no Zod, patrón del repo). Montos `numeric` llegan de Supabase como
 * string → se coercen a number con `num()`.
 */

// Tonos del set del sistema (los que acepta <Badge>).
export type ClaimBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Coacciona un valor crudo a número finito (default 0). */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Tipo de reclamo · daño / faltante / retraso / otro         ║
// ╚═══════════════════════════════════════════════════════════╝
export type ClaimType = "dano" | "faltante" | "retraso" | "otro";

export const CLAIM_TYPES: ClaimType[] = ["dano", "faltante", "retraso", "otro"];

export const CLAIM_TYPE_META: Record<
  ClaimType,
  { label: string; tone: ClaimBadgeTone }
> = {
  dano: { label: "Daño", tone: "danger" },
  faltante: { label: "Faltante", tone: "warning" },
  retraso: { label: "Retraso", tone: "info" },
  otro: { label: "Otro", tone: "neutral" },
};

export const CLAIM_TYPE_OPTIONS: { value: ClaimType; label: string }[] =
  CLAIM_TYPES.map((t) => ({ value: t, label: CLAIM_TYPE_META[t].label }));

export function claimTypeLabel(t: string): string {
  return CLAIM_TYPE_META[t as ClaimType]?.label ?? t;
}
export function claimTypeTone(t: string): ClaimBadgeTone {
  return CLAIM_TYPE_META[t as ClaimType]?.tone ?? "neutral";
}
export function isClaimType(v: unknown): v is ClaimType {
  return typeof v === "string" && (CLAIM_TYPES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado · máquina reportado → … → terminal                  ║
// ╚═══════════════════════════════════════════════════════════╝
export type ClaimStatus =
  | "reportado"
  | "evaluacion"
  | "aprobado"
  | "pagado"
  | "resuelto"
  | "rechazado";

export const CLAIM_STATUSES: ClaimStatus[] = [
  "reportado",
  "evaluacion",
  "aprobado",
  "pagado",
  "resuelto",
  "rechazado",
];

export const CLAIM_STATUS_META: Record<
  ClaimStatus,
  { label: string; tone: ClaimBadgeTone }
> = {
  reportado: { label: "Reportado", tone: "info" },
  evaluacion: { label: "En evaluación", tone: "warning" },
  aprobado: { label: "Aprobado", tone: "info" },
  pagado: { label: "Pagado", tone: "success" },
  resuelto: { label: "Resuelto", tone: "success" },
  rechazado: { label: "Rechazado", tone: "neutral" },
};

export function claimStatusLabel(s: string): string {
  return CLAIM_STATUS_META[s as ClaimStatus]?.label ?? s;
}
export function claimStatusTone(s: string): ClaimBadgeTone {
  return CLAIM_STATUS_META[s as ClaimStatus]?.tone ?? "neutral";
}
export function isClaimStatus(v: unknown): v is ClaimStatus {
  return typeof v === "string" && (CLAIM_STATUSES as string[]).includes(v);
}

/** Estados no terminales = "abiertos" (cuentan para KPIs y filtro). */
export const CLAIM_OPEN_STATUSES: ClaimStatus[] = [
  "reportado",
  "evaluacion",
  "aprobado",
];

export function isClaimOpen(s: ClaimStatus): boolean {
  return CLAIM_OPEN_STATUSES.includes(s);
}
export function isClaimTerminal(s: ClaimStatus): boolean {
  return !isClaimOpen(s);
}

/**
 * Transiciones válidas (§3 del spec). `pagado | resuelto | rechazado` son
 * terminales (no salen).
 */
export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  reportado: ["evaluacion", "rechazado"],
  evaluacion: ["aprobado", "rechazado"],
  aprobado: ["pagado", "resuelto"],
  pagado: [],
  resuelto: [],
  rechazado: [],
};

export function claimNextStatuses(from: ClaimStatus): ClaimStatus[] {
  return CLAIM_TRANSITIONS[from] ?? [];
}

/** ¿Es válido pasar el reclamo de `from` a `to`? */
export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  if (from === to) return false;
  return (CLAIM_TRANSITIONS[from] ?? []).includes(to);
}

/** Label del botón que ejecuta la transición hacia `to`. */
export const CLAIM_TRANSITION_LABEL: Record<ClaimStatus, string> = {
  reportado: "Volver a reportado",
  evaluacion: "Iniciar evaluación",
  aprobado: "Aprobar",
  pagado: "Marcar pagada",
  resuelto: "Marcar resuelto",
  rechazado: "Rechazar",
};

// ── Stepper de 3 fases (Reportado / Evaluación / Resolución) ───
export const CLAIM_FLOW_STEPS = ["Reportado", "Evaluación", "Resolución"] as const;

const CLAIM_STATUS_STEP: Record<ClaimStatus, 1 | 2 | 3> = {
  reportado: 1,
  evaluacion: 2,
  aprobado: 2,
  pagado: 3,
  resuelto: 3,
  rechazado: 3,
};

/** Fase del flujo (1..3) que ilumina el estado actual. */
export function claimStatusStep(s: ClaimStatus): 1 | 2 | 3 {
  return CLAIM_STATUS_STEP[s] ?? 1;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Resolución financiera (Slice C) · parte responsable        ║
// ╚═══════════════════════════════════════════════════════════╝
export type FaultParty =
  | "proveedor"
  | "dtd"
  | "transportista"
  | "cliente"
  | "indeterminado";

export const FAULT_PARTIES: FaultParty[] = [
  "proveedor",
  "dtd",
  "transportista",
  "cliente",
  "indeterminado",
];

export const FAULT_PARTY_META: Record<FaultParty, { label: string }> = {
  proveedor: { label: "Proveedor (fábrica)" },
  dtd: { label: "DTD / consolidación" },
  transportista: { label: "Transportista / naviera" },
  cliente: { label: "Cliente" },
  indeterminado: { label: "Indeterminado" },
};

export const FAULT_PARTY_OPTIONS: { value: FaultParty; label: string }[] =
  FAULT_PARTIES.map((f) => ({ value: f, label: FAULT_PARTY_META[f].label }));

export function faultPartyLabel(f: string): string {
  return FAULT_PARTY_META[f as FaultParty]?.label ?? f;
}
export function isFaultParty(v: unknown): v is FaultParty {
  return typeof v === "string" && (FAULT_PARTIES as string[]).includes(v);
}

// ── Medio de pago de la indemnización (Slice C2) → cuenta del asiento ──
export type ClaimPaymentMethod = "cash" | "transfer" | "usdt";

export const CLAIM_PAYMENT_METHODS: ClaimPaymentMethod[] = [
  "cash",
  "transfer",
  "usdt",
];

export const CLAIM_PAYMENT_METHOD_META: Record<
  ClaimPaymentMethod,
  { label: string }
> = {
  cash: { label: "Caja / efectivo" },
  transfer: { label: "Banco (transferencia)" },
  usdt: { label: "Banco USD / USDT" },
};

export const CLAIM_PAYMENT_METHOD_OPTIONS: {
  value: ClaimPaymentMethod;
  label: string;
}[] = CLAIM_PAYMENT_METHODS.map((m) => ({
  value: m,
  label: CLAIM_PAYMENT_METHOD_META[m].label,
}));

export function claimPaymentMethodLabel(m: string): string {
  return CLAIM_PAYMENT_METHOD_META[m as ClaimPaymentMethod]?.label ?? m;
}
export function isClaimPaymentMethod(v: unknown): v is ClaimPaymentMethod {
  return typeof v === "string" && (CLAIM_PAYMENT_METHODS as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida + KPIs derivados                           ║
// ╚═══════════════════════════════════════════════════════════╝
export type ClientClaim = {
  id: string;
  tenant_id: string;
  claim_code: string;
  client_id: string | null;
  client_markbox: string | null;
  client_name: string | null;
  shipment_id: string | null;
  shipment_code: string | null;
  container_code: string | null;
  claim_type: ClaimType;
  description: string;
  amount_usd: number;
  insured: boolean;
  status: ClaimStatus;
  resolution_note: string | null;
  evaluated_at: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/**
 * Resolución financiera del reclamo (Slice C) — fila de `client_claim_financials`,
 * una TABLA SEPARADA solo-equipo (el portal nunca la ve). 1:1 con el reclamo.
 */
export type ClaimFinancials = {
  claim_id: string;
  fault_party: FaultParty | null;
  supplier_claim_offset_id: string | null;
  insured_amount_usd: number | null;
  policy_deductible_usd: number | null;
  insurer_claim_ref: string | null;
  payment_method: ClaimPaymentMethod;
};

export type ClaimKpis = {
  open_count: number;
  exposed_usd: number;
  insured_count: number;
  total_count: number;
  paid_usd: number;
};

/**
 * KPIs del módulo (mock §5). PURO — testeable sin DB.
 *  - abiertos      = estados no terminales.
 *  - monto expuesto = Σ amount de los abiertos.
 *  - con seguro    = count(insured).
 *  - pagado        = Σ amount de los `pagado` (indemnizaciones).
 */
export function computeClaimKpis(
  claims: { status: ClaimStatus; amount_usd: unknown; insured: boolean }[],
): ClaimKpis {
  let open = 0;
  let exposed = 0;
  let insured = 0;
  let paid = 0;
  for (const c of claims) {
    const amt = num(c.amount_usd);
    if (isClaimOpen(c.status)) {
      open += 1;
      exposed += amt;
    }
    if (c.insured) insured += 1;
    if (c.status === "pagado") paid += amt;
  }
  return {
    open_count: open,
    exposed_usd: round2(exposed),
    insured_count: insured,
    total_count: claims.length,
    paid_usd: round2(paid),
  };
}

// ── Filtros del listado (client-side, deep-link por URL) ───────
export type ClaimFilter =
  | "todos"
  | "abiertos"
  | "evaluacion"
  | "aprobado"
  | "pagado"
  | "rechazado";

export const CLAIM_FILTERS: { value: ClaimFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "abiertos", label: "Abiertos" },
  { value: "evaluacion", label: "En evaluación" },
  { value: "aprobado", label: "Aprobados" },
  { value: "pagado", label: "Pagados" },
  { value: "rechazado", label: "Rechazados" },
];

export function isClaimFilter(v: unknown): v is ClaimFilter {
  return (
    typeof v === "string" &&
    CLAIM_FILTERS.some((f) => f.value === v)
  );
}

export function claimMatchesFilter(
  claim: { status: ClaimStatus },
  filter: ClaimFilter,
): boolean {
  if (filter === "todos") return true;
  if (filter === "abiertos") return isClaimOpen(claim.status);
  return claim.status === filter;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input (sin Zod) + estado de la action        ║
// ╚═══════════════════════════════════════════════════════════╝
export type ClaimInput = {
  client_id: string;
  shipment_id: string | null;
  container_code: string | null;
  claim_type: ClaimType;
  description: string;
  amount_usd: number;
  insured: boolean;
};

export type ClaimActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Code del reclamo recién creado (para toast + highlight). */
  createdCode?: string;
};

export function validateClaimInput(
  raw: Partial<Record<string, unknown>>,
): { input: ClaimInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const clientId = String(raw.client_id ?? "").trim();
  if (!clientId) errors.client_id = "Indica el cliente del reclamo.";

  const claimType = String(raw.claim_type ?? "").trim();
  if (!isClaimType(claimType)) errors.claim_type = "Tipo de reclamo inválido.";

  const description = String(raw.description ?? "").trim();
  if (!description) errors.description = "Describe la incidencia.";

  const amount = Number(raw.amount_usd ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    errors.amount_usd = "El monto no puede ser negativo.";
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      client_id: clientId,
      shipment_id: strOrNull(raw.shipment_id),
      container_code: strOrNull(raw.container_code),
      claim_type: claimType as ClaimType,
      description,
      amount_usd: round2(amount),
      insured: raw.insured === true || raw.insured === "true" || raw.insured === "on",
    },
  };
}

// ── Resolución financiera · validador (Slice C) ───────────────
export type ClaimFinancialsInput = {
  fault_party: FaultParty | null;
  supplier_claim_offset_id: string | null;
  insured_amount_usd: number | null;
  policy_deductible_usd: number | null;
  insurer_claim_ref: string | null;
  payment_method: ClaimPaymentMethod;
};

export function validateClaimFinancialsInput(
  raw: Partial<Record<string, unknown>>,
): { input: ClaimFinancialsInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const faultRaw = strOrNull(raw.fault_party);
  let fault: FaultParty | null = null;
  if (faultRaw !== null) {
    if (!isFaultParty(faultRaw)) errors.fault_party = "Parte responsable inválida.";
    else fault = faultRaw;
  }

  const insured = numOrNull(raw.insured_amount_usd);
  if (insured !== null && !(Number.isFinite(insured) && insured >= 0)) {
    errors.insured_amount_usd = "Monto cubierto inválido.";
  }
  const deductible = numOrNull(raw.policy_deductible_usd);
  if (deductible !== null && !(Number.isFinite(deductible) && deductible >= 0)) {
    errors.policy_deductible_usd = "Deducible inválido.";
  }

  const pmRaw = strOrNull(raw.payment_method);
  let paymentMethod: ClaimPaymentMethod = "transfer";
  if (pmRaw !== null) {
    if (!isClaimPaymentMethod(pmRaw)) errors.payment_method = "Medio de pago inválido.";
    else paymentMethod = pmRaw;
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      fault_party: fault,
      supplier_claim_offset_id: strOrNull(raw.supplier_claim_offset_id),
      insured_amount_usd:
        insured !== null && Number.isFinite(insured) ? insured : null,
      policy_deductible_usd:
        deductible !== null && Number.isFinite(deductible) ? deductible : null,
      insurer_claim_ref: strOrNull(raw.insurer_claim_ref),
      payment_method: paymentMethod,
    },
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? round2(n) : Number.NaN;
}

// ── helper local ──────────────────────────────────────────────
function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

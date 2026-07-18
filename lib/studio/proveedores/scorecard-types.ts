/**
 * SDD-0111 · Scorecard de proveedores — capa pura de tipos, fórmula y validadores.
 *
 * La FÓRMULA vive acá (un solo lugar lógico) y es ESPEJO EXACTO de la VIEW
 * supplier_scorecard_v (migr 0236). Adoptada del Norte
 * (docs/design/studio/_norte/proveedores/scorecard.js) tal cual:
 *   score = round(on_time%*0.40 + calidad%*0.40 + max(0,100-defecto%*6)*0.20)
 *   grade = >=90 A · >=82 B · >=72 C · else D    (sin datos → null "Sin datos")
 *
 * Validadores MANUALES (sin Zod, convención del repo) + máquina de estados del
 * reclamo al proveedor. Si la VIEW SQL y estas funciones divergen es un bug.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ── Reclamo al proveedor · enums ────────────────────────────────
export const SUPPLIER_CLAIM_KINDS = [
  "dano",
  "faltante",
  "calidad",
  "retraso",
  "otro",
] as const;
export type SupplierClaimKind = (typeof SUPPLIER_CLAIM_KINDS)[number];

export const SUPPLIER_CLAIM_STATUSES = [
  "abierto",
  "en_revision",
  "resuelto",
  "rechazado",
] as const;
export type SupplierClaimStatus = (typeof SUPPLIER_CLAIM_STATUSES)[number];

/** Grade del scorecard. null = sin historial (orders_count = 0). */
export type SupplierGrade = "A" | "B" | "C" | "D" | null;

// ── Labels + tonos (Norte → tonos del Studio) ───────────────────
const KIND_LABELS: Record<SupplierClaimKind, string> = {
  dano: "Daño",
  faltante: "Faltante",
  calidad: "Calidad",
  retraso: "Retraso",
  otro: "Otro",
};
export function supplierClaimKindLabel(k: SupplierClaimKind): string {
  return KIND_LABELS[k] ?? k;
}

const STATUS_LABELS: Record<SupplierClaimStatus, string> = {
  abierto: "Abierto",
  en_revision: "En revisión",
  resuelto: "Resuelto",
  rechazado: "Rechazado",
};
export function supplierClaimStatusLabel(s: SupplierClaimStatus): string {
  return STATUS_LABELS[s] ?? s;
}

/** Tono del badge de estado (statusTone del Norte → tonos del Studio). */
export function supplierClaimStatusTone(s: SupplierClaimStatus): BadgeTone {
  switch (s) {
    case "resuelto":
      return "success";
    case "rechazado":
      return "neutral";
    case "en_revision":
      return "info";
    case "abierto":
    default:
      return "wine";
  }
}

/**
 * Tono del badge del grade (gradeTone del Norte → tonos del Studio):
 * A=success · B=info · C=warning · D=danger · sin datos=neutral.
 */
export function gradeBadgeTone(g: SupplierGrade): BadgeTone {
  switch (g) {
    case "A":
      return "success";
    case "B":
      return "info";
    case "C":
      return "warning";
    case "D":
      return "danger";
    default:
      return "neutral";
  }
}

// ── Máquina de estados del reclamo ──────────────────────────────
// abierto → en_revision → (resuelto | rechazado). Sin ciclos hacia atrás en
// la UI feliz, pero se permite reabrir (en_revision/resuelto/rechazado →
// abierto) por si se marcó por error.
const TRANSITIONS: Record<SupplierClaimStatus, SupplierClaimStatus[]> = {
  abierto: ["en_revision", "rechazado"],
  en_revision: ["resuelto", "rechazado", "abierto"],
  resuelto: ["abierto"],
  rechazado: ["abierto"],
};

export function nextSupplierClaimStatuses(
  from: SupplierClaimStatus,
): SupplierClaimStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransitionSupplierClaim(
  from: SupplierClaimStatus,
  to: SupplierClaimStatus,
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminalSupplierClaimStatus(s: SupplierClaimStatus): boolean {
  return s === "resuelto" || s === "rechazado";
}

// ── Fórmula del score (ESPEJO de la VIEW supplier_scorecard_v) ───

/** Umbrales de grade del Norte (A≥90 · B≥82 · C≥72 · D<72). */
export const GRADE_THRESHOLDS = { A: 90, B: 82, C: 72 } as const;

/**
 * Score 0..100 a partir de los tres porcentajes. Pesos del Norte:
 * on-time 40% · calidad 40% · rechazo 20% (con castigo lineal 6× al defecto,
 * piso en 0). round half-away-from-zero (Math.round, igual que la SQL round()).
 */
export function computeScore(
  onTimePct: number,
  qualityPct: number,
  defectPct: number,
): number {
  const raw =
    onTimePct * 0.4 +
    qualityPct * 0.4 +
    Math.max(0, 100 - defectPct * 6) * 0.2;
  return Math.round(raw);
}

/** Grade a partir del score ya calculado (umbrales del Norte). */
export function computeGrade(score: number): "A" | "B" | "C" | "D" {
  if (score >= GRADE_THRESHOLDS.A) return "A";
  if (score >= GRADE_THRESHOLDS.B) return "B";
  if (score >= GRADE_THRESHOLDS.C) return "C";
  return "D";
}

/** Señales crudas de una ficha (denominador + numeradores). */
export interface SupplierSignalTotals {
  ordersCount: number;
  onTimeCount: number;
  conformingCount: number;
  /** Reclamos vivos (no borrados) — numerador del defect_pct. */
  claimsCount: number;
}

export interface SupplierScorecardComputed {
  onTimePct: number | null;
  qualityPct: number | null;
  defectPct: number | null;
  score: number | null;
  grade: SupplierGrade;
}

/**
 * Deriva los % + score + grade desde los conteos crudos. Sin denominador
 * (ordersCount = 0) → todo null y grade null ("Sin datos"): NO se pinta 'D'
 * a un proveedor nuevo sin historial (bug clásico de división por cero).
 */
export function computeScorecard(
  totals: SupplierSignalTotals,
): SupplierScorecardComputed {
  const { ordersCount, onTimeCount, conformingCount, claimsCount } = totals;
  if (ordersCount <= 0) {
    return {
      onTimePct: null,
      qualityPct: null,
      defectPct: null,
      score: null,
      grade: null,
    };
  }
  const onTimePct = round2((100 * onTimeCount) / ordersCount);
  const qualityPct = round2((100 * conformingCount) / ordersCount);
  const defectPct = round2((100 * claimsCount) / ordersCount);
  const score = computeScore(onTimePct, qualityPct, defectPct);
  return {
    onTimePct,
    qualityPct,
    defectPct,
    score,
    grade: computeGrade(score),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Validadores manuales (sin Zod) ──────────────────────────────

export interface OrderSignalInput {
  supplierCnId: string;
  purchaseOrderId: string | null;
  clientMarkbox: string | null;
  onTime: boolean;
  conforming: boolean;
  expectedAt: string | null; // ISO date (YYYY-MM-DD) o null
  receivedAt: string | null;
  notes: string | null;
}

export interface OrderSignalValidation {
  input?: OrderSignalInput;
  fieldErrors?: Partial<Record<keyof OrderSignalInput, string>>;
  error?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateOrderSignalInput(raw: {
  supplierCnId?: string | null;
  purchaseOrderId?: string | null;
  clientMarkbox?: string | null;
  onTime?: boolean;
  conforming?: boolean;
  expectedAt?: string | null;
  receivedAt?: string | null;
  notes?: string | null;
}): OrderSignalValidation {
  const fieldErrors: Partial<Record<keyof OrderSignalInput, string>> = {};

  const supplierCnId = (raw.supplierCnId ?? "").trim();
  if (!supplierCnId) {
    fieldErrors.supplierCnId = "Falta el proveedor a evaluar.";
  } else if (!UUID_RE.test(supplierCnId)) {
    fieldErrors.supplierCnId = "Proveedor inválido.";
  }

  const purchaseOrderId = (raw.purchaseOrderId ?? "").trim() || null;
  if (purchaseOrderId && !UUID_RE.test(purchaseOrderId)) {
    fieldErrors.purchaseOrderId = "Orden de compra inválida.";
  }

  const expectedAt = (raw.expectedAt ?? "").trim() || null;
  if (expectedAt && !DATE_RE.test(expectedAt)) {
    fieldErrors.expectedAt = "Fecha prometida inválida (AAAA-MM-DD).";
  }
  const receivedAt = (raw.receivedAt ?? "").trim() || null;
  if (receivedAt && !DATE_RE.test(receivedAt)) {
    fieldErrors.receivedAt = "Fecha de recepción inválida (AAAA-MM-DD).";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      supplierCnId,
      purchaseOrderId,
      clientMarkbox: (raw.clientMarkbox ?? "").trim() || null,
      onTime: raw.onTime !== false, // default optimista (§6.2)
      conforming: raw.conforming !== false,
      expectedAt,
      receivedAt,
      notes: (raw.notes ?? "").trim() || null,
    },
  };
}

export interface SupplierClaimInput {
  supplierCnId: string;
  purchaseOrderId: string | null;
  clientMarkbox: string | null;
  kind: SupplierClaimKind;
  amountUsd: number;
  description: string;
}

export interface SupplierClaimValidation {
  input?: SupplierClaimInput;
  fieldErrors?: Partial<Record<keyof SupplierClaimInput, string>>;
  error?: string;
}

export function validateSupplierClaimInput(raw: {
  supplierCnId?: string | null;
  purchaseOrderId?: string | null;
  clientMarkbox?: string | null;
  kind?: string | null;
  amountUsd?: number | string | null;
  description?: string | null;
}): SupplierClaimValidation {
  const fieldErrors: Partial<Record<keyof SupplierClaimInput, string>> = {};

  const supplierCnId = (raw.supplierCnId ?? "").trim();
  if (!supplierCnId) {
    fieldErrors.supplierCnId = "Elige el proveedor reclamado.";
  } else if (!UUID_RE.test(supplierCnId)) {
    fieldErrors.supplierCnId = "Proveedor inválido.";
  }

  const purchaseOrderId = (raw.purchaseOrderId ?? "").trim() || null;
  if (purchaseOrderId && !UUID_RE.test(purchaseOrderId)) {
    fieldErrors.purchaseOrderId = "Orden de compra inválida.";
  }

  const kindRaw = (raw.kind ?? "").trim();
  if (!(SUPPLIER_CLAIM_KINDS as readonly string[]).includes(kindRaw)) {
    fieldErrors.kind = "Elige el tipo de reclamo.";
  }

  // Monto advisory: ≥ 0, coma o punto decimal, opcional (default 0).
  let amountUsd = 0;
  const amtRaw =
    raw.amountUsd == null ? "" : String(raw.amountUsd).trim();
  if (amtRaw) {
    const n = Number(amtRaw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      fieldErrors.amountUsd = "El monto debe ser un número válido (o vacío).";
    } else {
      amountUsd = Math.round(n * 100) / 100;
    }
  }

  const description = (raw.description ?? "").trim();
  if (!description) {
    fieldErrors.description = "Describe qué pasó con la mercancía.";
  } else if (description.length > 2000) {
    fieldErrors.description = "La descripción es demasiado larga.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      supplierCnId,
      purchaseOrderId,
      clientMarkbox: (raw.clientMarkbox ?? "").trim() || null,
      kind: kindRaw as SupplierClaimKind,
      amountUsd,
      description,
    },
  };
}

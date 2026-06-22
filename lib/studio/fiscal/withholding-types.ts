/**
 * Tipos + helpers PUROS de Retenciones (SDD-0104 · Slice B).
 *
 * DTD, como agente de retención, emite comprobantes de retención de IVA (p.ej.
 * 75% sobre el IVA de una compra) e ISLR (honorarios/servicios). Tabla propia
 * `tax_withholdings` (migr 0166); el nº de comprobante es CAPTURADO del portal
 * SENIAT (no auto-generado — el ERP no inventa correlativos fiscales).
 *
 * Server-safe (sin "use client", sin Supabase, sin Zod). Validación manual con
 * `validateWithholdingInput()`, patrón del Studio. Espeja los CHECK de 0166.
 */

// ── Enums (espejan los CHECK de la migración 0166) ─────────────

export type WithholdingType = "iva" | "islr";
export type WithholdingStatus = "emitido" | "anulado";

export const WITHHOLDING_TYPES: WithholdingType[] = ["iva", "islr"];

/** Label (es-VE) del tipo de retención. */
export function withholdingTypeLabel(t: WithholdingType): string {
  return t === "iva" ? "Retención de IVA" : "Retención de ISLR";
}

/** Label corto para badges/columnas. */
export function withholdingTypeShort(t: WithholdingType): string {
  return t === "iva" ? "IVA" : "ISLR";
}

export function withholdingStatusLabel(s: WithholdingStatus): string {
  return s === "emitido" ? "Emitido" : "Anulado";
}

// ── Entity type (match schema 0166) ────────────────────────────

export interface TaxWithholding {
  id: string;
  withholdingType: WithholdingType;
  voucherNumber: string;
  period: string;
  opDate: string;
  supplierId: string | null;
  supplierName: string;
  rif: string | null;
  sourceBillId: string | null;
  sourceDoc: string | null;
  base: number;
  pct: number;
  amount: number;
  currency: string;
  status: WithholdingStatus;
  notes: string | null;
  createdAt: string;
}

/** Subset que el form manda y persiste (createWithholdingAction). */
export interface WithholdingInput {
  withholdingType: WithholdingType;
  voucherNumber: string;
  period: string;
  opDate: string;
  supplierId: string | null;
  supplierName: string;
  rif: string | null;
  sourceBillId: string | null;
  sourceDoc: string | null;
  base: number;
  pct: number;
  amount: number;
  currency: string;
  notes: string | null;
}

/** Estado de la server action (consistente con el resto del Studio). */
export type WithholdingActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof WithholdingInput, string>>;
};

// ── Cálculo del monto retenido ─────────────────────────────────

/**
 * Monto retenido = base × pct / 100, redondeado a 2 decimales. La action lo
 * RECALCULA server-side (no confía en el amount del form). Invariante: el
 * resultado nunca supera `base` para pct ∈ [0,100] (lo asegura el CHECK de 0166).
 */
export function computeWithholdingAmount(base: number, pct: number): number {
  const b = Number.isFinite(base) ? base : 0;
  const p = Number.isFinite(pct) ? pct : 0;
  return Math.round(((b * p) / 100) * 100) / 100;
}

// ── Validación (sin Zod, espeja los CHECK de 0166) ─────────────

function isWithholdingType(v: unknown): v is WithholdingType {
  return v === "iva" || v === "islr";
}

/** ¿`YYYY-MM` con mes 01–12? */
function isPeriod(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return false;
  const month = Number(m[2]);
  return month >= 1 && month <= 12;
}

/** ¿`YYYY-MM-DD` válido (parseable y consistente)? */
function isDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Valida el input parcial del form. Retorna `{input}` si pasa o `{fieldErrors}`.
 * Espeja los CHECK de 0166 (voucher requerido, tipo válido, period YYYY-MM,
 * base/amount ≥0, pct 0–100, amount ≤ base, op_date válida) para fallar en la UI
 * con mensaje amable antes de pegarle a la DB.
 */
export function validateWithholdingInput(input: Partial<WithholdingInput>): {
  input?: WithholdingInput;
  fieldErrors?: WithholdingActionState["fieldErrors"];
} {
  const errors: NonNullable<WithholdingActionState["fieldErrors"]> = {};

  if (!isWithholdingType(input.withholdingType)) {
    errors.withholdingType = "Elige el tipo de retención (IVA o ISLR).";
  }

  const voucher = input.voucherNumber?.trim();
  if (!voucher) {
    errors.voucherNumber = "Indica el nº del comprobante emitido.";
  }

  if (!isPeriod(input.period)) {
    errors.period = "Indica el período (YYYY-MM).";
  }

  if (!isDate(input.opDate)) {
    errors.opDate = "Indica una fecha válida.";
  }

  const supplierName = input.supplierName?.trim();
  if (!supplierName) {
    errors.supplierName = "Indica el proveedor retenido.";
  }

  const base = input.base;
  if (base == null || !Number.isFinite(base) || base < 0) {
    errors.base = "La base debe ser un número ≥ 0.";
  }

  const pct = input.pct;
  if (pct == null || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    errors.pct = "El % debe estar entre 0 y 100.";
  }

  const amount = input.amount;
  if (amount == null || !Number.isFinite(amount) || amount < 0) {
    errors.amount = "El monto retenido debe ser ≥ 0.";
  } else if (
    base != null &&
    Number.isFinite(base) &&
    base >= 0 &&
    amount > base
  ) {
    // Invariante del CHECK de 0166: amount <= base.
    errors.amount = "El monto retenido no puede superar la base.";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const currency = input.currency?.trim();
  const rif = input.rif?.trim();
  const sourceDoc = input.sourceDoc?.trim();
  const notes = input.notes?.trim();

  return {
    input: {
      withholdingType: input.withholdingType as WithholdingType,
      voucherNumber: voucher!,
      period: input.period as string,
      opDate: input.opDate as string,
      supplierId: input.supplierId ? input.supplierId : null,
      supplierName: supplierName!,
      rif: rif ? rif : null,
      sourceBillId: input.sourceBillId ? input.sourceBillId : null,
      sourceDoc: sourceDoc ? sourceDoc : null,
      base: base as number,
      pct: pct as number,
      amount: amount as number,
      currency: currency ? currency : "USD",
      notes: notes ? notes : null,
    },
  };
}

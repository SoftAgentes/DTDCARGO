/**
 * Tipos TypeScript de los asientos (SDD-0040 · Contabilidad).
 * Matchea schema de supabase/migrations/0078_contabilidad.sql
 * (journal_entries + journal_lines).
 *
 * Doble partida: cada asiento tiene ≥2 líneas, debe = haber, y solo se asienta
 * (status='asentado') si balancea. Cada línea tiene debe XOR haber.
 */

export type EntryStatus = "borrador" | "asentado" | "anulado";

export type EntrySource =
  | "manual"
  | "invoice"
  | "receipt"
  | "supplier_bill"
  | "supplier_payment"
  | "expense"
  | "depreciacion";

/** Una línea persistida de un asiento (con join opcional a la cuenta). */
export type JournalLine = {
  id: string;
  entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string | null;
  /** Hidratados via join a accounts (opcionales, para mostrar). */
  account_code?: string;
  account_name?: string;
};

export type JournalEntry = {
  id: string;
  tenant_id: string;
  entry_code: string;
  entry_date: string; // YYYY-MM-DD
  memo: string | null;
  status: EntryStatus;
  source: EntrySource;
  invoice_id: string | null;
  receipt_id: string | null;
  bill_id: string | null;
  supplier_payment_id: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Líneas hidratadas (cuando se pide el detalle). */
  lines?: JournalLine[];
};

/** Línea cruda del editor (lo que el operador tipea antes de validar). */
export type JournalLineInput = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string | null;
};

/** Lo que el operador edita en el drawer "Nuevo asiento". */
export type JournalEntryInput = {
  entry_date: string;
  memo: string | null;
  lines: JournalLineInput[];
};

/**
 * Patrón del entry_code: A-YYYY-NNNN (mismo que produce/consume la SQL
 * `next_entry_code` en la migración 0078). El padding mínimo es 4 dígitos;
 * se extiende si pasa de 9999 en un año.
 */
export const ENTRY_CODE_RE = /^A-\d{4}-\d{4,}$/;

/**
 * Formatea un entry_code a partir del año y el número secuencial. Espejo en TS
 * de la lógica de la SQL `next_entry_code` (para test del formato sin DB).
 */
export function formatEntryCode(year: number, seq: number): string {
  const padded = String(seq).padStart(4, "0");
  return `A-${year}-${padded}`;
}

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  borrador: "Borrador",
  asentado: "Asentado",
  anulado: "Anulado",
};

export function entryStatusLabel(status: EntryStatus): string {
  return ENTRY_STATUS_LABEL[status] ?? status;
}

export function entryStatusBadgeTone(
  status: EntryStatus,
): "neutral" | "info" | "success" | "danger" | "warning" {
  switch (status) {
    case "asentado":
      return "success";
    case "borrador":
      return "neutral";
    case "anulado":
      return "danger";
  }
}

export function entrySourceLabel(source: EntrySource): string {
  if (source === "invoice") return "Factura";
  if (source === "receipt") return "Cobro";
  if (source === "supplier_bill") return "Causación CxP";
  if (source === "supplier_payment") return "Pago a proveedor";
  if (source === "expense") return "Gasto";
  if (source === "depreciacion") return "Depreciación";
  return "Manual";
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Totales de un set de líneas. Función PURA — la usa el editor del drawer
 * (total debe/haber en vivo) y el server (validación defensiva).
 *
 * `balanced` = debe == haber y al menos uno > 0 (un asiento de ceros no
 * balancea para fines de asentar).
 */
export function entryTotals(
  lines: { debit?: number; credit?: number }[],
): { debit: number; credit: number; balanced: boolean } {
  let debit = 0;
  let credit = 0;
  for (const l of lines ?? []) {
    debit += Number(l.debit) || 0;
    credit += Number(l.credit) || 0;
  }
  debit = round2(debit);
  credit = round2(credit);
  const balanced = debit > 0 && Math.abs(debit - credit) < 0.005;
  return { debit, credit, balanced };
}

/**
 * Normaliza líneas crudas a JournalLineInput[]. Descarta líneas sin cuenta y
 * sin monto. Si una línea trae debe y haber a la vez, gana el mayor (la UI no
 * debería permitirlo, pero el server es defensivo). Negativos → 0.
 */
export function normalizeEntryLines(raw: unknown): JournalLineInput[] {
  if (!Array.isArray(raw)) return [];
  const out: JournalLineInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const account_id = String(r.account_id ?? "").trim();
    let debit = Math.max(0, round2(Number(r.debit) || 0));
    let credit = Math.max(0, round2(Number(r.credit) || 0));
    if (debit > 0 && credit > 0) {
      // debe XOR haber: conservamos el lado mayor.
      if (debit >= credit) credit = 0;
      else debit = 0;
    }
    if (!account_id) continue;
    if (debit === 0 && credit === 0) continue;
    out.push({
      account_id,
      debit,
      credit,
      line_memo:
        typeof r.line_memo === "string" && r.line_memo.trim()
          ? r.line_memo.trim()
          : null,
    });
  }
  return out;
}

export type JournalActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof JournalEntryInput | "lines", string>>;
  createdCode?: string;
};

/**
 * Validación manual del input del asiento (sin zod, patrón del repo).
 *
 * Reglas (criterios de aceptación §6):
 *  - entry_date con formato YYYY-MM-DD.
 *  - ≥2 líneas con cuenta + monto.
 *  - balanceado: Σ debe == Σ haber, y > 0.
 *  - todas las cuentas deben ser postables (hojas). El set de codes/ids
 *    postables se pasa como `postableAccountIds` (si se omite, no se valida).
 */
export function validateEntryInput(
  input: Partial<JournalEntryInput>,
  postableAccountIds?: Set<string>,
): {
  input?: JournalEntryInput;
  fieldErrors?: JournalActionState["fieldErrors"];
} {
  const errors: JournalActionState["fieldErrors"] = {};

  const entry_date = (input.entry_date ?? "").trim();
  if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
    errors.entry_date = "Indica la fecha del asiento (YYYY-MM-DD).";
  }

  const lines = normalizeEntryLines(input.lines);
  if (lines.length < 2) {
    errors.lines = "Un asiento necesita al menos 2 líneas (debe y haber).";
  } else {
    const totals = entryTotals(lines);
    if (!totals.balanced) {
      errors.lines = `El asiento no balancea: debe ${totals.debit.toFixed(2)} ≠ haber ${totals.credit.toFixed(2)}.`;
    } else if (postableAccountIds && postableAccountIds.size > 0) {
      const nonPostable = lines.find(
        (l) => !postableAccountIds.has(l.account_id),
      );
      if (nonPostable) {
        errors.lines =
          "Solo se puede asentar a cuentas postables (las hojas del plan).";
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      entry_date,
      memo: input.memo?.trim() || null,
      lines,
    },
  };
}

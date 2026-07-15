/**
 * Tipos + validadores del "Proveedor del mes" del Club (SDD-0116, Slice D).
 * DATA PURA (sin React, sin server-only). Enums = uniones de string-literal
 * (espejo de los CHECK de 0235). Sin Zod.
 *
 * D8 (founder 2026-06-29): el proveedor se DERIVA de una inspección verificada
 * (SDD-0066); `inspectionId` es el eje del slice. WHITE-LABEL obligatorio:
 * `supplierName` es el nombre curado por DTD, NUNCA el provider_internal crudo
 * del reporte de inspección (regla SDD-0066). Único por período (YYYY-MM).
 */

// ── Enums (espejo del CHECK de 0235) ─────────────────────────
export type FeaturedSupplierStatus = "borrador" | "publicado";

export const FEATURED_SUPPLIER_STATUSES: readonly FeaturedSupplierStatus[] = [
  "borrador",
  "publicado",
];

// ── Tipos ────────────────────────────────────────────────────
export interface FeaturedSupplier {
  id: string;
  period: string; // YYYY-MM
  supplierName: string;
  inspectionId: string | null;
  category: string | null;
  blurb: string | null;
  coverPath: string | null;
  status: FeaturedSupplierStatus;
  /** Report_no de la inspección ligada (para mostrar en Studio), si existe. */
  inspectionReportNo: string | null;
}

export interface FeaturedSupplierStats {
  /** Proveedores del mes publicados (vivos). */
  publicados: number;
  /** Total vivos (borradores + publicados). */
  total: number;
}

// ── Labels / tonos (UI) ──────────────────────────────────────
export function featuredSupplierStatusLabel(s: FeaturedSupplierStatus): string {
  return { borrador: "Borrador", publicado: "Publicado" }[s];
}

export function featuredSupplierStatusTone(
  s: FeaturedSupplierStatus,
): "neutral" | "success" {
  return { borrador: "neutral", publicado: "success" }[s] as "neutral" | "success";
}

/** Etiqueta legible del período YYYY-MM (ej. "julio 2026"). */
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export function periodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const year = m[1];
  const month = Number(m[2]);
  if (month < 1 || month > 12) return period;
  return `${MESES_LARGOS[month - 1]} ${year}`;
}

/** KPIs derivados de la lista YA traída (función pura, sin DB). */
export function featuredSupplierStatsFrom(rows: FeaturedSupplier[]): FeaturedSupplierStats {
  let publicados = 0;
  for (const r of rows) if (r.status === "publicado") publicados += 1;
  return { publicados, total: rows.length };
}

/** Período por defecto = mes actual en formato YYYY-MM (UTC). */
export function currentPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ── Validación (sin Zod) ─────────────────────────────────────
const PERIOD_RE = /^\d{4}-\d{2}$/;

export interface FeaturedSupplierInput {
  period: string; // YYYY-MM
  supplierName: string;
  inspectionId: string | null;
  category: string | null;
  blurb: string | null;
  coverPath: string | null;
  status: FeaturedSupplierStatus;
}

export interface FeaturedSupplierActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof FeaturedSupplierInput, string>>;
  createdId?: string;
}

export function validateFeaturedSupplierInput(
  partial: Partial<FeaturedSupplierInput>,
): {
  input: FeaturedSupplierInput | null;
  fieldErrors: Partial<Record<keyof FeaturedSupplierInput, string>> | null;
} {
  const fieldErrors: Partial<Record<keyof FeaturedSupplierInput, string>> = {};

  const period = partial.period?.trim() ?? "";
  if (!period) {
    fieldErrors.period = "El período es requerido";
  } else if (!PERIOD_RE.test(period)) {
    fieldErrors.period = "El período debe tener formato AAAA-MM";
  } else {
    const month = Number(period.slice(5, 7));
    if (month < 1 || month > 12) fieldErrors.period = "Mes inválido (01–12)";
  }

  const supplierName = partial.supplierName?.trim() ?? "";
  if (!supplierName) fieldErrors.supplierName = "El nombre del proveedor es requerido";

  const status = partial.status ?? "borrador";
  if (!FEATURED_SUPPLIER_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      period,
      supplierName,
      inspectionId: partial.inspectionId?.trim() || null,
      category: partial.category?.trim() || null,
      blurb: partial.blurb?.trim() || null,
      coverPath: partial.coverPath?.trim() || null,
      status,
    },
    fieldErrors: null,
  };
}

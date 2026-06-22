/**
 * Tipos del activo fijo + cédula de depreciación (SDD-0105 · Activos fijos).
 * Matchea el schema de supabase/migrations/0168_fixed_assets.sql.
 *
 * `computeDepreciation()` es la función PURA central (criterio de aceptación):
 * cuota mensual lineal, meses transcurridos a una fecha, depreciación acumulada
 * con tope (= costo − residual) y valor neto en libros. Sin tocar la DB.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ── Cuentas default del posteo de depreciación (seed 0078) ────
/** Depreciación acumulada (contra) por defecto. */
export const DEFAULT_ACCUM_DEP_CODE = "1.2.9";
/** Gasto de depreciación por defecto. */
export const DEFAULT_DEP_EXPENSE_CODE = "6.17";

export type AssetMethod = "linea_recta";
export type AssetStatus = "activo" | "baja" | "depreciado";

export const ASSET_STATUSES: AssetStatus[] = ["activo", "baja", "depreciado"];

export type FixedAsset = {
  id: string;
  tenant_id: string;
  name: string;
  asset_account_id: string;
  accum_dep_account_id: string | null;
  expense_account_id: string | null;
  cost: number;
  salvage_value: number;
  acquired_on: string;
  useful_life_months: number;
  method: AssetMethod;
  status: AssetStatus;
  disposed_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Hidratados via join (opcionales, para mostrar). */
  asset_account_code?: string;
  asset_account_name?: string;
};

/** Lo que el operador edita en el AssetDrawer (sin id/timestamps). */
export type AssetInput = {
  name: string;
  asset_account_id: string;
  accum_dep_account_id: string | null;
  expense_account_id: string | null;
  cost: number;
  salvage_value: number;
  acquired_on: string;
  useful_life_months: number;
};

/** Una fila de depreciación posteada (fixed_asset_depreciation). */
export type AssetDepreciationRow = {
  id: string;
  asset_id: string;
  tenant_id: string;
  period: string;
  amount: number;
  entry_id: string | null;
  posted_at: string;
  created_at: string;
  /** Hidratado: code del asiento (para mostrar). */
  entry_code?: string | null;
};

// ── Labels + tonos ────────────────────────────────────────────

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  activo: "Activo",
  baja: "Dado de baja",
  depreciado: "Depreciado",
};

export function assetStatusLabel(s: AssetStatus): string {
  return ASSET_STATUS_LABEL[s] ?? s;
}

export function assetStatusBadgeTone(s: AssetStatus): BadgeTone {
  switch (s) {
    case "activo":
      return "success";
    case "depreciado":
      return "info";
    case "baja":
      return "neutral";
  }
}

// ── Cédula de depreciación (PURA) ─────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type DepreciationSchedule = {
  /** Base depreciable = cost − salvage_value (nunca negativa). */
  depreciableBase: number;
  /** Cuota mensual lineal = base / vida útil (meses). */
  monthlyAmount: number;
  /** Meses transcurridos desde la adquisición hasta `asOf` (tope = vida útil). */
  monthsElapsed: number;
  /** Depreciación acumulada a `asOf` (tope = base depreciable). */
  accumulated: number;
  /** Valor neto en libros = cost − accumulated. */
  netBookValue: number;
  /** ¿Totalmente depreciado a `asOf`? (accumulated >= base). */
  fullyDepreciated: boolean;
  /** Cuota a postear este mes (0 si ya está totalmente depreciado). */
  remainingThisMonth: number;
};

/**
 * Cuenta los meses completos transcurridos entre dos fechas ISO (YYYY-MM-DD),
 * por calendario (año*12 + mes), ajustando si el día de `to` aún no alcanzó el
 * día de `from`. Nunca negativo. PURA.
 *
 * Ej.: 2026-01-15 → 2026-04-15 = 3 meses; → 2026-04-14 = 2 meses.
 */
export function monthsBetween(fromISO: string, toISO: string): number {
  const from = fromISO.slice(0, 10);
  const to = toISO.slice(0, 10);
  const [fy, fm, fd] = from.split("-").map((x) => Number(x));
  const [ty, tm, td] = to.split("-").map((x) => Number(x));
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return Math.max(0, months);
}

/**
 * Cédula de depreciación lineal de un activo a una fecha `asOf`. PURA.
 *
 *   depreciableBase = cost − salvage_value           (>= 0)
 *   monthlyAmount   = depreciableBase / useful_life_months
 *   monthsElapsed   = meses(acquired_on → asOf), tope useful_life_months
 *   accumulated     = min(monthlyAmount * monthsElapsed, depreciableBase)
 *   netBookValue    = cost − accumulated
 *
 * El tope de la acumulada (= base depreciable) garantiza que el valor neto
 * nunca cae por debajo del residual, y que el último mes "redondea" la cuota
 * para cerrar exactamente en la base (no deja centavos colgando).
 */
export function computeDepreciation(
  asset: {
    cost: number;
    salvage_value: number;
    useful_life_months: number;
    acquired_on: string;
  },
  asOfISO: string,
): DepreciationSchedule {
  const cost = round2(Math.max(0, Number(asset.cost) || 0));
  const salvage = round2(Math.max(0, Number(asset.salvage_value) || 0));
  const life = Math.max(1, Math.floor(Number(asset.useful_life_months) || 0));
  const depreciableBase = round2(Math.max(0, cost - salvage));
  const monthlyAmount = round2(depreciableBase / life);

  const rawMonths = monthsBetween(asset.acquired_on, asOfISO);
  const monthsElapsed = Math.min(rawMonths, life);

  // Acumulada con tope en la base (el último mes cierra exacto en la base).
  const accumulated =
    monthsElapsed >= life
      ? depreciableBase
      : round2(Math.min(monthlyAmount * monthsElapsed, depreciableBase));

  const netBookValue = round2(cost - accumulated);
  const fullyDepreciated = accumulated >= depreciableBase - 0.005;

  // Cuota a postear este mes: si ya está full → 0; si es el mes que cierra,
  // posteamos el resto exacto (base − acumulada previa) en vez de la cuota fija.
  let remainingThisMonth = 0;
  if (!fullyDepreciated) {
    const remainingBase = round2(depreciableBase - accumulated);
    remainingThisMonth = round2(Math.min(monthlyAmount, remainingBase));
  }

  return {
    depreciableBase,
    monthlyAmount,
    monthsElapsed,
    accumulated,
    netBookValue,
    fullyDepreciated,
    remainingThisMonth,
  };
}

// ── Validador (sin Zod) ───────────────────────────────────────

export type AssetActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof AssetInput, string>>;
  createdId?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validación manual del input del activo (sin Zod, patrón del repo).
 *  - name + asset_account_id requeridos.
 *  - cost > 0, salvage_value >= 0 y <= cost.
 *  - useful_life_months entero > 0.
 *  - acquired_on formato YYYY-MM-DD.
 */
export function validateAssetInput(input: Partial<AssetInput>): {
  input?: AssetInput;
  fieldErrors?: AssetActionState["fieldErrors"];
} {
  const errors: AssetActionState["fieldErrors"] = {};

  const name = (input.name ?? "").trim();
  if (!name) errors.name = "Indica el nombre del activo.";

  const asset_account_id = (input.asset_account_id ?? "").trim();
  if (!asset_account_id) {
    errors.asset_account_id = "Elige la cuenta del activo (1.2.x).";
  }

  const cost = round2(Number(input.cost) || 0);
  if (!(cost > 0)) {
    errors.cost = "El costo debe ser mayor a 0.";
  }

  const salvage = round2(Number(input.salvage_value) || 0);
  if (salvage < 0) {
    errors.salvage_value = "El valor residual no puede ser negativo.";
  } else if (salvage > cost) {
    errors.salvage_value = "El valor residual no puede superar el costo.";
  }

  const life = Math.floor(Number(input.useful_life_months) || 0);
  if (!(life > 0)) {
    errors.useful_life_months = "La vida útil debe ser de al menos 1 mes.";
  }

  const acquired_on = (input.acquired_on ?? "").trim();
  if (!acquired_on || !DATE_RE.test(acquired_on)) {
    errors.acquired_on = "Indica la fecha de adquisición (YYYY-MM-DD).";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      name,
      asset_account_id,
      accum_dep_account_id: input.accum_dep_account_id?.trim() || null,
      expense_account_id: input.expense_account_id?.trim() || null,
      cost,
      salvage_value: salvage,
      acquired_on,
      useful_life_months: life,
    },
  };
}

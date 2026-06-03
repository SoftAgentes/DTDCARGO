/**
 * Tipos + motor del módulo Costing & Margen (SDD-0053 · Slice A).
 *
 * El COSTO de un embarque se modela como tabla editable de 7 categorías
 * (`shipment_costs`, migración 0099). El REVENUE viene de `invoices` reales
 * (Facturación 0021), no del mock. El margen = revenue − costo total.
 *
 * Puro (sin Zod, sin Supabase). Espejo de `D.shipmentEconomics` y
 * `ROUTE_COST_TEMPLATES` del Norte (`erp/modules/costing.jsx` + `erp/data.jsx`),
 * pero con colores en tokens `var(--*)` del sistema (no los hex del mock) y
 * costos en USD canónico (el toggle VES es solo display).
 */

import { SERVICE_LABELS } from "@/lib/shared/shipment-public";
import type { ShipmentService } from "@/lib/studio/shipment-types";
import { invoiceUsdAmount } from "@/lib/studio/fidelizacion/types";
import type { Invoice } from "@/lib/studio/invoice-types";

// ── Las 7 categorías de costo ─────────────────────────────────
export type CostCategoryKey =
  | "freight"
  | "customs"
  | "transport"
  | "handling"
  | "insurance"
  | "commission"
  | "other";

export type CostCategory = {
  key: CostCategoryKey;
  label: string;
  desc: string;
  /**
   * Token CSS del sistema (`var(--*)`) para el swatch/barra de la categoría.
   * NO los hex del mock (`#7F0F1A`…) — se mapean a tokens cercanos para no
   * romper la marca (BRAND.md regla 1).
   */
  colorToken: string;
};

/**
 * Calca labels/desc del Norte (BreakdownSection en costing.jsx). Colores con
 * tokens del sistema: wine para flete (principal), wine-soft/danger para los
 * caros de aduana/transporte, warning para handling, info para seguro, success
 * para comisión, ink-soft para otros.
 */
export const COST_CATEGORIES: CostCategory[] = [
  {
    key: "freight",
    label: "Flete naviera",
    desc: "Pago directo a COSCO/MSC/CMA",
    colorToken: "var(--wine)",
  },
  {
    key: "customs",
    label: "Aduana SENIAT",
    desc: "Aranceles, IVA, IGTF, agente aduanal",
    colorToken: "var(--danger)",
  },
  {
    key: "transport",
    label: "Transporte VE",
    desc: "Última milla desde puerto al cliente",
    colorToken: "var(--wine-soft)",
  },
  {
    key: "handling",
    label: "Handling CN",
    desc: "Recepción, consolidación, almacenaje",
    colorToken: "var(--warning)",
  },
  {
    key: "insurance",
    label: "Seguro de carga",
    desc: "Cobertura por daño/pérdida",
    colorToken: "var(--info)",
  },
  {
    key: "commission",
    label: "Comisión comercial",
    desc: "Variable según agente comercial",
    colorToken: "var(--success)",
  },
  {
    key: "other",
    label: "Otros",
    desc: "Documentación, despacho, varios",
    colorToken: "var(--ink-soft)",
  },
];

/** Solo las keys, en orden, para iterar sin tocar labels. */
export const COST_CATEGORY_KEYS: CostCategoryKey[] = COST_CATEGORIES.map(
  (c) => c.key,
);

// ── Tipos de fila ─────────────────────────────────────────────
/** Fila de `shipment_costs` (migración 0099). Montos en USD canónico. */
export type ShipmentCosts = {
  id: string;
  tenant_id: string;
  shipment_id: string;
  freight: number;
  customs: number;
  transport: number;
  handling: number;
  insurance: number;
  commission: number;
  other: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Fila de `route_cost_templates` (migración 0099). */
export type RouteCostTemplate = {
  id: string;
  tenant_id: string;
  name: string;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService | null;
  freight: number;
  customs: number;
  transport: number;
  handling: number;
  insurance: number;
  commission: number;
  other: number;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Solo los 7 montos (lo que el operador edita / un template define). */
export type CostAmounts = Record<CostCategoryKey, number>;

/**
 * Economía de un embarque: revenue + las 7 categorías de costo + totalCost +
 * margen + marginPct. Espejo de `D.shipmentEconomics` del Norte.
 */
export type ShipmentEconomics = CostAmounts & {
  revenue: number;
  totalCost: number;
  margin: number;
  marginPct: number;
};

// ── Helpers de costo (puros) ──────────────────────────────────
/** Los 7 montos en cero (embarque sin fila de costos → costo 0). */
export function emptyCosts(): CostAmounts {
  return {
    freight: 0,
    customs: 0,
    transport: 0,
    handling: 0,
    insurance: 0,
    commission: 0,
    other: 0,
  };
}

/** Coacciona un valor crudo a número finito ≥ 0 (default 0). */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Extrae los 7 montos de un origen (ShipmentCosts / template / objeto crudo). */
function pickAmounts(src: Partial<CostAmounts> | null | undefined): CostAmounts {
  const out = emptyCosts();
  if (!src) return out;
  for (const k of COST_CATEGORY_KEYS) out[k] = num((src as Record<string, unknown>)[k]);
  return out;
}

/** Suma de las 7 categorías de un objeto de costos. */
export function totalCost(costs: Partial<CostAmounts> | null | undefined): number {
  const a = pickAmounts(costs);
  return (
    a.freight +
    a.customs +
    a.transport +
    a.handling +
    a.insurance +
    a.commission +
    a.other
  );
}

/**
 * Economía de un embarque a partir de su revenue (USD) + costos.
 * Espejo exacto de `D.shipmentEconomics`: marginPct = margin / revenue,
 * 0 si revenue es 0 (sin NaN/Infinity).
 */
export function shipmentEconomics(args: {
  revenueUsd: number;
  costs: Partial<CostAmounts> | null | undefined;
}): ShipmentEconomics {
  const c = pickAmounts(args.costs);
  const total = totalCost(c);
  const revenue = num(args.revenueUsd);
  const margin = revenue - total;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { ...c, revenue, totalCost: total, margin, marginPct };
}

// ── Tono del margen (umbrales del Norte) ──────────────────────
export type MarginTone = "success" | "info" | "warning" | "danger";

/**
 * Tono según el margen %: ≥30 success · ≥15 info · ≥0 warning · <0 danger.
 * Espejo del badge de RoutesMarginSection en costing.jsx.
 */
export function marginTone(marginPct: number): MarginTone {
  const p = Number(marginPct);
  if (!Number.isFinite(p)) return "danger";
  if (p >= 30) return "success";
  if (p >= 15) return "info";
  if (p >= 0) return "warning";
  return "danger";
}

// ── Toggle USD / VES (display-only) ───────────────────────────
export type DisplayCurrency = "USD" | "VES";

/**
 * Convierte un monto USD a la moneda de display.
 * - USD → passthrough.
 * - VES → usd × rate (tasa BCV de config). Display-only; NO se persiste.
 */
export function convertUsd(
  usd: number,
  currency: DisplayCurrency,
  rate: number,
): number {
  const amount = num(usd);
  if (currency === "VES") {
    const r = num(rate);
    return amount * r;
  }
  return amount;
}

/** Formatea un monto USD en la moneda de display (display-only). */
export function fmtMoney(
  usd: number,
  currency: DisplayCurrency,
  rate: number,
): string {
  const value = convertUsd(usd, currency, rate);
  const symbol = currency === "VES" ? "Bs." : "$";
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${symbol}${formatted}`;
}

// ── Match de templates por ruta ───────────────────────────────
/**
 * Clave determinística de una combinación ruta+servicio.
 * `origin|destination|service` (normalizado, partes vacías → "").
 */
export function templateKey(
  origin: string | null | undefined,
  destination: string | null | undefined,
  service: ShipmentService | null | undefined,
): string {
  const o = String(origin ?? "").trim();
  const d = String(destination ?? "").trim();
  const s = String(service ?? "").trim();
  return `${o}|${d}|${s}`;
}

/**
 * Template que matchea la ruta de un embarque (mismo origin+destination+
 * service, activo y no borrado). null si no hay match.
 */
export function matchTemplate(
  templates: RouteCostTemplate[],
  shipment: {
    origin: string | null;
    destination: string | null;
    shipment_service: ShipmentService | null;
  },
): RouteCostTemplate | null {
  const key = templateKey(
    shipment.origin,
    shipment.destination,
    shipment.shipment_service,
  );
  return (
    templates.find(
      (t) =>
        t.active &&
        t.deleted_at == null &&
        templateKey(t.origin, t.destination, t.shipment_service) === key,
    ) ?? null
  );
}

// ── Validación manual (sin Zod, patrón del repo) ──────────────
export type CostInput = CostAmounts & {
  shipment_id: string;
  notes: string | null;
};

export type CostActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<CostCategoryKey | "shipment_id", string>>;
};

/**
 * Valida los 7 montos de costo de un embarque: numéricos ≥ 0
 * (negativos/NaN → error). shipment_id requerido.
 */
export function validateCostInput(raw: Partial<Record<string, unknown>>): {
  input?: CostInput;
  fieldErrors?: CostActionState["fieldErrors"];
} {
  const errors: CostActionState["fieldErrors"] = {};

  const shipmentId = String(raw.shipment_id ?? "").trim();
  if (!shipmentId) {
    errors.shipment_id = "Indicá el embarque al que pertenece el costo.";
  }

  const amounts = emptyCosts();
  for (const k of COST_CATEGORY_KEYS) {
    const v = Number(raw[k]);
    if (!Number.isFinite(v)) {
      errors[k] = "Monto inválido.";
    } else if (v < 0) {
      errors[k] = "El monto no puede ser negativo.";
    } else {
      amounts[k] = v;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      ...amounts,
      shipment_id: shipmentId,
      notes: (raw.notes != null ? String(raw.notes).trim() : "") || null,
    },
  };
}

export type TemplateInput = CostAmounts & {
  name: string;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService | null;
  active: boolean;
  notes: string | null;
};

export type TemplateActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<CostCategoryKey | "name" | "shipment_service", string>
  >;
};

const VALID_SERVICES = Object.keys(SERVICE_LABELS) as ShipmentService[];

/**
 * Valida un template de costo por ruta: nombre requerido, 7 montos numéricos
 * ≥ 0 (negativos/NaN → error), servicio ∈ enum si viene.
 */
export function validateTemplateInput(raw: Partial<Record<string, unknown>>): {
  input?: TemplateInput;
  fieldErrors?: TemplateActionState["fieldErrors"];
} {
  const errors: TemplateActionState["fieldErrors"] = {};

  const name = String(raw.name ?? "").trim();
  if (!name) {
    errors.name = "Indicá un nombre para el template.";
  }

  const service =
    raw.shipment_service && VALID_SERVICES.includes(raw.shipment_service as ShipmentService)
      ? (raw.shipment_service as ShipmentService)
      : null;
  if (raw.shipment_service != null && String(raw.shipment_service).trim() !== "" && service == null) {
    errors.shipment_service = "Servicio de envío inválido.";
  }

  const amounts = emptyCosts();
  for (const k of COST_CATEGORY_KEYS) {
    const v = Number(raw[k]);
    if (!Number.isFinite(v)) {
      errors[k] = "Monto inválido.";
    } else if (v < 0) {
      errors[k] = "El monto no puede ser negativo.";
    } else {
      amounts[k] = v;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      ...amounts,
      name,
      origin: (raw.origin != null ? String(raw.origin).trim() : "") || null,
      destination:
        (raw.destination != null ? String(raw.destination).trim() : "") || null,
      shipment_service: service,
      active: raw.active == null ? true : Boolean(raw.active),
      notes: (raw.notes != null ? String(raw.notes).trim() : "") || null,
    },
  };
}

// Re-export para que la UI (Slice B) y queries reusen el normalizador de USD.
export { invoiceUsdAmount };
export type { Invoice, ShipmentService };

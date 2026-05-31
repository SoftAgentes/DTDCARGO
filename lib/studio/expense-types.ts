/**
 * Tipos del módulo Expenses · gastos del Mobile ERP + módulo web /studio/gastos.
 * Matchea migraciones 0047_expenses + 0073_expense_categories_op +
 * 0074_expenses_scope_fx.
 *
 * SDD-0039 (Gastos CN): scope shipment/external + moneda dual CNY/USD con
 * normalización a USD (amount_usd + fx_rate) + categorías op_* operativas.
 */

import { t, type I18nKey, type Locale } from "@/lib/i18n";

export type ExpenseCurrency = "USD" | "VES" | "CNY";

/** shipment=gasto de un contenedor/embarque · external=overhead oficina/bodega CN. */
export type ExpenseScope = "shipment" | "external";

export type ExpenseCategory =
  // shipment-bound · gastos de viaje del personal
  | "taxi"
  | "comida"
  | "hotel"
  | "vuelo"
  | "peaje"
  | "combustible"
  | "aduana"
  | "cliente"
  | "otro"
  // external · overhead operativo de oficina/bodega CN (0073)
  | "op_rent"
  | "op_utilities"
  | "op_salaries"
  | "op_supplies"
  | "op_equipment"
  | "op_local_transport"
  | "op_customs_local";

export type ExpenseMethod = "cash" | "card" | "transfer" | "usdt";

export type Expense = {
  id: string;
  tenant_id: string;
  user_id: string;
  expense_code: string;
  amount: number;
  currency: ExpenseCurrency;
  /** Monto normalizado a USD (amount / fx_rate). Reportes consolidan por acá. */
  amount_usd: number;
  /** Tipo de cambio moneda_origen/USD usado al cargar. 1.0 para USD. */
  fx_rate: number;
  category: ExpenseCategory;
  scope: ExpenseScope;
  method: ExpenseMethod;
  shipment_id: string | null;
  note: string | null;
  location: string | null;
  billable: boolean;
  /** Path en bucket expense-receipts · NULL si no se cargó. */
  receipt_path: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ─────────────────────────────────────────────────────────────
// Categorías por scope · la UI muestra solo las del scope activo
// ─────────────────────────────────────────────────────────────

export const SHIPMENT_CATEGORIES: ExpenseCategory[] = [
  "taxi",
  "comida",
  "hotel",
  "vuelo",
  "peaje",
  "combustible",
  "aduana",
  "cliente",
  "otro",
];

export const EXTERNAL_CATEGORIES: ExpenseCategory[] = [
  "op_rent",
  "op_utilities",
  "op_salaries",
  "op_supplies",
  "op_equipment",
  "op_local_transport",
  "op_customs_local",
  "otro",
];

export const CATEGORIES_BY_SCOPE: Record<ExpenseScope, ExpenseCategory[]> = {
  shipment: SHIPMENT_CATEGORIES,
  external: EXTERNAL_CATEGORIES,
};

// ─────────────────────────────────────────────────────────────
// Display labels + tonos
// ─────────────────────────────────────────────────────────────

/**
 * @deprecated Usar `categoryLabel(cat, locale)` para texto localizable.
 * Este record es solo es-VE (fallback / mobile m/erp).
 */
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  taxi: "Taxi/Transfer",
  comida: "Comida",
  hotel: "Hotel",
  vuelo: "Vuelo",
  peaje: "Peaje",
  combustible: "Combustible",
  aduana: "Aduana",
  cliente: "Visita cliente",
  otro: "Otro",
  op_rent: "Alquiler bodega",
  op_utilities: "Servicios (luz/agua/internet)",
  op_salaries: "Sueldos locales",
  op_supplies: "Suministros / packing",
  op_equipment: "Equipamiento",
  op_local_transport: "Transporte local",
  op_customs_local: "Aduana local CN",
};

/** Mapping categoría → I18nKey (dict expenses). Fuente única para módulo web. */
export const CATEGORY_LABEL_KEYS: Record<ExpenseCategory, I18nKey> = {
  taxi: "expenses.category.taxi",
  comida: "expenses.category.comida",
  hotel: "expenses.category.hotel",
  vuelo: "expenses.category.vuelo",
  peaje: "expenses.category.peaje",
  combustible: "expenses.category.combustible",
  aduana: "expenses.category.aduana",
  cliente: "expenses.category.cliente",
  otro: "expenses.category.otro",
  op_rent: "expenses.category.op_rent",
  op_utilities: "expenses.category.op_utilities",
  op_salaries: "expenses.category.op_salaries",
  op_supplies: "expenses.category.op_supplies",
  op_equipment: "expenses.category.op_equipment",
  op_local_transport: "expenses.category.op_local_transport",
  op_customs_local: "expenses.category.op_customs_local",
};

export function categoryLabel(cat: ExpenseCategory, locale: Locale): string {
  return t(locale, CATEGORY_LABEL_KEYS[cat]);
}

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  taxi: "🚕",
  comida: "🍽",
  hotel: "🏨",
  vuelo: "✈",
  peaje: "🛣",
  combustible: "⛽",
  aduana: "📋",
  cliente: "🤝",
  otro: "•",
  op_rent: "🏢",
  op_utilities: "💡",
  op_salaries: "👥",
  op_supplies: "📦",
  op_equipment: "🔧",
  op_local_transport: "🚚",
  op_customs_local: "🛃",
};

export const METHOD_LABELS: Record<ExpenseMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  usdt: "USDT",
};

/** Mapping método → I18nKey (dict expenses). Fuente única para el módulo web. */
export const METHOD_LABEL_KEYS: Record<ExpenseMethod, I18nKey> = {
  cash: "expenses.method.cash",
  card: "expenses.method.card",
  transfer: "expenses.method.transfer",
  usdt: "expenses.method.usdt",
};

export const CURRENCY_SYMBOL: Record<ExpenseCurrency, string> = {
  USD: "$",
  VES: "Bs.",
  CNY: "¥",
};

export const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: "taxi", label: "Taxi", icon: "🚕" },
  { value: "comida", label: "Comida", icon: "🍽" },
  { value: "hotel", label: "Hotel", icon: "🏨" },
  { value: "vuelo", label: "Vuelo", icon: "✈" },
  { value: "peaje", label: "Peaje", icon: "🛣" },
  { value: "combustible", label: "Combustible", icon: "⛽" },
  { value: "aduana", label: "Aduana", icon: "📋" },
  { value: "cliente", label: "Visita cliente", icon: "🤝" },
  { value: "otro", label: "Otro", icon: "•" },
];

// ─────────────────────────────────────────────────────────────
// FX · tipos de cambio + sanity ranges
// ─────────────────────────────────────────────────────────────

/**
 * Rango histórico razonable de cada par moneda/USD. Fuera de rango → la UI
 * muestra warning ("¿tipeaste 0.72 en vez de 7.24?") sin bloquear.
 */
export const FX_RATE_SANITY_RANGE: Record<string, [min: number, max: number]> = {
  "CNY/USD": [5.0, 9.0],
  "VES/USD": [30, 80],
};

/** Par de moneda para tenant_fx_history. USD no aplica (siempre fx=1). */
export function currencyPair(currency: ExpenseCurrency): string | null {
  if (currency === "USD") return null;
  return `${currency}/USD`;
}

/** amount → USD con fx. USD: identidad. CNY/VES: amount / fx_rate. */
export function toAmountUsd(
  amount: number,
  currency: ExpenseCurrency,
  fxRate: number,
): number {
  if (currency === "USD") return amount;
  if (!Number.isFinite(fxRate) || fxRate <= 0) return 0;
  return amount / fxRate;
}

// ─────────────────────────────────────────────────────────────
// Action state + validator
// ─────────────────────────────────────────────────────────────

export type ExpenseActionState = {
  ok?: boolean;
  error?: string;
  errorCode?: import("@/lib/i18n").ErrorCode;
  fieldErrors?: Record<string, string>;
  expenseCode?: string;
};

export type CreateExpenseInput = {
  amount: number;
  currency: ExpenseCurrency;
  /** Normalizado a USD · calculado por el server con fx_rate. */
  amount_usd: number;
  fx_rate: number;
  category: ExpenseCategory;
  scope: ExpenseScope;
  method: ExpenseMethod;
  shipment_id: string | null;
  note: string | null;
  location: string | null;
  billable: boolean;
};

const VALID_CURRENCIES: ExpenseCurrency[] = ["USD", "VES", "CNY"];
const VALID_SCOPES: ExpenseScope[] = ["shipment", "external"];
const ALL_CATEGORIES: ExpenseCategory[] = [
  ...SHIPMENT_CATEGORIES,
  "op_rent",
  "op_utilities",
  "op_salaries",
  "op_supplies",
  "op_equipment",
  "op_local_transport",
  "op_customs_local",
];
const VALID_METHODS: ExpenseMethod[] = ["cash", "card", "transfer", "usdt"];

/**
 * Valida el input de un gasto. fieldErrors en es-VE (compat mobile m/erp).
 * El módulo web /studio/gastos valida también client-side con i18n + el
 * action devuelve errorCode para errores de servidor.
 */
export function validateExpenseInput(
  input: Partial<CreateExpenseInput>,
): { input?: CreateExpenseInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Monto debe ser > 0.";
  }

  if (!input.currency || !VALID_CURRENCIES.includes(input.currency)) {
    errors.currency = "Moneda inválida.";
  }

  // scope: si no viene explícito, se infiere del shipment_id. Compat mobile:
  // un gasto sin contenedor es 'external'; el módulo web siempre manda scope.
  const scope: ExpenseScope =
    input.scope ?? (input.shipment_id ? "shipment" : "external");
  if (!VALID_SCOPES.includes(scope)) {
    errors.scope = "Tipo de gasto inválido.";
  }

  // Categoría: solo validamos que sea un valor conocido. El match
  // categoría↔scope es un filtro de UI (el web muestra solo las del scope
  // activo), no una restricción de BD — no lo forzamos acá para no romper
  // el flujo mobile de gastos de viaje sin contenedor.
  if (!input.category || !ALL_CATEGORIES.includes(input.category)) {
    errors.category = "Categoría inválida.";
  }

  // scope=shipment requiere shipment_id (matchea el CHECK de la DB).
  if (scope === "shipment" && !input.shipment_id) {
    errors.shipment_id = "Elegí el contenedor (embarque) del gasto.";
  }

  if (!input.method || !VALID_METHODS.includes(input.method)) {
    errors.method = "Método inválido.";
  }

  // fx_rate: requerido y > 0 si la moneda no es USD.
  const fxRate = Number(input.fx_rate);
  if (input.currency && input.currency !== "USD") {
    if (!Number.isFinite(fxRate) || fxRate <= 0) {
      errors.fx_rate = "Indicá el tipo de cambio.";
    }
  }

  if (input.note && input.note.length > 500) {
    errors.note = "Nota demasiado larga (máx 500).";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const currency = input.currency!;
  const effectiveFx = currency === "USD" ? 1 : fxRate;

  return {
    input: {
      amount,
      currency,
      fx_rate: effectiveFx,
      amount_usd: toAmountUsd(amount, currency, effectiveFx),
      category: input.category!,
      scope,
      method: input.method!,
      shipment_id: scope === "shipment" ? input.shipment_id || null : null,
      note: input.note?.trim() || null,
      location: input.location?.trim() || null,
      billable: !!input.billable,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers de display
// ─────────────────────────────────────────────────────────────

export function formatExpenseAmount(e: Pick<Expense, "amount" | "currency">): string {
  const sym = CURRENCY_SYMBOL[e.currency];
  const n = Math.round(e.amount).toLocaleString("es-VE");
  return `${sym} ${n}`;
}

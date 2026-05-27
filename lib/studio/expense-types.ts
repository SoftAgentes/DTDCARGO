/**
 * Tipos del módulo Expenses · gastos rápidos del Mobile ERP.
 * Matchea migración 0047_expenses.sql.
 */

export type ExpenseCurrency = "USD" | "VES" | "CNY";

export type ExpenseCategory =
  | "taxi"
  | "comida"
  | "hotel"
  | "vuelo"
  | "peaje"
  | "combustible"
  | "aduana"
  | "cliente"
  | "otro";

export type ExpenseMethod = "cash" | "card" | "transfer" | "usdt";

export type Expense = {
  id: string;
  tenant_id: string;
  user_id: string;
  expense_code: string;
  amount: number;
  currency: ExpenseCurrency;
  category: ExpenseCategory;
  method: ExpenseMethod;
  shipment_id: string | null;
  note: string | null;
  location: string | null;
  billable: boolean;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ─────────────────────────────────────────────────────────────
// Display labels + tonos
// ─────────────────────────────────────────────────────────────

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
};

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
};

export const METHOD_LABELS: Record<ExpenseMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  usdt: "USDT",
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
// Action state + validator
// ─────────────────────────────────────────────────────────────

export type ExpenseActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  expenseCode?: string;
};

export type CreateExpenseInput = {
  amount: number;
  currency: ExpenseCurrency;
  category: ExpenseCategory;
  method: ExpenseMethod;
  shipment_id: string | null;
  note: string | null;
  location: string | null;
  billable: boolean;
};

const VALID_CURRENCIES: ExpenseCurrency[] = ["USD", "VES", "CNY"];
const VALID_CATEGORIES: ExpenseCategory[] = [
  "taxi", "comida", "hotel", "vuelo", "peaje",
  "combustible", "aduana", "cliente", "otro",
];
const VALID_METHODS: ExpenseMethod[] = ["cash", "card", "transfer", "usdt"];

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

  if (!input.category || !VALID_CATEGORIES.includes(input.category)) {
    errors.category = "Categoría inválida.";
  }

  if (!input.method || !VALID_METHODS.includes(input.method)) {
    errors.method = "Método inválido.";
  }

  if (input.note && input.note.length > 500) {
    errors.note = "Nota demasiado larga (máx 500).";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      amount,
      currency: input.currency!,
      category: input.category!,
      method: input.method!,
      shipment_id: input.shipment_id || null,
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

/**
 * Tipos del módulo Órdenes de compra (SDD-0071) — la OC de DTD.
 * Matchea el schema de supabase/migrations/0124_purchase_orders.sql
 * (purchase_orders + purchase_order_items).
 *
 * La OC de DTD es el gemelo "compras" de la Orden de venta: DTD compra
 * mercancía POR el cliente (compra asistida) → al recibir genera el Bill
 * (0044 Tesorería). El costo (total_cost_usd) se deriva de la suma de los
 * ítems (qty * unit_cost_usd).
 *
 * Helpers PUROS + validadores manuales (no Zod, patrón del repo).
 */

// ── Tonos de badge (set del sistema) ──────────────────────────
export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado de la OC (enum de display)                         ║
// ╚═══════════════════════════════════════════════════════════╝

export type PurchaseOrderStatus =
  | "borrador"
  | "confirmada"
  | "recibida"
  | "facturada"
  | "cerrada"
  | "cancelada";

export const PURCHASE_ORDER_STATUS: Record<
  PurchaseOrderStatus,
  { label: string; tone: BadgeTone }
> = {
  borrador: { label: "Borrador", tone: "neutral" },
  confirmada: { label: "Confirmada", tone: "info" },
  recibida: { label: "Recibida", tone: "success" },
  facturada: { label: "Facturada (Bill)", tone: "success" },
  cerrada: { label: "Cerrada", tone: "neutral" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

export const PURCHASE_ORDER_STATUSES = Object.keys(
  PURCHASE_ORDER_STATUS,
) as PurchaseOrderStatus[];

export function purchaseOrderStatusLabel(status: string): string {
  return PURCHASE_ORDER_STATUS[status as PurchaseOrderStatus]?.label ?? status;
}
export function purchaseOrderStatusTone(status: string): BadgeTone {
  return PURCHASE_ORDER_STATUS[status as PurchaseOrderStatus]?.tone ?? "neutral";
}

export function isPurchaseOrderStatus(v: unknown): v is PurchaseOrderStatus {
  return typeof v === "string" && v in PURCHASE_ORDER_STATUS;
}

/**
 * Transiciones de status permitidas. PURA — testeable sin DB.
 *
 *   borrador   → confirmada · cancelada
 *   confirmada → recibida · cancelada
 *   recibida   → facturada (genera Bill) · cerrada
 *   facturada  → cerrada
 *   cerrada    → (terminal)
 *   cancelada  → (terminal)
 *
 * 'facturada' NO se setea por transición manual: lo pone receivePurchaseOrder
 * al crear el Bill. La incluimos en el grafo para validar el orden, pero
 * `canTransition` para 'facturada' devuelve false desde la UI (solo el motor).
 */
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  borrador: ["confirmada", "cancelada"],
  confirmada: ["recibida", "cancelada"],
  recibida: ["cerrada"], // 'facturada' la pone el motor (receive → Bill)
  facturada: ["cerrada"],
  cerrada: [],
  cancelada: [],
};

/** ¿Se puede pasar la OC de `from` a `to` por acción manual del operador? PURA. */
export function canTransition(
  from: string,
  to: string,
): boolean {
  if (!isPurchaseOrderStatus(from) || !isPurchaseOrderStatus(to)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Estados terminales (no admiten más cambios). PURA. */
export function isTerminalStatus(status: string): boolean {
  return status === "cerrada" || status === "cancelada";
}

/** ¿La OC está lista para recibir (→ generar Bill)? Solo 'confirmada' o 'recibida' sin Bill. */
export function canReceive(
  po: Pick<PurchaseOrder, "status" | "bill_id">,
): boolean {
  if (po.bill_id) return false; // ya generó su Bill
  return po.status === "confirmada" || po.status === "recibida";
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                         ║
// ╚═══════════════════════════════════════════════════════════╝

export type PurchaseOrder = {
  id: string;
  tenant_id: string;
  purchase_order_code: string;
  client_markbox: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  sales_order_id: string | null;
  status: PurchaseOrderStatus;
  total_cost_usd: number;
  bill_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PurchaseOrderItem = {
  id: string;
  tenant_id: string;
  purchase_order_id: string;
  description: string;
  qty: number;
  unit_cost_usd: number;
  position: number;
  created_at: string;
  updated_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Cálculo de total (helpers PUROS)                          ║
// ╚═══════════════════════════════════════════════════════════╝

/** Costo de una línea: qty * unit_cost_usd (no negativo, redondeado a 2). PURA. */
export function itemLineTotal(
  item: Pick<PurchaseOrderItem, "qty" | "unit_cost_usd">,
): number {
  const total = Number(item.qty) * Number(item.unit_cost_usd);
  return round2(Math.max(0, Number.isFinite(total) ? total : 0));
}

/** Suma de los ítems = total_cost_usd de la OC (redondeado a 2). PURA. */
export function computeTotalCost(
  items: Pick<PurchaseOrderItem, "qty" | "unit_cost_usd">[],
): number {
  return round2(items.reduce((acc, it) => acc + itemLineTotal(it), 0));
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Inputs + validadores manuales (no Zod, patrón del repo)   ║
// ╚═══════════════════════════════════════════════════════════╝

/** Una línea editable de la OC (sin id/timestamps). */
export type PurchaseOrderItemInput = {
  description: string;
  qty: number;
  unitCostUsd: number;
};

/** Lo que el operador edita al crear/editar una OC (sin code/status/timestamps). */
export type PurchaseOrderInput = {
  clientMarkbox: string | null;
  supplierId: string | null;
  supplierName: string | null;
  salesOrderId: string | null;
  notes: string | null;
  items: PurchaseOrderItemInput[];
};

export type PurchaseOrderActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof PurchaseOrderInput, string>>;
  purchaseOrderCode?: string;
};

/**
 * Validación manual del input de la OC (sin zod, patrón del repo).
 *
 * Reglas (criterios de aceptación §6):
 *  - al menos un ítem con descripción.
 *  - cada ítem: descripción requerida, qty > 0, unitCostUsd ≥ 0.
 *  - proveedor: supplierId (ficha suppliers_cn) O supplierName libre — al menos uno.
 *  - clientMarkbox / salesOrderId / notes opcionales.
 *
 * Los ítems sin descripción se descartan (filas vacías del form); si tras
 * filtrar no queda ninguno → error.
 */
export function validatePurchaseOrderInput(
  input: Partial<PurchaseOrderInput>,
): {
  input?: PurchaseOrderInput;
  fieldErrors?: PurchaseOrderActionState["fieldErrors"];
} {
  const errors: PurchaseOrderActionState["fieldErrors"] = {};

  const supplierId = (input.supplierId ?? "").toString().trim() || null;
  const supplierName = (input.supplierName ?? "").toString().trim() || null;
  if (!supplierId && !supplierName) {
    errors.supplierName =
      "Indica el proveedor (elige una ficha o escribe el nombre).";
  }

  // Filtrar ítems vacíos (sin descripción) y validar el resto.
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const cleaned: PurchaseOrderItemInput[] = [];
  let badItem = false;
  for (const it of rawItems) {
    const description = (it?.description ?? "").toString().trim();
    if (!description) continue; // fila vacía → se descarta
    const qty = Number(it?.qty);
    const unitCostUsd = Number(it?.unitCostUsd);
    if (!Number.isFinite(qty) || qty <= 0) {
      badItem = true;
      continue;
    }
    if (!Number.isFinite(unitCostUsd) || unitCostUsd < 0) {
      badItem = true;
      continue;
    }
    cleaned.push({
      description,
      qty: round2(qty),
      unitCostUsd: round2(unitCostUsd),
    });
  }

  if (cleaned.length === 0) {
    errors.items = badItem
      ? "Revisa las líneas: cantidad mayor a cero y costo no negativo."
      : "Agrega al menos un ítem con descripción.";
  } else if (badItem) {
    errors.items =
      "Alguna línea tiene cantidad o costo inválido (qty > 0, costo ≥ 0).";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      clientMarkbox: (input.clientMarkbox ?? "").toString().trim() || null,
      supplierId,
      supplierName,
      salesOrderId: (input.salesOrderId ?? "").toString().trim() || null,
      notes: (input.notes ?? "").toString().trim() || null,
      items: cleaned,
    },
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Mapeo OC → Bill (payload puro, testeable sin DB)          ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Input que `createBillFor` (Tesorería 0044) espera para causar el Bill.
 * Réplica acotada del `BillInput` de treasury/types — la armamos acá para
 * no acoplar este módulo al tipo de Tesorería (lo importa la action al postear).
 */
export type BillPayloadFromPo = {
  supplierId: string;
  concept: string;
  expenseAccountId: string;
  currency: "USD";
  fxRate: null;
  totalAmount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  reference: string; // el código de la OC (trazabilidad)
  shipmentId: null;
  notes: string;
};

/**
 * Arma el payload del Bill a partir de una OC + sus datos de recepción. PURA —
 * testeable sin DB. El costo del Bill es el total de la OC (`total_cost_usd`),
 * en USD. `reference` = código de la OC (deja el rastro Bill ← OC). El
 * vencimiento por default = la fecha de emisión (recibido = exigible) salvo que
 * el caller pase otro.
 *
 *  - `tesorerySupplierId`: id del proveedor de Tesorería (suppliers PRV-, NO
 *    suppliers_cn) que la action resolvió/creó para atar la CxP.
 *  - `expenseAccountId`: cuenta de costo/gasto (decisión §10: se elige al recibir
 *    con default a una cuenta COGS; valida "faltan datos" si no hay).
 */
export function buildBillPayloadFromPo(args: {
  po: Pick<PurchaseOrder, "purchase_order_code" | "total_cost_usd">;
  tesorerySupplierId: string;
  expenseAccountId: string;
  issueDate?: string;
  dueDate?: string | null;
}): BillPayloadFromPo {
  const today = new Date().toISOString().slice(0, 10);
  const issueDate = args.issueDate ?? today;
  return {
    supplierId: args.tesorerySupplierId,
    concept: `Compra asistida · ${args.po.purchase_order_code}`,
    expenseAccountId: args.expenseAccountId,
    currency: "USD",
    fxRate: null,
    totalAmount: round2(Number(args.po.total_cost_usd) || 0),
    issueDate,
    dueDate: args.dueDate ?? issueDate,
    reference: args.po.purchase_order_code,
    shipmentId: null,
    notes: `Bill generado al recibir la OC ${args.po.purchase_order_code} (SDD-0071).`,
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Código correlativo (espejo en TS para test sin DB)        ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Patrón del purchase_order_code: CANNNN (mínimo 4 dígitos, sin año, sin
 * guiones — decisión founder 2026-07-03, migr 0208). La fecha vive en
 * created_at; el contador es global por tenant. Ex OC-YYYY-NNNN (0124).
 */
export const PURCHASE_ORDER_CODE_RE = /^CA\d{4,}$/;

/** Formatea un purchase_order_code. Espejo en TS de la SQL next_purchase_order_code. */
export function formatPurchaseOrderCode(seq: number): string {
  return `CA${String(seq).padStart(4, "0")}`;
}

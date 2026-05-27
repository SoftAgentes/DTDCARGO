/**
 * Tipos TypeScript del módulo Almacén CN (SDD-0016).
 * Matchea enums + tablas de supabase/migrations/0008_warehouses_cn.sql.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─────────────────────────────────────────────────────────────
// Enums (matchean Postgres)
// ─────────────────────────────────────────────────────────────

export type WarehouseReceiptStatus =
  | "pendiente_consolidacion"
  | "consolidado"
  | "incidencia";

export type WarehouseReceiptEventType =
  | "received"
  | "consolidated"
  | "incident"
  | "note"
  | "status_change";

// ─────────────────────────────────────────────────────────────
// Row types
// ─────────────────────────────────────────────────────────────

export type WarehouseCN = {
  id: string;
  code: string; // 'YIW-A1'
  hub_code: string; // 'YIW'
  hub_name_es: string;
  hub_name_cn: string;
  warehouse_name: string | null;
  city: string | null;
  address: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
};

/** Payment status del paquete · alimenta scoring de Despacho (Opción A SDD-0029). */
export type PaymentStatus = "pagado" | "parcial" | "pendiente";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pagado: "Pagado",
  parcial: "Abono parcial",
  pendiente: "Pendiente",
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, "success" | "warning" | "danger"> = {
  pagado: "success",
  parcial: "warning",
  pendiente: "danger",
};

export type WarehouseReceipt = {
  id: string;
  tenant_id: string;
  receipt_code: string;
  warehouse_id: string;
  client_markbox: string | null;
  client_name: string | null;
  is_orphan: boolean;
  orphan_marks: string | null;
  orphan_brought_by: string | null;
  orphan_suspected_client: string | null;
  supplier_name: string | null;
  supplier_name_translated: string | null;
  boxes: number;
  total_cbm: number | null;
  total_weight_kg: number | null;
  status: WarehouseReceiptStatus;
  shipment_id: string | null;
  received_at: string; // ISO date 'YYYY-MM-DD'
  notes: string | null;
  /** Ciudad VE destino · capturada por operario CN al recibir o admin al consolidar (migración 0044). */
  destination_city: string | null;
  /** Estado de pago · default 'pendiente'. Admin updatea desde /studio/cn (migración 0044). */
  payment_status: PaymentStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WarehouseReceiptItem = {
  id: string;
  tenant_id: string;
  receipt_id: string;
  description: string;
  description_translated: string | null;
  hs_code: string | null;
  quantity: number | null;
  unit_value_usd: number | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type WarehouseReceiptEvent = {
  id: string;
  tenant_id: string;
  receipt_id: string;
  event_type: WarehouseReceiptEventType;
  description: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
};

/** Row del listado: receipt + warehouse joinada + items count. */
export type WarehouseReceiptRow = WarehouseReceipt & {
  warehouse: Pick<WarehouseCN, "code" | "hub_code" | "hub_name_es" | "hub_name_cn">;
  items_count: number;
};

// ─────────────────────────────────────────────────────────────
// Display labels + tonos de Badge
// ─────────────────────────────────────────────────────────────

export const RECEIPT_STATUS_LABELS: Record<WarehouseReceiptStatus, string> = {
  pendiente_consolidacion: "Pendiente consolidar",
  consolidado: "Consolidado",
  incidencia: "Incidencia",
};

/**
 * Tonos de Badge según convención post-audit (ver shipment-types.ts):
 * - warning → estado intermedio que requiere atención (FIFO presiona)
 * - success → estado terminal positivo
 * - danger  → alerta / problema
 */
export const RECEIPT_STATUS_TONES: Record<WarehouseReceiptStatus, BadgeTone> = {
  pendiente_consolidacion: "warning",
  consolidado: "success",
  incidencia: "danger",
};

export const RECEIPT_STATUS_OPTIONS: {
  value: WarehouseReceiptStatus;
  label: string;
}[] = [
  { value: "pendiente_consolidacion", label: "Pendiente consolidar" },
  { value: "consolidado", label: "Consolidado" },
  { value: "incidencia", label: "Incidencia" },
];

export const RECEIPT_EVENT_LABELS: Record<WarehouseReceiptEventType, string> = {
  received: "Recibida en almacén",
  consolidated: "Consolidada en embarque",
  incident: "Incidencia reportada",
  note: "Nota",
  status_change: "Cambio de estado",
};

// ─────────────────────────────────────────────────────────────
// Grupos de hubs CN — para filtros y dropdowns
// ─────────────────────────────────────────────────────────────

export type HubGroup = {
  code: string; // 'YIW'
  nameEs: string; // 'Yiwu'
  nameCn: string; // '义乌'
};

export const HUB_GROUPS: HubGroup[] = [
  { code: "YIW", nameEs: "Yiwu", nameCn: "义乌" },
  { code: "CAN", nameEs: "Guangzhou", nameCn: "广州" },
  { code: "SZX", nameEs: "Shenzhen", nameCn: "深圳" },
  { code: "SHA", nameEs: "Shanghai", nameCn: "上海" },
];

// ─────────────────────────────────────────────────────────────
// Lang display toggle (UI-level, no se persiste)
// ─────────────────────────────────────────────────────────────

export type LangDisplay = "original" | "cn" | "es";

export const LANG_OPTIONS: { value: LangDisplay; label: string; short: string }[] = [
  { value: "original", label: "Original", short: "·" },
  { value: "cn", label: "中文", short: "CN" },
  { value: "es", label: "Español", short: "ES" },
];

export function parseLangFromParam(raw: unknown): LangDisplay {
  if (raw === "cn" || raw === "es") return raw;
  return "original";
}

// ─────────────────────────────────────────────────────────────
// Helpers de bilingüismo
// ─────────────────────────────────────────────────────────────

/** Regex de detección de caracteres CJK (chino mandarín). */
const CN_REGEX = /[一-鿿]/;

export function isChinese(text: string | null | undefined): boolean {
  if (!text) return false;
  return CN_REGEX.test(text);
}

/**
 * Decide qué texto mostrar según el lang preferido del usuario.
 * - lang = 'original' → siempre el texto original
 * - lang = 'cn' → si el original es chino, mostralo; si no, mostrá el translated si tiene chino
 * - lang = 'es' → simétrico (preferí latino)
 *
 * Devuelve `{primary, secondary}`:
 *   primary   = lo que mostrar grande
 *   secondary = lo que mostrar chico debajo (si hay alternativa disponible)
 */
export function pickBilingual(
  original: string | null,
  translated: string | null,
  lang: LangDisplay,
): { primary: string | null; secondary: string | null } {
  if (!original && !translated) return { primary: null, secondary: null };
  if (!original) return { primary: translated, secondary: null };
  if (!translated) return { primary: original, secondary: null };

  const originalIsCn = isChinese(original);
  const translatedIsCn = isChinese(translated);

  if (lang === "original") {
    return { primary: original, secondary: translated };
  }

  if (lang === "cn") {
    if (originalIsCn) return { primary: original, secondary: translated };
    if (translatedIsCn) return { primary: translated, secondary: original };
    // ninguno es chino → fallback a original
    return { primary: original, secondary: translated };
  }

  // lang === "es"
  if (!originalIsCn) return { primary: original, secondary: translated };
  if (!translatedIsCn) return { primary: translated, secondary: original };
  // ambos son chinos → fallback a original
  return { primary: original, secondary: translated };
}

// ─────────────────────────────────────────────────────────────
// Form input + validación (patrón validateClientInput sin zod)
// ─────────────────────────────────────────────────────────────

export type WarehouseReceiptItemInput = {
  description: string;
  description_translated: string | null;
  hs_code: string | null;
  quantity: number | null;
  unit_value_usd: number | null;
  notes: string | null;
};

export type WarehouseReceiptInput = {
  warehouse_id: string;
  client_markbox: string | null;
  client_name: string | null;
  is_orphan: boolean;
  orphan_marks: string | null;
  orphan_brought_by: string | null;
  orphan_suspected_client: string | null;
  supplier_name: string | null;
  supplier_name_translated: string | null;
  boxes: number;
  total_cbm: number | null;
  total_weight_kg: number | null;
  received_at: string; // ISO date
  notes: string | null;
  items: WarehouseReceiptItemInput[];
};

export type WarehouseReceiptActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof WarehouseReceiptInput | "items", string>>;
  /** En create, server devuelve el receipt_code autogenerado. */
  createdReceiptCode?: string;
};

const MAX_ITEMS = 10;
const MAX_BOXES = 99999;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateReceiptInput(input: Partial<WarehouseReceiptInput>): {
  input?: WarehouseReceiptInput;
  fieldErrors?: WarehouseReceiptActionState["fieldErrors"];
} {
  const errors: WarehouseReceiptActionState["fieldErrors"] = {};

  // Warehouse
  const warehouse_id = input.warehouse_id?.trim() ?? "";
  if (!warehouse_id) errors.warehouse_id = "Indicá el almacén.";

  // Cliente vs huérfana (XOR-ish)
  const is_orphan = !!input.is_orphan;
  const client_markbox = input.client_markbox?.trim() || null;

  if (!is_orphan && !client_markbox) {
    errors.client_markbox =
      "Indicá el MARKBOX del cliente, o marcala como caja huérfana.";
  }

  // Supplier (obligatorio salvo huérfana sin supplier conocido)
  const supplier_name = input.supplier_name?.trim() || null;
  if (!is_orphan && !supplier_name) {
    errors.supplier_name = "Indicá el supplier del que recibiste la caja.";
  }

  // Boxes
  const boxes = Number(input.boxes ?? 0);
  if (!Number.isFinite(boxes) || boxes < 0 || boxes > MAX_BOXES) {
    errors.boxes = `Cajas inválido (0..${MAX_BOXES}).`;
  }

  // Date
  const received_at = input.received_at?.trim() ?? "";
  if (!received_at || !ISO_DATE_RE.test(received_at)) {
    errors.received_at = "Fecha de recepción inválida (YYYY-MM-DD).";
  }

  // Items: al menos 1, máx 10
  const rawItems = input.items ?? [];
  if (rawItems.length === 0) {
    errors.items = "Agregá al menos 1 item.";
  } else if (rawItems.length > MAX_ITEMS) {
    errors.items = `Máximo ${MAX_ITEMS} items por recepción.`;
  } else {
    const hasEmpty = rawItems.some((i) => !i.description?.trim());
    if (hasEmpty) {
      errors.items = "Todos los items requieren descripción.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      warehouse_id,
      client_markbox: is_orphan ? null : client_markbox,
      client_name: is_orphan ? null : input.client_name?.trim() || null,
      is_orphan,
      orphan_marks: is_orphan ? input.orphan_marks?.trim() || null : null,
      orphan_brought_by: is_orphan ? input.orphan_brought_by?.trim() || null : null,
      orphan_suspected_client: is_orphan
        ? input.orphan_suspected_client?.trim() || null
        : null,
      supplier_name,
      supplier_name_translated: input.supplier_name_translated?.trim() || null,
      boxes,
      total_cbm:
        input.total_cbm != null && Number.isFinite(Number(input.total_cbm))
          ? Number(input.total_cbm)
          : null,
      total_weight_kg:
        input.total_weight_kg != null && Number.isFinite(Number(input.total_weight_kg))
          ? Number(input.total_weight_kg)
          : null,
      received_at,
      notes: input.notes?.trim() || null,
      items: rawItems.map((i) => ({
        description: i.description.trim(),
        description_translated: i.description_translated?.trim() || null,
        hs_code: i.hs_code?.trim() || null,
        quantity:
          i.quantity != null && Number.isFinite(Number(i.quantity))
            ? Number(i.quantity)
            : null,
        unit_value_usd:
          i.unit_value_usd != null && Number.isFinite(Number(i.unit_value_usd))
            ? Number(i.unit_value_usd)
            : null,
        notes: i.notes?.trim() || null,
      })),
    },
  };
}

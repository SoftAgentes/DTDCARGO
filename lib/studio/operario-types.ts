/**
 * Tipos TypeScript del módulo Operario CN/VE (SDD-0027).
 * Matchea supabase/migrations/0020_operario_pins.sql.
 */

// ─────────────────────────────────────────────────────────────
// Row types
// ─────────────────────────────────────────────────────────────

/**
 * Roles del operario.
 * - operario · CN almacén (default Wang Hua YIW-A1)
 * - supervisor · CN almacén con permisos extra
 * - bodeguero · VE despacho (SDD-0030) · arma camiones desde la cola
 * - camionero · VE despacho (SDD-0030) · entrega y confirma POD
 */
export type OperarioRole = "operario" | "supervisor" | "bodeguero" | "camionero";

/**
 * Región operativa del operario (SDD-0023 schema step).
 * cn = almacén China (recibe mercadería en hubs CN, warehouse_id requerido)
 * ve = bodeguero/camionero Venezuela (warehouse_id opcional)
 */
export type OperarioRegion = "cn" | "ve";

export type Operario = {
  id: string;
  tenant_id: string;
  warehouse_id: string | null;     // nullable desde SDD-0023 (chofer VE)
  region: OperarioRegion;
  display_name: string;
  display_name_cn: string | null;
  pin_hash: string;                // bcrypt — NUNCA exponer al cliente
  role: OperarioRole;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Identidad del operario logueado — lo que devuelve el RPC
 * verify_operario_pin y guardamos en sesión derivada de la cookie
 * `dtd_op` (operario_id) + re-fetch en cada request.
 *
 * SDD-0030: warehouse_id ahora es nullable (bodeguero/camionero VE
 * pueden no tener warehouse atado), region distingue cn vs ve.
 *
 * Sprint 0 (0060): tms_driver_id linkea camionero/supervisor con su
 * driver TMS para que listOdsForCamionero filtre por driver_id en vez
 * de matching frágil por display_name (anti-pattern eliminado).
 *
 * Sprint F v3 (0066): roles text[] (multi-rol). Si length > 1, el login
 * muestra selector "Modos". role (singular) se mantiene como primary
 * mode default. `current_mode` lee la cookie `dtd_op_mode` y refleja
 * el rol activo del día (puede ser null si el operario no eligió aún).
 */
export type OperarioSession = {
  operario_id: string;
  tenant_id: string;
  warehouse_id: string | null;
  display_name: string;
  display_name_cn: string | null;
  role: OperarioRole;
  roles: OperarioRole[];
  region: OperarioRegion;
  tms_driver_id: string | null;
  current_mode: OperarioRole | null;
};

// ─────────────────────────────────────────────────────────────
// Input al RPC create_receipt_as_operario
// ─────────────────────────────────────────────────────────────

export type ReceiptItemInput = {
  description: string;
  description_translated?: string | null;
  hs_code?: string | null;
  quantity?: number | null;
  unit_value_usd?: number | null;
  notes?: string | null;
};

export type CreateReceiptInput = {
  warehouse_id: string;
  is_orphan: boolean;
  client_markbox: string | null;
  client_name: string | null;
  orphan_marks: string | null;
  orphan_brought_by: string | null;
  supplier_name: string | null;
  supplier_name_translated: string | null;
  boxes: number;
  total_cbm: number | null;
  total_weight_kg: number | null;
  received_at: string;            // 'YYYY-MM-DD'
  notes: string | null;
  items: ReceiptItemInput[];
  incident: boolean;
  incident_note: string | null;
  /** Ciudad VE destino · capturada por operario CN al recibir (Opción A
   *  SDD-0029 · migración 0044). NULL si todavía no se decidió. */
  destination_city: string | null;
};

// ─────────────────────────────────────────────────────────────
// Server action state
// ─────────────────────────────────────────────────────────────

export type SignInOperarioState = {
  error?: string;
  ok?: boolean;
};

export type CreateReceiptState = {
  ok?: boolean;
  receiptId?: string;
  receiptCode?: string;
  error?: string;
};

// ─────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────

/** PIN = 4 dígitos numéricos exactos */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Valida input del RPC. Lanza error si el shape no cumple. No usa Zod
 * (patrón del proyecto, validate*Input).
 */
export function validateCreateReceiptInput(
  partial: Partial<CreateReceiptInput>,
):
  | { input: CreateReceiptInput; error?: undefined }
  | { input?: undefined; error: string } {
  if (!partial.warehouse_id) return { error: "Falta warehouse_id" };

  if (!partial.is_orphan) {
    if (!partial.client_markbox || partial.client_markbox.trim().length === 0) {
      return { error: "Falta MARKBOX del cliente" };
    }
  }

  const boxes = Number(partial.boxes);
  if (!Number.isFinite(boxes) || boxes <= 0) {
    return { error: "Cajas debe ser un número positivo" };
  }

  const cbm =
    partial.total_cbm === null || partial.total_cbm === undefined
      ? null
      : Number(partial.total_cbm);
  if (cbm !== null && (!Number.isFinite(cbm) || cbm < 0)) {
    return { error: "CBM inválido" };
  }

  const weight =
    partial.total_weight_kg === null || partial.total_weight_kg === undefined
      ? null
      : Number(partial.total_weight_kg);
  if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
    return { error: "Peso inválido" };
  }

  if (!partial.received_at) return { error: "Falta fecha de recepción" };

  const items = Array.isArray(partial.items) ? partial.items : [];

  return {
    input: {
      warehouse_id: partial.warehouse_id,
      is_orphan: !!partial.is_orphan,
      client_markbox: partial.is_orphan
        ? null
        : partial.client_markbox ?? null,
      client_name: partial.is_orphan ? null : partial.client_name ?? null,
      orphan_marks: partial.is_orphan ? partial.orphan_marks ?? null : null,
      orphan_brought_by: partial.is_orphan
        ? partial.orphan_brought_by ?? null
        : null,
      supplier_name: partial.supplier_name ?? null,
      supplier_name_translated: partial.supplier_name_translated ?? null,
      boxes,
      total_cbm: cbm,
      total_weight_kg: weight,
      received_at: partial.received_at,
      notes: partial.notes ?? null,
      items,
      incident: !!partial.incident,
      incident_note: partial.incident_note ?? null,
      destination_city: partial.destination_city?.trim() || null,
    },
  };
}

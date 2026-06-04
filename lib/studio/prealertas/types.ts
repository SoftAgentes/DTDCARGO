/**
 * Tipos TypeScript del módulo Portal · Compras (prealertas) + Proveedores
 * (SDD-0057, Slice A). Matchea el schema de
 * supabase/migrations/0105_portal_compras.sql.
 *
 * Dos entidades:
 *  - `Supplier`  · proveedor chino del cliente (suppliers_cn).
 *  - `Prealerta` · compra = aviso pre-arribo (prealertas), con código DTD-XXXX-N
 *                  por cliente → por caja DTD-XXXX-N-M (shipping mark de SDD-0031).
 *
 * Sin server actions / UI acá (eso es Slice B/C). Helpers PUROS + validadores
 * manuales (no Zod, patrón del repo).
 */

// ── Tonos de badge (set del sistema) ──────────────────────────
export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado de la prealerta (enum de display)                  ║
// ╚═══════════════════════════════════════════════════════════╝

export type PrealertaStatus =
  | "anunciada"
  | "en_camino"
  | "recibida"
  | "consolidada"
  | "cancelada";

export const PREALERTA_STATUS: Record<
  PrealertaStatus,
  { label: string; tone: BadgeTone }
> = {
  anunciada: { label: "Anunciada", tone: "info" },
  en_camino: { label: "En camino", tone: "warning" },
  recibida: { label: "Recibida en CN", tone: "success" },
  consolidada: { label: "Consolidada", tone: "wine" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

export const PREALERTA_STATUSES = Object.keys(
  PREALERTA_STATUS,
) as PrealertaStatus[];

export function prealertaStatusLabel(status: string): string {
  return PREALERTA_STATUS[status as PrealertaStatus]?.label ?? status;
}
export function prealertaStatusTone(status: string): BadgeTone {
  return PREALERTA_STATUS[status as PrealertaStatus]?.tone ?? "neutral";
}

export function isPrealertaStatus(v: unknown): v is PrealertaStatus {
  return typeof v === "string" && v in PREALERTA_STATUS;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Código por caja (shipping mark · SDD-0031)                ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Arma el código por caja a partir del código de la prealerta + el número de
 * caja. `boxCode("DTD-5532-3", 2)` → `"DTD-5532-3-2"`. Es el shipping mark que
 * el cliente le pega a cada bulto y que SDD-0031 imprime en las etiquetas.
 * `boxN` se normaliza a entero ≥ 1 (boxes > 9 se soportan: DTD-5532-3-12).
 */
export function boxCode(prealertaCode: string, boxN: number): string {
  const m = Math.max(1, Math.trunc(Number(boxN) || 1));
  return `${prealertaCode}-${m}`;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                         ║
// ╚═══════════════════════════════════════════════════════════╝

export type Supplier = {
  id: string;
  tenant_id: string;
  client_markbox: string;
  name: string;
  city: string | null;
  wechat: string | null;
  contact: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Prealerta = {
  id: string;
  tenant_id: string;
  client_markbox: string;
  supplier_id: string | null;
  code: string;
  description: string;
  tracking_cn: string | null;
  boxes: number;
  est_value_usd: number | null;
  status: PrealertaStatus;
  received_at: string | null;
  shipment_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Inputs + validadores manuales (no Zod, patrón del repo)   ║
// ╚═══════════════════════════════════════════════════════════╝

// ── Supplier ───────────────────────────────────────────────────

export type SupplierInput = {
  name: string;
  city: string | null;
  wechat: string | null;
  contact: string | null;
  notes: string | null;
};

export type SupplierActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof SupplierInput, string>>;
  supplierId?: string;
};

/**
 * Validación manual del input de proveedor (sin zod).
 *  - name requerido (no vacío).
 *  - el resto opcional (se normaliza a null cuando viene vacío).
 */
export function validateSupplierInput(input: Partial<SupplierInput>): {
  input?: SupplierInput;
  fieldErrors?: SupplierActionState["fieldErrors"];
} {
  const errors: SupplierActionState["fieldErrors"] = {};

  const name = (input.name ?? "").trim();
  if (!name) errors.name = "Indicá el nombre del proveedor.";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      name,
      city: input.city?.trim() || null,
      wechat: input.wechat?.trim() || null,
      contact: input.contact?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Prealerta ──────────────────────────────────────────────────

export type PrealertaInput = {
  supplierId: string | null;
  description: string;
  trackingCn: string | null;
  boxes: number;
  estValueUsd: number | null;
  status: PrealertaStatus;
};

export type PrealertaActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof PrealertaInput, string>>;
  prealertaCode?: string;
};

/**
 * Validación manual del input de prealerta/compra (sin zod).
 *  - description requerida (no vacía).
 *  - boxes entero ≥ 1.
 *  - status normaliza a 'anunciada' si inválido.
 *  - estValueUsd opcional; si viene debe ser ≥ 0.
 *  - supplierId opcional (la cross-tenant la valida el trigger en DB).
 */
export function validatePrealertaInput(input: Partial<PrealertaInput>): {
  input?: PrealertaInput;
  fieldErrors?: PrealertaActionState["fieldErrors"];
} {
  const errors: PrealertaActionState["fieldErrors"] = {};

  const description = (input.description ?? "").trim();
  if (!description) errors.description = "Describí qué viene en la compra.";

  const boxesNum = Number(input.boxes);
  if (!Number.isFinite(boxesNum) || boxesNum < 1) {
    errors.boxes = "Indicá la cantidad de cajas (mínimo 1).";
  } else if (!Number.isInteger(boxesNum)) {
    errors.boxes = "La cantidad de cajas debe ser un número entero.";
  }

  let estValueUsd: number | null = null;
  if (input.estValueUsd != null && `${input.estValueUsd}`.trim() !== "") {
    const n = Number(input.estValueUsd);
    if (!Number.isFinite(n) || n < 0) {
      errors.estValueUsd = "El valor estimado no puede ser negativo.";
    } else {
      estValueUsd = n;
    }
  }

  const status: PrealertaStatus = isPrealertaStatus(input.status)
    ? input.status
    : "anunciada";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      supplierId: (input.supplierId ?? "")?.toString().trim() || null,
      description,
      trackingCn: input.trackingCn?.trim() || null,
      boxes: Math.trunc(boxesNum),
      estValueUsd,
      status,
    },
  };
}

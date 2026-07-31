/**
 * SDD-0096 · Lógica PURA del packing list online del proveedor.
 *
 * Validación + cálculo de totales del form que el proveedor llena en
 * /p/{token}. Cero imports de Supabase/DB → testeable sin red y reutilizable
 * en los DOS lados:
 *   - el form cliente ("use client") → totales en vivo mientras escribe.
 *   - el route POST → re-suma AUTORITATIVA (no se confía en los totales del
 *     cliente; el servidor recomputa desde los números por fila).
 *
 * Las filas llegan como NÚMEROS planos: el form ya evaluó la "calculadora"
 * (32+1 → 33) antes de mandar; acá NO se evalúa expresión (solo se coerciona).
 *
 * Shape de fila portado del prototipo del Norte (_norte/packlist/packlist.js):
 * brand, code, zh (品名 中文), es (nombre ES/EN), hs (材质/HS), carton (nº caja),
 * ctns (cajas), perctn (uds/caja), unit (precio unit), wkg (kg/caja), cbm (cbm/caja).
 * Computados por fila: qty = ctns*perctn, amount = qty*unit, weight = ctns*wkg,
 * vol = ctns*cbm.
 */

export const PACKING_LIST_CURRENCIES = ["USD", "RMB", "EUR"] as const;
export type PackingListCurrency = (typeof PACKING_LIST_CURRENCIES)[number];

export function isPackingListCurrency(v: unknown): v is PackingListCurrency {
  return (
    typeof v === "string" &&
    (PACKING_LIST_CURRENCIES as readonly string[]).includes(v)
  );
}

type RowTextField = "brand" | "code" | "zh" | "es" | "hs" | "carton";
type RowNumberField = "ctns" | "perctn" | "unit" | "wkg" | "cbm";

/** Fila tal cual la manda el cliente (todo opcional / string|number). */
export type PackingListRowInput = Partial<
  Record<RowTextField, string> & Record<RowNumberField, string | number>
> & {
  /** Caja Padre (SDD-0097): la fila comparte caja con la LÍDER anterior. */
  same?: boolean;
  /** Cantidad directa cuando `same` (no se computa de cajas×uds). */
  qtyDirect?: string | number;
};

/** Fila saneada server-side: textos + números + computados por fila. */
export type PackingListRow = {
  brand: string;
  code: string;
  zh: string;
  es: string;
  hs: string;
  carton: string;
  ctns: number;
  perctn: number;
  unit: number;
  wkg: number;
  cbm: number;
  /** Caja Padre (SDD-0097): comparte caja con su líder (cajas/peso/vol van al líder). */
  same: boolean;
  qtyDirect: number;
  qty: number;
  amount: number;
  weight: number;
  vol: number;
};

export type PackingListTotals = {
  ctns: number;
  qty: number;
  amount: number;
  weight: number;
  cbm: number;
};

/**
 * Packing list ENVIADO por el proveedor (fila de `packing_list_submissions`,
 * migr 0147), tal como lo lee el equipo en el Studio (SDD-0096 · PORT-2).
 * Snapshot del contacto del proveedor + cabecera + filas + totales autoritativos.
 */
export type PackingListSubmission = {
  id: string;
  prealerta_id: string;
  client_markbox: string;
  version_no: number;
  is_current: boolean;
  supplier_company: string | null;
  supplier_contact: string | null;
  supplier_email: string | null;
  supplier_wechat: string | null;
  supplier_phone: string | null;
  currency: PackingListCurrency;
  doc_date: string | null;
  folio: string | null;
  supplier_note: string | null;
  rows: PackingListRow[];
  totals: PackingListTotals;
  created_at: string;
};

/** Payload crudo del form (lo que llega al route). */
export type PackingListPayload = {
  supplierCompany?: string;
  supplierContact?: string;
  supplierEmail?: string;
  supplierWechat?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierCity?: string;
  currency?: string;
  docDate?: string;
  supplierNote?: string;
  rows?: PackingListRowInput[];
};

/** Input validado + saneado (lo que el route manda a la RPC). */
export type PackingListInput = {
  supplierCompany: string | null;
  supplierContact: string | null;
  supplierEmail: string | null;
  supplierWechat: string | null;
  supplierPhone: string | null;
  supplierAddress: string | null;
  supplierCity: string | null;
  currency: PackingListCurrency;
  docDate: string | null;
  supplierNote: string | null;
  rows: PackingListRow[];
  totals: PackingListTotals;
};

export type PackingListFieldErrors = Partial<
  Record<"contacto" | "rows" | "tooMany", string>
>;

/** Tope de filas (anti-abuso del JSONB) y largo máximo de cada celda de texto. */
export const PACKING_LIST_MAX_ROWS = 500;
const MAX_TEXT_LEN = 200;
const MAX_NOTE_LEN = 2000;

// ── Coerción numérica (SIN evaluar expresiones; el cliente ya lo hizo) ──
function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0;
    // Tolera coma decimal ("1,5" → 1.5), igual que el num() de estimado-web.
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_TEXT_LEN) : "";
}

/** Calcula los computados de UNA fila desde sus números (no confía en el cliente).
 *  Caja Padre: si `same`, la fila aporta solo qty (qtyDirect) + amount; las cajas,
 *  el peso y el volumen van en la fila LÍDER de la caja → acá quedan en 0 (no se
 *  doble-cuentan). Portado de packlist.js · rowCalc. */
function rowCalc(r: PackingListRowInput): PackingListRow {
  const same = r.same === true;
  const ctns = num(r.ctns);
  const perctn = num(r.perctn);
  const unit = num(r.unit);
  const wkg = num(r.wkg);
  const cbm = num(r.cbm);
  const qtyDirect = num(r.qtyDirect);
  const qty = same ? qtyDirect : ctns * perctn;
  return {
    brand: text(r.brand),
    code: text(r.code),
    zh: text(r.zh),
    es: text(r.es),
    hs: text(r.hs),
    carton: text(r.carton),
    ctns,
    perctn,
    unit,
    wkg,
    cbm,
    same,
    qtyDirect,
    qty: round(qty, 3),
    amount: round(qty * unit, 2),
    weight: same ? 0 : round(ctns * wkg, 3),
    vol: same ? 0 : round(ctns * cbm, 4),
  };
}

/** ¿La fila tiene algún contenido real (nombre o cantidad)? Descarta filas vacías. */
function rowHasContent(r: PackingListRow): boolean {
  return (
    r.brand !== "" ||
    r.code !== "" ||
    r.zh !== "" ||
    r.es !== "" ||
    r.hs !== "" ||
    r.ctns > 0 ||
    r.perctn > 0 ||
    r.unit > 0 ||
    (r.same && r.qtyDirect > 0)
  );
}

/** ¿La fila tiene un nombre (品名 中文 o ES/EN)? Mínimo para que sirva al equipo. */
function rowHasName(r: PackingListRow): boolean {
  return r.zh !== "" || r.es !== "" || r.brand !== "";
}

/**
 * Saneo + re-suma AUTORITATIVA. Descarta filas vacías, recomputa cada fila y
 * suma los totales redondeados a la escala de cada columna de la tabla
 * (numeric 14,3/2/4). Devuelve las filas saneadas (para guardar en JSONB) +
 * los totales (para las columnas total_*). Única fuente de verdad del cálculo.
 */
export function computeTotals(rows: PackingListRowInput[] | undefined): {
  rows: PackingListRow[];
  totals: PackingListTotals;
} {
  const calc = (rows ?? []).map(rowCalc).filter(rowHasContent);
  let ctns = 0,
    qty = 0,
    amount = 0,
    weight = 0,
    vol = 0;
  for (const r of calc) {
    if (!r.same) ctns += r.ctns; // solo la fila LÍDER de la caja aporta cajas
    qty += r.qty;
    amount += r.amount;
    weight += r.weight; // 0 en filas `same` (el peso va en el líder)
    vol += r.vol; // 0 en filas `same`
  }
  return {
    rows: calc,
    totals: {
      ctns: round(ctns, 3),
      qty: round(qty, 3),
      amount: round(amount, 2),
      weight: round(weight, 3),
      cbm: round(vol, 4),
    },
  };
}

/**
 * Validación + saneo del payload del form. Mínimos (poca fricción para el
 * proveedor chino): ≥1 fila con nombre y ≥1 canal de contacto del proveedor
 * (email / WeChat / teléfono — el founder necesita poder contactarlo). currency
 * default USD. Cap de filas + largo de strings (anti-abuso del JSONB).
 */
export function validatePackingListInput(payload: PackingListPayload): {
  input?: PackingListInput;
  fieldErrors?: PackingListFieldErrors;
} {
  const errors: PackingListFieldErrors = {};

  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rawRows.length > PACKING_LIST_MAX_ROWS) {
    errors.tooMany = `Demasiadas filas (máximo ${PACKING_LIST_MAX_ROWS}).`;
    return { fieldErrors: errors };
  }

  const { rows, totals } = computeTotals(rawRows);
  if (rows.length === 0 || !rows.some(rowHasName)) {
    errors.rows =
      "Agrega al menos un producto con su nombre. / 请至少填写一项带名称的货物。";
  }

  const supplierEmail = text(payload.supplierEmail) || null;
  const supplierWechat = text(payload.supplierWechat) || null;
  const supplierPhone = text(payload.supplierPhone) || null;
  const supplierAddress = text(payload.supplierAddress) || null;
  const supplierCity = text(payload.supplierCity) || null;
  if (!supplierEmail && !supplierWechat && !supplierPhone) {
    errors.contacto =
      "Deja un contacto (email, WeChat o teléfono). / 请留下联系方式（邮箱、微信或电话）。";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const currency: PackingListCurrency = isPackingListCurrency(payload.currency)
    ? payload.currency
    : "USD";

  const docDate =
    typeof payload.docDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(payload.docDate.trim())
      ? payload.docDate.trim()
      : null;

  const note =
    typeof payload.supplierNote === "string"
      ? payload.supplierNote.trim().slice(0, MAX_NOTE_LEN) || null
      : null;

  return {
    input: {
      supplierCompany: text(payload.supplierCompany) || null,
      supplierContact: text(payload.supplierContact) || null,
      supplierEmail,
      supplierWechat,
      supplierPhone,
      supplierAddress,
      supplierCity,
      currency,
      docDate,
      supplierNote: note,
      rows,
      totals,
    },
  };
}

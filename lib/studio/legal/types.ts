/**
 * Tipos + validación + payload canónico de la Capa Legal (SDD-0054 · Slice A).
 *
 * Dos entidades:
 *   · LegalDoc        = documento legal versionado (T&C / Condiciones del
 *                       Operador). body = array [heading, párrafo] (mismo shape
 *                       que LEGAL_BODY del Norte).
 *   · LegalAcceptance = registro INMUTABLE de aceptación, server-sellado. El
 *                       cliente envía qué acepta + la medida; el SERVIDOR sella
 *                       accepted_at / ip / hash (ver seal.ts).
 *
 * Puro (sin Zod, sin Supabase, sin node:crypto). El hash en sí lo computa
 * seal.ts; acá vive `acceptanceHashPayload` que produce el string CANÓNICO
 * (orden estable de keys → mismo input ⇒ mismo payload ⇒ mismo hash).
 */

import type { ShipmentService } from "@/lib/studio/shipment-types";

// ── Keys de documento ─────────────────────────────────────────
/** Documentos legales de cara al cliente que entran al gate AUT-04. */
export const LEGAL_DOC_KEYS = ["tyc", "operador"] as const;
export type LegalDocKey = (typeof LEGAL_DOC_KEYS)[number];

export type LegalAudience = "cliente" | "interno";
export type LegalDocStatus = "vigente" | "archivada";

/** Una sección del cuerpo legal: [heading, párrafo]. */
export type LegalSection = [string, string];

/** Fila de `legal_docs` (migración 0102). */
export type LegalDoc = {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  audience: LegalAudience;
  version: string;
  effective_date: string;
  status: LegalDocStatus;
  sections: number;
  body: LegalSection[];
  created_at: string;
};

/** Referencia a una versión de doc aceptada. */
export type DocRef = {
  key: string;
  version: string;
};

/** Fila de `legal_acceptances` (migraciones 0102 + 0121 · evidencia v2). */
export type LegalAcceptance = {
  id: string;
  tenant_id: string;
  acceptance_code: string;
  client_id: string | null;
  client_markbox: string | null;
  quote_code: string | null;
  docs: DocRef[];
  cbm: number | null;
  weight_kg: number | null;
  total_usd: number | null;
  accepted_at: string;
  ip: string | null;
  /** v2 (0121): user agent server-sellado. Entra al hash. */
  user_agent: string | null;
  /** v2 (0121): declaración de comerciante (checkbox 2). Entra al hash. */
  merchant_declaration: boolean;
  /** v2 (0121): atadura forense a la factura. METADATO — NO entra al hash. */
  invoice_id: string | null;
  hash: string | null;
  idempotency_key: string | null;
  created_at: string;
};

/**
 * Lo que se registra al aceptar. NO incluye hash/ip/accepted_at: esos los
 * sella el servidor (seal.ts). La medida (cbm/weight/total) ata la aceptación a
 * lo que se aceptó; el gate AUT-04 la compara con la medida vigente.
 *
 * v2 (SDD-0067):
 *  - `user_agent`: lo pone la ACTION leyéndolo de `headers()` — NUNCA del body
 *    del form (el cliente no escribe su propia evidencia). Entra al hash.
 *  - `merchant_declaration`: checkbox 2 del modal (declaración de comerciante,
 *    cláusula 1.4). Forma parte de lo aceptado → entra al hash. Sin declaración
 *    (`!== true`) la aceptación NO es válida (lo exige validateAcceptanceInput).
 *  - `invoice_id`: atadura forense a la factura borrador. METADATO — NO entra
 *    al hash (la granularidad de re-aceptación sigue siendo la ORDEN/quote_code,
 *    decisión M-1 de 0054 round 2).
 */
export type AcceptanceInput = {
  client_id: string | null;
  client_markbox: string;
  quote_code: string;
  cbm: number;
  weight_kg: number;
  total_usd: number;
  user_agent: string | null;
  merchant_declaration: boolean;
  invoice_id: string | null;
  idempotency_key: string | null;
};

export type AcceptanceFieldErrors = Partial<
  Record<
    | "client_markbox"
    | "quote_code"
    | "docs"
    | "cbm"
    | "weight_kg"
    | "total_usd"
    | "merchant_declaration",
    string
  >
>;

export type AcceptanceActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: AcceptanceFieldErrors;
};

// ── Helpers numéricos ─────────────────────────────────────────
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// ── user_agent saneado (v2 · SDD-0067) ────────────────────────
/** Tope del user_agent que se sella (UAs reales rondan 100–300 chars). */
export const USER_AGENT_MAX_LENGTH = 512;

/**
 * Sanea un user_agent para evidencia: trim, truncado a `USER_AGENT_MAX_LENGTH`,
 * vacío → null. ÚNICA fuente de saneo (la usan `validateAcceptanceInput` y el
 * sello en seal.ts) → lo que se hashea es EXACTAMENTE lo que se persiste; el
 * gate recomputa desde la fila SIN re-sanear (un tamper post-hoc, aunque sea
 * más allá del char 512, cambia el hash y se detecta).
 */
export function sanitizeUserAgent(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > USER_AGENT_MAX_LENGTH ? s.slice(0, USER_AGENT_MAX_LENGTH) : s;
}

// ── Validación manual (sin Zod, patrón del repo) ──────────────
/**
 * Valida lo que se registra al aceptar:
 *  - client_markbox / quote_code no vacíos.
 *  - docs no vacío (tiene que aceptar al menos un documento vigente).
 *  - cbm / weight_kg numéricos ≥ 0 (negativos/NaN → error).
 *  - total_usd numérico > 0 (round-2: una aceptación legal de un envío con total
 *    0 no existe — no hay nada que facturar; el gate AUT-04 respalda una factura).
 *  - merchant_declaration === true (v2 · SDD-0067): sin la declaración de
 *    comerciante NO hay aceptación válida — es parte de lo aceptado.
 *
 * client_id es opcional (nullable en la DB). idempotency_key opcional.
 * user_agent se sanea acá (misma función que usa el sello). invoice_id es
 * metadato opcional (string | null).
 */
export function validateAcceptanceInput(
  raw: Partial<Record<string, unknown>>,
  docs: DocRef[],
): { input?: AcceptanceInput; fieldErrors?: AcceptanceFieldErrors } {
  const errors: AcceptanceFieldErrors = {};

  const markbox = String(raw.client_markbox ?? "").trim();
  if (!markbox) {
    errors.client_markbox = "Indicá el Shipping Mark del cliente.";
  }

  const quoteCode = String(raw.quote_code ?? "").trim();
  if (!quoteCode) {
    errors.quote_code = "Indicá el estimado que se acepta.";
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    errors.docs = "Hay que aceptar al menos un documento vigente.";
  }

  // v2: la declaración de comerciante es obligatoria — estrictamente `true`
  // (un "on"/"si"/1 NO alcanza: el caller la normaliza ANTES; acá fail-closed).
  if (raw.merchant_declaration !== true) {
    errors.merchant_declaration =
      "Hay que confirmar la declaración de comerciante para aceptar.";
  }

  // cbm / weight_kg: ≥ 0. total_usd: > 0 (round-2: no existe aceptación con total 0).
  const parsed: Record<"cbm" | "weight_kg" | "total_usd", number> = {
    cbm: 0,
    weight_kg: 0,
    total_usd: 0,
  };
  for (const k of ["cbm", "weight_kg"] as const) {
    const v = num(raw[k]);
    if (Number.isNaN(v)) {
      errors[k] = "Valor inválido.";
    } else if (v < 0) {
      errors[k] = "No puede ser negativo.";
    } else {
      parsed[k] = v;
    }
  }
  {
    const v = num(raw.total_usd);
    if (Number.isNaN(v)) {
      errors.total_usd = "Valor inválido.";
    } else if (v <= 0) {
      errors.total_usd = "El total a aceptar debe ser mayor a 0.";
    } else {
      parsed.total_usd = v;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  const clientIdRaw = raw.client_id != null ? String(raw.client_id).trim() : "";
  const idemRaw =
    raw.idempotency_key != null ? String(raw.idempotency_key).trim() : "";
  const invoiceIdRaw =
    raw.invoice_id != null ? String(raw.invoice_id).trim() : "";

  return {
    input: {
      client_id: clientIdRaw || null,
      client_markbox: markbox,
      quote_code: quoteCode,
      cbm: parsed.cbm,
      weight_kg: parsed.weight_kg,
      total_usd: parsed.total_usd,
      user_agent: sanitizeUserAgent(raw.user_agent),
      merchant_declaration: true, // validado arriba (=== true o fieldError)
      invoice_id: invoiceIdRaw || null,
      idempotency_key: idemRaw || null,
    },
  };
}

// ── Payload canónico (para hashear) ───────────────────────────
/**
 * Dedup + orden estable de DocRefs por (key, version). No muta el input.
 * Round-2 (inyectividad): el set se deduplica por `key|version` ANTES de
 * ordenar — así `[tyc v2.1, tyc v2.1]` y `[tyc v2.1]` producen el mismo
 * payload (no se puede inflar la evidencia con docs repetidos), y el orden de
 * llegada no afecta el hash.
 */
function canonicalDocs(docs: DocRef[]): DocRef[] {
  const seen = new Map<string, DocRef>();
  for (const d of docs ?? []) {
    const key = String(d.key);
    const version = String(d.version);
    seen.set(JSON.stringify([key, version]), { key, version });
  }
  return [...seen.values()].sort((a, b) =>
    a.key === b.key
      ? a.version < b.version
        ? -1
        : a.version > b.version
          ? 1
          : 0
      : a.key < b.key
        ? -1
        : 1,
  );
}

/**
 * Redondea a `decimals` decimales para que la dimensión sea estable en el
 * payload. Round-3 (m-5): la precisión del hash DEBE casar con la del storage de
 * `legal_acceptances` (0102) — si no, una fila con una cifra de más se hashea
 * distinto a lo que la DB persiste y el gate recomputa otro hash y descarta la
 * fila válida (falso-negativo silencioso). Precisiones reales:
 *   · cbm        → numeric(12,3) → 3 decimales
 *   · weight_kg  → numeric(12,2) → 2 decimales
 *   · total_usd  → numeric(14,2) → 2 decimales
 */
function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((Number(v) + Number.EPSILON) * f) / f;
}

/**
 * Evidencia COMPLETA de una aceptación, en su forma canónica. Es lo que se
 * hashea (SHA-256, en seal.ts) y lo que el gate (queries.ts) recomputa desde la
 * fila de la DB para verificar que el `hash` almacenado no fue forjado/mutado.
 *
 * Round-2: el hash es LOAD-BEARING. El payload incluye TODOS los campos de
 * evidencia — incluidos los SERVER-SELLADOS (`ip`, `accepted_at`) — para que la
 * huella pruebe la evidencia íntegra y el gate pueda recomputarla 1:1 desde la
 * fila. Antes `ip`/`accepted_at` quedaban fuera del payload (no sellados acá).
 *
 * v2 (SDD-0067): suma `user_agent` (server-sellado) y `merchant_declaration`
 * (parte de lo aceptado). `invoice_id` NO está acá a propósito: es metadato
 * forense fuera del hash (la granularidad de re-aceptación es la orden).
 */
export type AcceptanceEvidence = {
  client_markbox: string;
  quote_code: string;
  docs: DocRef[];
  cbm: number;
  weight_kg: number;
  total_usd: number;
  ip: string | null;
  user_agent: string | null;
  merchant_declaration: boolean;
  accepted_at: string;
};

/**
 * Payload CANÓNICO + INYECTIVO de una aceptación, listo para hashear (v2).
 *
 * Determinístico e inyectivo:
 *  - docs deduplicados (por key+version) + orden estable → ni el orden ni los
 *    duplicados afectan el resultado.
 *  - JSON con keys en orden FIJO (no `JSON.stringify` del objeto crudo, que
 *    dependería del orden de inserción).
 *  - incluye TODOS los campos de evidencia, incluidos `ip`, `user_agent` y
 *    `accepted_at` (server-sellados) + `merchant_declaration` → la huella
 *    cubre la evidencia completa.
 *  - `user_agent` se toma AS-IS (`?? null`, sin re-sanear): el sello persiste
 *    exactamente lo que hasheó, así el recompute desde la fila detecta
 *    CUALQUIER tamper (re-sanear acá enmascararía, p.ej., un append > 512).
 *  - `merchant_declaration` se canoniza a boolean estricto (`=== true`):
 *    cualquier otra cosa (corrupción/coerción) recomputa `false` → no matchea.
 *
 * Cualquier cambio en cualquier campo cambia el string → cambia el hash.
 */
export function acceptanceHashPayload(ev: AcceptanceEvidence): string {
  const canonical = {
    client_markbox: String(ev.client_markbox),
    quote_code: String(ev.quote_code),
    // m-5: precisión alineada al storage (0102) — cbm(12,3) / weight(12,2) /
    // total(14,2). Así el hash sellado == el hash recomputado desde la fila.
    cbm: roundTo(ev.cbm, 3),
    weight_kg: roundTo(ev.weight_kg, 2),
    total_usd: roundTo(ev.total_usd, 2),
    docs: canonicalDocs(ev.docs).map((d) => ({
      key: d.key,
      version: d.version,
    })),
    ip: ev.ip ?? null,
    user_agent: ev.user_agent ?? null,
    merchant_declaration: ev.merchant_declaration === true,
    accepted_at: String(ev.accepted_at),
  };
  return JSON.stringify(canonical);
}

// ── Match de medida (el corazón del gate AUT-04) ──────────────
/** Medida atada a una aceptación / al estimado vigente. */
export type Measure = {
  cbm: number;
  weight_kg: number;
  total_usd: number;
};

/**
 * ¿La medida vigente coincide con la aceptada? (gate AUT-04). Si la medida real
 * difiere de la aceptada → re-aceptación obligatoria.
 *
 * Compara las 3 dimensiones con tolerancia RELATIVA configurable. tol = 0
 * (default) ⇒ igualdad exacta; tol = 0.01 ⇒ tolera 1% de diferencia en cada
 * dimensión (útil para redondeos de reliquidación). NaN en cualquier lado →
 * false (fail-closed).
 *
 * Round-2 (cerrar el agujero `0 == 0`):
 *  - `total_usd` DEBE ser > 0 en AMBOS lados — una aceptación legal con total 0
 *    no existe (validateAcceptanceInput lo exige > 0). Un 0 acá = dato corrupto
 *    o coerción fallida → NO es match (fail-closed), nunca un "0 == 0" silencioso.
 *  - `cbm` / `weight_kg` SÍ pueden ser 0 legítimamente (envío sin volumen/peso
 *    declarado todavía): ahí `0 == 0` sigue contando como match.
 */
export function measureMatches(
  accepted: Measure,
  current: Measure,
  tol: number = 0,
): boolean {
  const t = Number.isFinite(tol) && tol >= 0 ? tol : 0;

  // total_usd: ambos > 0, o no hay match (no se admite "0 == 0" como atajo).
  const at = num(accepted.total_usd);
  const ct = num(current.total_usd);
  if (!(at > 0) || !(ct > 0)) return false;

  const dims: Array<keyof Measure> = ["cbm", "weight_kg", "total_usd"];
  for (const dim of dims) {
    const a = num(accepted[dim]);
    const c = num(current[dim]);
    if (Number.isNaN(a) || Number.isNaN(c)) return false;
    const diff = Math.abs(a - c);
    if (diff === 0) continue;
    const base = Math.max(Math.abs(a), Math.abs(c));
    if (base === 0) continue; // cbm/weight ambos 0 → match (total ya filtrado arriba)
    if (diff / base > t) return false;
  }
  return true;
}

export type { ShipmentService };

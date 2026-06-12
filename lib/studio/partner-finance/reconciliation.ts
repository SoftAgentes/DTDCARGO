/**
 * Motor de reconciliación del estado de cuenta del Socio China
 * (SDD-0059 · Slice B1). 100% PURO y DETERMINISTA — sin DB, sin Date.now:
 * la "fecha de hoy" y las ventanas se pasan por parámetro. Cruza las líneas
 * del estado de cuenta importado contra los cargos (supplier_charges) y las
 * entries del libro mayor (partner_ledger_entries) del período.
 *
 * Reglas de match (§4.2 / §6 del spec):
 *  - Monto exacto + fecha dentro de la ventana (±dateWindowDays) → `match_auto`
 *    confianza `alta`.
 *  - Monto exacto sin fecha cercana, O coincidencia fuzzy sobre la descripción
 *    en chino (raw_description_cn vs description_cn) con monto exacto → `media`.
 *  - Solo coincidencia aproximada (monto dentro de tolerancia o solo fuzzy de
 *    texto) → `baja`.
 *  - Sin candidato → `solo_en_estado`.
 *  - Candidato cuyo monto NO coincide con nada del estado pero su texto sí
 *    apunta a la línea → `discrepancia`.
 *  - Cargo/entry del ERP que ningún line consumió → se reporta aparte como
 *    `solo_en_erp`.
 *
 * Cada candidato del ERP se consume UNA sola vez (greedy por confianza
 * descendente) para no atar dos líneas al mismo cargo.
 */

import { num } from "./types";
import type {
  MatchConfidence,
  MatchStatus,
  PartnerCurrency,
} from "./types";

// ── Entradas mínimas (sólo lo que el match necesita) ──────────
/** Una línea del estado de cuenta a reconciliar. */
export type ReconcileLine = {
  id: string;
  raw_description: string;
  raw_description_cn: string | null;
  amount: number;
  currency: PartnerCurrency;
  line_date: string | null;
};

/** Un cargo del ERP candidato a match. */
export type ReconcileCharge = {
  id: string;
  description: string;
  description_cn: string | null;
  amount: number;
  currency: PartnerCurrency;
  charged_on: string | null;
};

/** Una entry del libro mayor candidata a match. */
export type ReconcileLedgerEntry = {
  id: string;
  description: string | null;
  description_cn: string | null;
  amount_usd: number;
  amount_rmb: number;
  currency_paid: PartnerCurrency;
  occurred_on: string | null;
};

/** Resultado de match de una línea. */
export type LineMatchResult = {
  line_id: string;
  match_status: MatchStatus;
  matched_charge_id: string | null;
  matched_ledger_entry_id: string | null;
  match_confidence: MatchConfidence | null;
};

/** Resultado completo del cruce: por línea + lo que quedó solo en el ERP. */
export type ReconcileResult = {
  lines: LineMatchResult[];
  /** charge_ids del ERP que ninguna línea consumió. */
  unmatched_charge_ids: string[];
  /** ledger_entry_ids del ERP que ninguna línea consumió. */
  unmatched_ledger_entry_ids: string[];
};

export type ReconcileOptions = {
  /** Ventana de fecha (días) para confianza alta. Default 7. */
  dateWindowDays?: number;
  /**
   * Tolerancia relativa de monto para considerar "aproximado" (baja). Ej 0.02
   * = ±2%. Default 0.02. Por debajo de esto se trata como monto exacto.
   */
  amountTolerancePct?: number;
};

const DEFAULT_DATE_WINDOW = 7;
const DEFAULT_AMOUNT_TOLERANCE = 0.02;

// ── Helpers puros ─────────────────────────────────────────────
/** Diferencia absoluta en días entre dos ISO dates. null si falta alguna. */
export function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.abs(Math.round((ta - tb) / 86_400_000));
}

/** ¿Dos montos son iguales al centavo? (numeric ya viene redondeado). */
export function amountsEqual(a: number, b: number): boolean {
  return Math.abs(num(a) - num(b)) < 0.005;
}

/** ¿Dos montos están dentro de la tolerancia relativa? */
export function amountsClose(a: number, b: number, tolerancePct: number): boolean {
  const x = num(a);
  const y = num(b);
  if (amountsEqual(x, y)) return true;
  const base = Math.max(Math.abs(x), Math.abs(y));
  if (base === 0) return false;
  return Math.abs(x - y) / base <= tolerancePct;
}

/** Normaliza texto para comparación fuzzy: trim + lower + colapsa espacios. */
export function normalizeText(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Similitud fuzzy simple y determinista entre dos textos (0..1). Comparte
 * tokens (palabras / caracteres CJK). Para CJK, donde no hay espacios, cae a
 * solapamiento de caracteres. PURO.
 */
export function fuzzyScore(a: string | null, b: string | null): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const tokensA = na.includes(" ") ? na.split(" ") : Array.from(na);
  const tokensB = nb.includes(" ") ? nb.split(" ") : Array.from(nb);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const t of setA) {
    if (setB.has(t)) shared += 1;
  }
  // Jaccard sobre el conjunto de tokens.
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : shared / union;
}

const FUZZY_THRESHOLD = 0.5;

/** El monto comparable del ledger según la moneda de la línea del estado. */
function ledgerAmountFor(
  entry: ReconcileLedgerEntry,
  currency: PartnerCurrency,
): number {
  // RMB compara contra amount_rmb; el resto (USD/USDT/VES) contra amount_usd.
  return currency === "RMB" ? num(entry.amount_rmb) : num(entry.amount_usd);
}

// ── Tipo interno de candidato evaluado ────────────────────────
type Candidate = {
  kind: "charge" | "entry";
  id: string;
  /** Confianza propuesta si se elige este candidato. */
  confidence: MatchConfidence;
  /** Score de ordenamiento (mayor = mejor). Determinista. */
  score: number;
  /** true si el monto coincide exacto (distingue match de discrepancia). */
  amountExact: boolean;
  /** true si hubo señal de texto (fuzzy) que apunta a esta línea. */
  textHit: boolean;
};

/** Rango de confianza para desempate determinista. */
const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  alta: 3,
  media: 2,
  baja: 1,
};

/**
 * Evalúa un cargo como candidato de una línea. Devuelve null si ni el monto ni
 * el texto dan señal. PURO.
 */
function evalCharge(
  line: ReconcileLine,
  charge: ReconcileCharge,
  opts: Required<ReconcileOptions>,
): Candidate | null {
  // Sólo se comparan montos de la misma moneda (evita cruzar RMB con USD).
  if (charge.currency !== line.currency) {
    // moneda distinta: sólo el texto puede dar una señal débil de discrepancia.
    const fuzzy = Math.max(
      fuzzyScore(line.raw_description_cn, charge.description_cn),
      fuzzyScore(line.raw_description, charge.description),
    );
    if (fuzzy >= FUZZY_THRESHOLD) {
      return {
        kind: "charge",
        id: charge.id,
        confidence: "baja",
        score: fuzzy,
        amountExact: false,
        textHit: true,
      };
    }
    return null;
  }

  const exact = amountsEqual(line.amount, charge.amount);
  const close = amountsClose(line.amount, charge.amount, opts.amountTolerancePct);
  const fuzzyCn = fuzzyScore(line.raw_description_cn, charge.description_cn);
  const fuzzyEs = fuzzyScore(line.raw_description, charge.description);
  const fuzzy = Math.max(fuzzyCn, fuzzyEs);
  const textHit = fuzzy >= FUZZY_THRESHOLD;

  // Un cargo de monto 0 no es un match real (espejo del guard de evalEntry):
  // dos ceros "coinciden" pero no representan una transacción atable.
  if (exact && num(charge.amount) !== 0) {
    const days = daysBetween(line.line_date, charge.charged_on);
    const inWindow = days != null && days <= opts.dateWindowDays;
    if (inWindow) {
      // monto exacto + fecha en ventana → alta.
      return {
        kind: "charge",
        id: charge.id,
        confidence: "alta",
        score: 100 + (opts.dateWindowDays - days) + (textHit ? 1 : 0),
        amountExact: true,
        textHit,
      };
    }
    // monto exacto sin fecha cercana → media (sube si además el texto pega).
    return {
      kind: "charge",
      id: charge.id,
      confidence: "media",
      score: 50 + (textHit ? 10 : 0) + fuzzy,
      amountExact: true,
      textHit,
    };
  }

  // Monto NO exacto:
  if (textHit && !close) {
    // el texto apunta a esta línea pero el monto difiere → discrepancia.
    return {
      kind: "charge",
      id: charge.id,
      confidence: "baja",
      score: 10 + fuzzy,
      amountExact: false,
      textHit: true,
    };
  }
  if (close && num(charge.amount) !== 0) {
    // monto aproximado (dentro de tolerancia) → baja.
    return {
      kind: "charge",
      id: charge.id,
      confidence: "baja",
      score: 20 + (textHit ? 5 : 0) + fuzzy,
      amountExact: false,
      textHit,
    };
  }
  return null;
}

/** Evalúa una entry del ledger como candidato. PURO. */
function evalEntry(
  line: ReconcileLine,
  entry: ReconcileLedgerEntry,
  opts: Required<ReconcileOptions>,
): Candidate | null {
  const ledgerAmount = ledgerAmountFor(entry, line.currency);
  const exact = amountsEqual(line.amount, ledgerAmount);
  const close = amountsClose(line.amount, ledgerAmount, opts.amountTolerancePct);
  const fuzzyCn = fuzzyScore(line.raw_description_cn, entry.description_cn);
  const fuzzyEs = fuzzyScore(line.raw_description, entry.description);
  const fuzzy = Math.max(fuzzyCn, fuzzyEs);
  const textHit = fuzzy >= FUZZY_THRESHOLD;

  if (exact && ledgerAmount !== 0) {
    const days = daysBetween(line.line_date, entry.occurred_on);
    const inWindow = days != null && days <= opts.dateWindowDays;
    if (inWindow) {
      return {
        kind: "entry",
        id: entry.id,
        confidence: "alta",
        score: 100 + (opts.dateWindowDays - days) + (textHit ? 1 : 0),
        amountExact: true,
        textHit,
      };
    }
    return {
      kind: "entry",
      id: entry.id,
      confidence: "media",
      score: 50 + (textHit ? 10 : 0) + fuzzy,
      amountExact: true,
      textHit,
    };
  }

  if (textHit && !close) {
    return {
      kind: "entry",
      id: entry.id,
      confidence: "baja",
      score: 10 + fuzzy,
      amountExact: false,
      textHit: true,
    };
  }
  if (close && ledgerAmount !== 0) {
    return {
      kind: "entry",
      id: entry.id,
      confidence: "baja",
      score: 20 + (textHit ? 5 : 0) + fuzzy,
      amountExact: false,
      textHit,
    };
  }
  return null;
}

/**
 * Orden determinista de candidatos: por confianza, luego score, luego id (para
 * desempate estable). Mayor primero.
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  const rc = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
  if (rc !== 0) return rc;
  if (b.score !== a.score) return b.score - a.score;
  // id ascendente como último desempate (estable).
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Reconcilia las líneas del estado contra cargos + entries del ERP.
 * 100% PURO y determinista. Cada candidato del ERP se consume una sola vez
 * (greedy: las líneas con mejor candidato se atan primero).
 */
export function reconcileStatement(
  lines: ReconcileLine[],
  charges: ReconcileCharge[],
  ledgerEntries: ReconcileLedgerEntry[],
  options: ReconcileOptions = {},
): ReconcileResult {
  const opts: Required<ReconcileOptions> = {
    dateWindowDays: options.dateWindowDays ?? DEFAULT_DATE_WINDOW,
    amountTolerancePct: options.amountTolerancePct ?? DEFAULT_AMOUNT_TOLERANCE,
  };

  // 1. Para cada línea, computar su mejor candidato (sin consumir todavía).
  type LineEval = {
    line: ReconcileLine;
    best: Candidate | null;
  };
  const evals: LineEval[] = lines.map((line) => {
    const candidates: Candidate[] = [];
    for (const c of charges) {
      const cand = evalCharge(line, c, opts);
      if (cand) candidates.push(cand);
    }
    for (const e of ledgerEntries) {
      const cand = evalEntry(line, e, opts);
      if (cand) candidates.push(cand);
    }
    candidates.sort(compareCandidates);
    return { line, best: candidates[0] ?? null };
  });

  // 2. Resolver conflictos: un candidato del ERP no puede atarse a 2 líneas.
  //    Procesar las líneas por calidad de su mejor candidato (mejor primero);
  //    si el candidato ya fue consumido, esa línea recomputa su mejor libre.
  const consumed = new Set<string>(); // `${kind}:${id}`
  const order = [...evals].sort((a, b) => {
    if (!a.best && !b.best) return 0;
    if (!a.best) return 1;
    if (!b.best) return -1;
    const cmp = compareCandidates(a.best, b.best);
    if (cmp !== 0) return cmp;
    // desempate estable por id de línea
    return a.line.id < b.line.id ? -1 : a.line.id > b.line.id ? 1 : 0;
  });

  const resultByLineId = new Map<string, LineMatchResult>();

  for (const ev of order) {
    const { line } = ev;
    // recomputar candidatos libres para esta línea
    const candidates: Candidate[] = [];
    for (const c of charges) {
      if (consumed.has(`charge:${c.id}`)) continue;
      const cand = evalCharge(line, c, opts);
      if (cand) candidates.push(cand);
    }
    for (const e of ledgerEntries) {
      if (consumed.has(`entry:${e.id}`)) continue;
      const cand = evalEntry(line, e, opts);
      if (cand) candidates.push(cand);
    }
    candidates.sort(compareCandidates);
    const best = candidates[0] ?? null;

    if (!best) {
      resultByLineId.set(line.id, {
        line_id: line.id,
        match_status: "solo_en_estado",
        matched_charge_id: null,
        matched_ledger_entry_id: null,
        match_confidence: null,
      });
      continue;
    }

    consumed.add(`${best.kind}:${best.id}`);

    // Monto exacto → match propuesto (auto). Si no es exacto pero el texto
    // apunta → discrepancia (mismo concepto, monto distinto).
    let status: MatchStatus;
    if (best.amountExact) {
      status = "match_auto";
    } else if (best.textHit) {
      status = "discrepancia";
    } else {
      // aproximado por monto sin señal de texto → match_auto de baja confianza
      // (el operador confirma en Slice B2).
      status = "match_auto";
    }

    resultByLineId.set(line.id, {
      line_id: line.id,
      match_status: status,
      matched_charge_id: best.kind === "charge" ? best.id : null,
      matched_ledger_entry_id: best.kind === "entry" ? best.id : null,
      match_confidence: best.confidence,
    });
  }

  // 3. Resultado por línea en el ORDEN ORIGINAL de las líneas (determinista).
  const lineResults: LineMatchResult[] = lines.map(
    (l) =>
      resultByLineId.get(l.id) ?? {
        line_id: l.id,
        match_status: "solo_en_estado",
        matched_charge_id: null,
        matched_ledger_entry_id: null,
        match_confidence: null,
      },
  );

  // 4. Lo que quedó sin consumir en el ERP → solo_en_erp.
  const unmatchedCharges = charges
    .filter((c) => !consumed.has(`charge:${c.id}`))
    .map((c) => c.id);
  const unmatchedEntries = ledgerEntries
    .filter((e) => !consumed.has(`entry:${e.id}`))
    .map((e) => e.id);

  return {
    lines: lineResults,
    unmatched_charge_ids: unmatchedCharges,
    unmatched_ledger_entry_ids: unmatchedEntries,
  };
}

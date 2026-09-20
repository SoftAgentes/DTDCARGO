// @vitest-environment node
/**
 * Tests del motor de reconciliación PURO (SDD-0059 · Slice B1).
 * Sin DB, sin Date.now — la "fecha de hoy" / ventanas se pasan por parámetro,
 * así que todo es determinista.
 *
 * Cubre: match alta (monto+fecha) / media (monto sin fecha) / baja (aproximado)
 * · solo_en_estado · solo_en_erp · discrepancia · fuzzy CN · ventana de fecha ·
 * consumo único de candidatos · determinismo (mismo input → mismo output).
 */

import { describe, it, expect } from "vitest";
import {
  reconcileStatement,
  daysBetween,
  amountsEqual,
  amountsClose,
  normalizeText,
  fuzzyScore,
  type ReconcileLine,
  type ReconcileCharge,
  type ReconcileLedgerEntry,
} from "../reconciliation";

// ── factories mínimas ─────────────────────────────────────────
function line(over: Partial<ReconcileLine> = {}): ReconcileLine {
  return {
    id: "L1",
    raw_description: "freight",
    raw_description_cn: null,
    amount: 1000,
    currency: "USD",
    line_date: "2026-03-10",
    ...over,
  };
}
function charge(over: Partial<ReconcileCharge> = {}): ReconcileCharge {
  return {
    id: "C1",
    description: "freight",
    description_cn: null,
    amount: 1000,
    currency: "USD",
    charged_on: "2026-03-10",
    ...over,
  };
}
function entry(over: Partial<ReconcileLedgerEntry> = {}): ReconcileLedgerEntry {
  return {
    id: "E1",
    description: "freight",
    description_cn: null,
    amount_usd: 1000,
    amount_rmb: 0,
    currency_paid: "USD",
    occurred_on: "2026-03-10",
    ...over,
  };
}

// ── Helpers puros ─────────────────────────────────────────────
describe("daysBetween", () => {
  it("computa diferencia absoluta en días", () => {
    expect(daysBetween("2026-03-01", "2026-03-08")).toBe(7);
    expect(daysBetween("2026-03-08", "2026-03-01")).toBe(7);
  });
  it("null si falta alguna fecha", () => {
    expect(daysBetween(null, "2026-03-01")).toBeNull();
    expect(daysBetween("2026-03-01", null)).toBeNull();
  });
});

describe("amountsEqual / amountsClose", () => {
  it("igualdad al centavo", () => {
    expect(amountsEqual(100, 100)).toBe(true);
    expect(amountsEqual(100, 100.004)).toBe(true);
    expect(amountsEqual(100, 100.01)).toBe(false);
  });
  it("cercanía relativa con tolerancia", () => {
    expect(amountsClose(100, 101, 0.02)).toBe(true); // 1% < 2%
    expect(amountsClose(100, 105, 0.02)).toBe(false); // 5% > 2%
    expect(amountsClose(0, 0, 0.02)).toBe(true);
    expect(amountsClose(0, 5, 0.02)).toBe(false);
  });
});

describe("normalizeText / fuzzyScore", () => {
  it("normaliza espacios y mayúsculas", () => {
    expect(normalizeText("  Over   Weight ")).toBe("over weight");
    expect(normalizeText(null)).toBe("");
  });
  it("score 1 si idéntico, 0 si uno vacío", () => {
    expect(fuzzyScore("freight cost", "freight cost")).toBe(1);
    expect(fuzzyScore("", "x")).toBe(0);
    expect(fuzzyScore(null, "x")).toBe(0);
  });
  it("comparte tokens (jaccard)", () => {
    const s = fuzzyScore("ocean freight charge", "ocean freight");
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(1);
  });
  it("CJK sin espacios cae a solapamiento de caracteres", () => {
    const s = fuzzyScore("超重费用", "超重");
    expect(s).toBeGreaterThan(0);
  });
});

// ── Match de alta confianza ───────────────────────────────────
describe("reconcileStatement · match alta", () => {
  it("monto exacto + fecha en ventana → match_auto alta (cargo)", () => {
    const r = reconcileStatement([line()], [charge()], []);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].match_status).toBe("match_auto");
    expect(r.lines[0].match_confidence).toBe("alta");
    expect(r.lines[0].matched_charge_id).toBe("C1");
    expect(r.lines[0].matched_ledger_entry_id).toBeNull();
    expect(r.unmatched_charge_ids).toEqual([]);
  });

  it("matchea contra una entry del ledger (sin cargos)", () => {
    const r = reconcileStatement([line()], [], [entry()]);
    expect(r.lines[0].match_status).toBe("match_auto");
    expect(r.lines[0].match_confidence).toBe("alta");
    expect(r.lines[0].matched_ledger_entry_id).toBe("E1");
    expect(r.lines[0].matched_charge_id).toBeNull();
  });

  it("RMB compara contra amount_rmb de la entry", () => {
    const l = line({ amount: 7000, currency: "RMB" });
    const e = entry({ currency_paid: "RMB", amount_usd: 0, amount_rmb: 7000 });
    const r = reconcileStatement([l], [], [e]);
    expect(r.lines[0].match_confidence).toBe("alta");
    expect(r.lines[0].matched_ledger_entry_id).toBe("E1");
  });
});

// ── Match de media confianza ──────────────────────────────────
describe("reconcileStatement · match media", () => {
  it("monto exacto pero fecha fuera de ventana → media", () => {
    const l = line({ line_date: "2026-03-01" });
    const c = charge({ charged_on: "2026-04-30" }); // ~60d
    const r = reconcileStatement([l], [c], [], { dateWindowDays: 7 });
    expect(r.lines[0].match_status).toBe("match_auto");
    expect(r.lines[0].match_confidence).toBe("media");
    expect(r.lines[0].matched_charge_id).toBe("C1");
  });

  it("monto exacto sin fecha en la línea → media (no hay ventana posible)", () => {
    const l = line({ line_date: null });
    const r = reconcileStatement([l], [charge()], []);
    expect(r.lines[0].match_confidence).toBe("media");
    expect(r.lines[0].match_status).toBe("match_auto");
  });
});

// ── Match de baja confianza ───────────────────────────────────
describe("reconcileStatement · match baja", () => {
  it("monto aproximado dentro de tolerancia (sin texto) → baja", () => {
    const l = line({ raw_description: "zzz", line_date: null, amount: 1000 });
    const c = charge({ description: "qqq", amount: 1015 }); // 1.5% < 2%
    const r = reconcileStatement([l], [c], [], { amountTolerancePct: 0.02 });
    expect(r.lines[0].match_confidence).toBe("baja");
    expect(r.lines[0].match_status).toBe("match_auto"); // aprox sin texto = auto baja
    expect(r.lines[0].matched_charge_id).toBe("C1");
  });
});

// ── solo_en_estado ────────────────────────────────────────────
describe("reconcileStatement · solo_en_estado", () => {
  it("sin candidato → solo_en_estado, sin ids", () => {
    const l = line({ amount: 999, raw_description: "mystery", line_date: null });
    const c = charge({ amount: 12, description: "other" });
    const r = reconcileStatement([l], [c], []);
    expect(r.lines[0].match_status).toBe("solo_en_estado");
    expect(r.lines[0].matched_charge_id).toBeNull();
    expect(r.lines[0].match_confidence).toBeNull();
  });

  it("sin cargos ni entries → todas solo_en_estado", () => {
    const r = reconcileStatement([line(), line({ id: "L2" })], [], []);
    expect(r.lines.every((x) => x.match_status === "solo_en_estado")).toBe(true);
  });
});

// ── solo_en_erp ───────────────────────────────────────────────
describe("reconcileStatement · solo_en_erp", () => {
  it("cargo/entry que ninguna línea consume → reportado", () => {
    const used = charge({ id: "C1", amount: 1000 });
    const orphanCharge = charge({ id: "C2", amount: 555, description: "x", charged_on: "2026-01-01" });
    const orphanEntry = entry({ id: "E9", amount_usd: 777, description: "y", occurred_on: "2026-01-01" });
    const r = reconcileStatement([line()], [used, orphanCharge], [orphanEntry]);
    expect(r.lines[0].matched_charge_id).toBe("C1");
    expect(r.unmatched_charge_ids).toContain("C2");
    expect(r.unmatched_charge_ids).not.toContain("C1");
    expect(r.unmatched_ledger_entry_ids).toContain("E9");
  });

  it("todo el ERP sin líneas → ambos arrays llenos", () => {
    const r = reconcileStatement([], [charge()], [entry({ id: "E2" })]);
    expect(r.lines).toEqual([]);
    expect(r.unmatched_charge_ids).toEqual(["C1"]);
    expect(r.unmatched_ledger_entry_ids).toEqual(["E2"]);
  });
});

// ── discrepancia ──────────────────────────────────────────────
describe("reconcileStatement · discrepancia", () => {
  it("texto apunta al cargo pero el monto difiere → discrepancia", () => {
    const l = line({
      raw_description: "overweight surcharge",
      amount: 200,
      line_date: null,
    });
    const c = charge({
      description: "overweight surcharge",
      amount: 100, // mismo concepto, monto distinto y fuera de tolerancia
      charged_on: null,
    });
    const r = reconcileStatement([l], [c], [], { amountTolerancePct: 0.02 });
    expect(r.lines[0].match_status).toBe("discrepancia");
    expect(r.lines[0].matched_charge_id).toBe("C1");
    expect(r.lines[0].match_confidence).toBe("baja");
  });

  it("fuzzy CN apunta al cargo con monto distinto → discrepancia", () => {
    const l = line({
      raw_description: "x",
      raw_description_cn: "超重费",
      amount: 200,
      line_date: null,
    });
    const c = charge({
      description: "y",
      description_cn: "超重费",
      amount: 130,
      charged_on: null,
    });
    const r = reconcileStatement([l], [c], []);
    expect(r.lines[0].match_status).toBe("discrepancia");
  });
});

// ── fuzzy CN sube confianza con monto exacto ──────────────────
describe("reconcileStatement · fuzzy CN", () => {
  it("monto exacto + descripción CN igual + sin fecha → media con cargo", () => {
    const l = line({
      raw_description: "freight",
      raw_description_cn: "海运费",
      amount: 1000,
      line_date: null,
    });
    const c = charge({
      description: "FREIGHT",
      description_cn: "海运费",
      amount: 1000,
      charged_on: null,
    });
    const r = reconcileStatement([l], [c], []);
    expect(r.lines[0].match_status).toBe("match_auto");
    expect(r.lines[0].match_confidence).toBe("media");
    expect(r.lines[0].matched_charge_id).toBe("C1");
  });
});

// ── ventana de fecha configurable ─────────────────────────────
describe("reconcileStatement · ventana de fecha", () => {
  it("la misma diferencia cae alta o media según dateWindowDays", () => {
    const l = line({ line_date: "2026-03-01" });
    const c = charge({ charged_on: "2026-03-20" }); // 19 días

    const wide = reconcileStatement([l], [c], [], { dateWindowDays: 30 });
    expect(wide.lines[0].match_confidence).toBe("alta");

    const narrow = reconcileStatement([l], [c], [], { dateWindowDays: 7 });
    expect(narrow.lines[0].match_confidence).toBe("media");
  });
});

// ── consumo único de candidatos ───────────────────────────────
describe("reconcileStatement · consumo único", () => {
  it("dos líneas iguales no se atan al mismo cargo", () => {
    const l1 = line({ id: "L1" });
    const l2 = line({ id: "L2" });
    const c1 = charge({ id: "C1" });
    const r = reconcileStatement([l1, l2], [c1], []);
    const matched = r.lines.filter((x) => x.matched_charge_id === "C1");
    expect(matched).toHaveLength(1); // sólo una línea consumió C1
    const orphan = r.lines.find((x) => x.matched_charge_id == null);
    expect(orphan?.match_status).toBe("solo_en_estado");
  });

  it("dos líneas iguales con dos cargos iguales → cada una a uno distinto", () => {
    const l1 = line({ id: "L1" });
    const l2 = line({ id: "L2" });
    const c1 = charge({ id: "C1" });
    const c2 = charge({ id: "C2" });
    const r = reconcileStatement([l1, l2], [c1, c2], []);
    const ids = r.lines.map((x) => x.matched_charge_id).sort();
    expect(ids).toEqual(["C1", "C2"]);
    expect(r.unmatched_charge_ids).toEqual([]);
  });
});

// ── determinismo ──────────────────────────────────────────────
describe("reconcileStatement · determinismo", () => {
  it("mismo input → mismo output (orden de líneas estable)", () => {
    const lines = [
      line({ id: "L1", amount: 1000 }),
      line({ id: "L2", amount: 2000 }),
      line({ id: "L3", amount: 3000, raw_description: "zzz", line_date: null }),
    ];
    const charges = [
      charge({ id: "C1", amount: 1000 }),
      charge({ id: "C2", amount: 2000 }),
    ];
    const a = reconcileStatement(lines, charges, []);
    const b = reconcileStatement(lines, charges, []);
    expect(a).toEqual(b);
    // el orden de salida espeja el orden de entrada
    expect(a.lines.map((x) => x.line_id)).toEqual(["L1", "L2", "L3"]);
  });

  it("resultado independiente del orden de los candidatos del ERP", () => {
    const lines = [line({ id: "L1", amount: 1000 })];
    const c1 = charge({ id: "C1", amount: 1000 });
    const c2 = charge({ id: "C2", amount: 1000 });
    const ab = reconcileStatement(lines, [c1, c2], []);
    const ba = reconcileStatement(lines, [c2, c1], []);
    // mismo cargo elegido por desempate estable por id (C1 < C2)
    expect(ab.lines[0].matched_charge_id).toBe("C1");
    expect(ba.lines[0].matched_charge_id).toBe("C1");
  });
});

// ── moneda distinta no cruza por monto ────────────────────────
describe("reconcileStatement · moneda", () => {
  it("no matchea por monto si la moneda difiere", () => {
    const l = line({ amount: 1000, currency: "RMB", raw_description: "zzz", line_date: null });
    const c = charge({ amount: 1000, currency: "USD", description: "qqq" });
    const r = reconcileStatement([l], [c], []);
    expect(r.lines[0].match_status).toBe("solo_en_estado");
  });
});

// ── guard de monto 0 / negativo en evalCharge (hardening B1) ───
describe("reconcileStatement · guard amount !== 0 (cargo)", () => {
  it("un cargo de monto 0 NO matchea una línea de monto 0 (no es transacción real)", () => {
    // sin señal de texto: una línea en 0 contra un cargo en 0 debe quedar solo_en_estado,
    // no atarse al cargo cero (espejo del guard de evalEntry).
    const l = line({
      id: "L0",
      amount: 0,
      raw_description: "qqq",
      raw_description_cn: null,
      line_date: null,
    });
    const c = charge({ id: "C0", amount: 0, description: "zzz", description_cn: null });
    const r = reconcileStatement([l], [c], []);
    expect(r.lines[0].match_status).toBe("solo_en_estado");
    expect(r.lines[0].matched_charge_id).toBeNull();
    // el cargo cero queda libre → reportado como solo_en_erp
    expect(r.unmatched_charge_ids).toContain("C0");
  });

  it("un cargo de monto negativo (nota en línea) no produce match exacto espurio", () => {
    // un cargo negativo no debe atar una línea negativa por 'monto exacto' a menos
    // que NO sea cero; acá el cero es el caso degenerado que cubre el guard.
    const l = line({ id: "L1", amount: 0, raw_description: "freight", line_date: null });
    const c = charge({ id: "C1", amount: 0, description: "freight" });
    // mismo texto (fuzzy hit) pero monto 0 ambos → no es match_auto exacto.
    const r = reconcileStatement([l], [c], []);
    expect(r.lines[0].match_status).not.toBe("match_auto");
  });
});

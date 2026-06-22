/**
 * SDD-0105 · Conciliación — tests de la sugerencia automática PURA
 * (matchConfidenceFor + suggestMatch). Heurística display por monto:
 * exacto → high, ±2% → medium, ±10% → low; un asiento ya ligado nunca sugiere.
 */

import { describe, it, expect } from "vitest";
import {
  matchConfidenceFor,
  suggestMatch,
  type EntryCandidate,
} from "../bank-statement-queries";

describe("SDD-0105 · matchConfidenceFor", () => {
  it("monto exacto → high", () => {
    expect(matchConfidenceFor(500, { amount: 500, alreadyLinked: false })).toBe("high");
  });

  it("dentro de ±2% → medium", () => {
    expect(matchConfidenceFor(500, { amount: 510, alreadyLinked: false })).toBe("medium");
  });

  it("dentro de ±10% → low", () => {
    expect(matchConfidenceFor(500, { amount: 540, alreadyLinked: false })).toBe("low");
  });

  it("fuera de ±10% → null (no se sugiere)", () => {
    expect(matchConfidenceFor(500, { amount: 800, alreadyLinked: false })).toBeNull();
  });

  it("un asiento ya ligado nunca sugiere (1:1)", () => {
    expect(matchConfidenceFor(500, { amount: 500, alreadyLinked: true })).toBeNull();
  });

  it("monto cero o negativo → null", () => {
    expect(matchConfidenceFor(0, { amount: 500, alreadyLinked: false })).toBeNull();
    expect(matchConfidenceFor(500, { amount: 0, alreadyLinked: false })).toBeNull();
  });
});

describe("SDD-0105 · suggestMatch", () => {
  const candidates: EntryCandidate[] = [
    { id: "e1", entry_code: "A-2026-0001", entry_date: "2026-05-01", memo: null, amount: 540, alreadyLinked: false }, // low
    { id: "e2", entry_code: "A-2026-0002", entry_date: "2026-05-02", memo: null, amount: 500, alreadyLinked: false }, // high
    { id: "e3", entry_code: "A-2026-0003", entry_date: "2026-05-03", memo: null, amount: 500, alreadyLinked: true },  // ligado → ignora
  ];

  it("elige el candidato de mayor confianza no-ligado", () => {
    const best = suggestMatch({ amount: 500 }, candidates);
    expect(best?.id).toBe("e2");
    expect(best?.confidence).toBe("high");
  });

  it("devuelve null si ningún candidato matchea por monto", () => {
    const best = suggestMatch({ amount: 9999 }, candidates);
    expect(best).toBeNull();
  });

  it("nunca sugiere un asiento ya ligado aunque el monto sea exacto", () => {
    const onlyLinked: EntryCandidate[] = [
      { id: "x", entry_code: "A-2026-0009", entry_date: "2026-05-09", memo: null, amount: 500, alreadyLinked: true },
    ];
    expect(suggestMatch({ amount: 500 }, onlyLinked)).toBeNull();
  });
});

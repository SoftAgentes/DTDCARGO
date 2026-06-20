/**
 * SDD-0097 · Tests de la lógica PURA del borrador/historial del packing list
 * v4.4 (autosave + historial en localStorage POR TOKEN).
 *  - claves por token (nunca global) → dos órdenes no se pisan.
 *  - pushHistory: inserta al frente, deduplica el último, recorta al cap.
 */
import { describe, it, expect } from "vitest";
import {
  PACKLIST_HISTORY_CAP,
  packlistDraftKey,
  packlistHistoryKey,
  pushHistory,
  type PacklistHistEntry,
} from "../packlist-draft";

describe("claves de localStorage por token", () => {
  it("la clave del borrador incluye el token (no es global)", () => {
    expect(packlistDraftKey("abc123")).toBe("dtd-packlist-abc123");
    expect(packlistDraftKey("xyz")).toBe("dtd-packlist-xyz");
  });

  it("dos órdenes distintas no comparten clave de borrador ni de historial", () => {
    expect(packlistDraftKey("orden-A")).not.toBe(packlistDraftKey("orden-B"));
    expect(packlistHistoryKey("orden-A")).not.toBe(
      packlistHistoryKey("orden-B"),
    );
  });

  it("la clave de historial deriva de la del borrador con sufijo -history", () => {
    expect(packlistHistoryKey("tok")).toBe(`${packlistDraftKey("tok")}-history`);
  });
});

describe("pushHistory", () => {
  const entry = (t: number, data: string): PacklistHistEntry => ({
    t,
    label: "manual",
    data,
  });

  it("inserta el snapshot al frente (más nuevo primero)", () => {
    const a = entry(1, '{"v":1}');
    const b = entry(2, '{"v":2}');
    const out = pushHistory([a], b);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(b);
    expect(out[1]).toBe(a);
  });

  it("deduplica contra el último si el payload no cambió (devuelve el mismo array)", () => {
    const a = entry(1, '{"v":1}');
    const prev = [a];
    const out = pushHistory(prev, entry(2, '{"v":1}'));
    expect(out).toBe(prev); // identidad → el componente no re-persiste
  });

  it("recorta al cap (12) descartando los más viejos", () => {
    let hist: PacklistHistEntry[] = [];
    for (let i = 0; i < PACKLIST_HISTORY_CAP + 5; i++) {
      hist = pushHistory(hist, entry(i, `{"v":${i}}`));
    }
    expect(hist).toHaveLength(PACKLIST_HISTORY_CAP);
    // El último insertado (v16) queda al frente; los 5 más viejos se cayeron.
    expect(hist[0].data).toBe(`{"v":${PACKLIST_HISTORY_CAP + 4}}`);
    expect(hist[hist.length - 1].data).toBe(`{"v":5}`);
  });

  it("no muta el array de entrada", () => {
    const prev = [entry(1, '{"v":1}')];
    const snapshot = [...prev];
    pushHistory(prev, entry(2, '{"v":2}'));
    expect(prev).toEqual(snapshot);
  });
});

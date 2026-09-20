// @vitest-environment node
/**
 * Tests de los helpers de presentación de la cola de reconciliación
 * (SDD-0059 · Slice B2). PUROS — sin DB, sin React. Validan la agrupación por
 * pestaña + contadores + % conciliado + gate de cierre que la UI usa.
 */

import { describe, it, expect } from "vitest";
import {
  tabForMatchStatus,
  countLines,
} from "../reconciliation-view";
import type { MatchStatus } from "../types";

function ln(match_status: MatchStatus, deleted_at: string | null = null) {
  return { match_status, deleted_at };
}

describe("tabForMatchStatus", () => {
  it("match_auto va a 'revisar' (espera confirmación del operador)", () => {
    expect(tabForMatchStatus("match_auto")).toBe("revisar");
  });
  it("match_manual va a 'conciliados'", () => {
    expect(tabForMatchStatus("match_manual")).toBe("conciliados");
  });
  it("discrepancia va a 'discrepancias'", () => {
    expect(tabForMatchStatus("discrepancia")).toBe("discrepancias");
  });
  it("sin_match / solo_en_estado / solo_en_erp van a 'sin_sugerencia'", () => {
    expect(tabForMatchStatus("sin_match")).toBe("sin_sugerencia");
    expect(tabForMatchStatus("solo_en_estado")).toBe("sin_sugerencia");
    expect(tabForMatchStatus("solo_en_erp")).toBe("sin_sugerencia");
  });
});

describe("countLines", () => {
  it("cuenta por pestaña + total", () => {
    const c = countLines([
      ln("match_auto"),
      ln("match_auto"),
      ln("match_manual"),
      ln("discrepancia"),
      ln("solo_en_estado"),
    ]);
    expect(c.revisar).toBe(2);
    expect(c.conciliados).toBe(1);
    expect(c.discrepancias).toBe(1);
    expect(c.sin_sugerencia).toBe(1);
    expect(c.total).toBe(5);
  });

  it("ignora líneas soft-deleted", () => {
    const c = countLines([
      ln("match_manual"),
      ln("match_auto", "2026-03-10T00:00:00Z"),
    ]);
    expect(c.total).toBe(1);
    expect(c.revisar).toBe(0);
    expect(c.conciliados).toBe(1);
  });

  it("% conciliado = conciliados / total redondeado", () => {
    const c = countLines([
      ln("match_manual"),
      ln("match_manual"),
      ln("match_manual"),
      ln("solo_en_estado"),
    ]);
    // 3 de 4 = 75%
    expect(c.pct).toBe(75);
  });

  it("% es 0 cuando no hay líneas (sin división por cero)", () => {
    expect(countLines([]).pct).toBe(0);
    expect(countLines([]).canClose).toBe(true);
  });

  it("canClose=false mientras queden líneas a revisar (match_auto sin confirmar)", () => {
    const c = countLines([ln("match_auto"), ln("match_manual")]);
    expect(c.canClose).toBe(false);
  });

  it("canClose=true cuando no quedan sugerencias auto pendientes", () => {
    const c = countLines([
      ln("match_manual"),
      ln("solo_en_estado"),
      ln("discrepancia"),
    ]);
    // 'revisar' == 0 → se puede cerrar (discrepancias/sin sugerencia no bloquean)
    expect(c.revisar).toBe(0);
    expect(c.canClose).toBe(true);
  });
});

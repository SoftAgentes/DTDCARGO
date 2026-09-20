// @vitest-environment node
/**
 * Tests de la poda del espejo (embudos y etapas que Kommo ya no tiene).
 *
 * El caso real: al 2026-08-11 el espejo cargaba 12 embudos y sólo 1 seguía
 * existiendo en Kommo ("Ventas DTD", 14036567) — los otros 11 se borraron al
 * consolidar la cuenta, pero el sync es upsert-only y nunca los quitó. Igual con
 * 68 etapas huérfanas.
 *
 * Lo que estos tests protegen NO es el caso feliz: es que la poda **no borre de
 * más** cuando la lectura de Kommo falla o viene vacía. Un `delete` de "lo que
 * no vino" con una lista vacía vacía el espejo entero.
 */

import { describe, it, expect } from "vitest";
import { pipelinesToPrune, statusesToPrune } from "../kommo-prune";

describe("pipelinesToPrune", () => {
  it("el caso de prod: 12 espejados, 1 vivo → 11 candidatos", () => {
    const vivo = [{ id: 14036567 }];
    const espejo = [
      { id: 14036567 }, { id: 7225379 }, { id: 8690912 }, { id: 8691440 },
      { id: 8691468 }, { id: 8699388 }, { id: 8699404 }, { id: 10079836 },
      { id: 11074568 }, { id: 11074572 }, { id: 11337468 }, { id: 13967120 },
    ];
    const out = pipelinesToPrune(vivo, espejo);
    expect(out).toHaveLength(11);
    expect(out).not.toContain(14036567); // el vivo jamás es candidato
  });

  it("⛔ GUARDA 1 · lectura vacía NO borra nada", () => {
    // Si el fetch a Kommo falla, devuelve vacío, o el token pierde permisos,
    // "lo que no vino" es TODO. Sin esta guarda, un 500 de Kommo vacía el espejo.
    const espejo = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(pipelinesToPrune([], espejo)).toEqual([]);
  });

  it("espejo vacío → nada que podar (no revienta)", () => {
    expect(pipelinesToPrune([{ id: 1 }], [])).toEqual([]);
  });

  it("todo coincide → cero candidatos", () => {
    const same = [{ id: 1 }, { id: 2 }];
    expect(pipelinesToPrune(same, same)).toEqual([]);
  });

  it("compara por valor numérico, no por tipo (la DB puede devolver string)", () => {
    const espejo = [{ id: "14036567" } as unknown as { id: number }];
    expect(pipelinesToPrune([{ id: 14036567 }], espejo)).toEqual([]);
  });
});

describe("statusesToPrune", () => {
  it("identifica por (pipeline_id, id), no por id solo", () => {
    // 142/143 son estados de SISTEMA: se repiten con el MISMO id en todos los
    // embudos (por eso la PK de la migración 0083 es compuesta). Comparar por
    // `id` suelto haría que el 142 del embudo vivo "salve" al 142 de uno muerto,
    // o peor, que se borre el vivo.
    const vivo = [{ pipeline_id: 100, id: 142 }, { pipeline_id: 100, id: 143 }];
    const espejo = [
      { pipeline_id: 100, id: 142 },
      { pipeline_id: 100, id: 143 },
      { pipeline_id: 999, id: 142 }, // mismo id, embudo muerto
      { pipeline_id: 999, id: 143 },
    ];
    const out = statusesToPrune(vivo, espejo);
    expect(out).toEqual([
      { pipeline_id: 999, id: 142 },
      { pipeline_id: 999, id: 143 },
    ]);
  });

  it("⛔ GUARDA 1 · lectura vacía NO borra nada", () => {
    const espejo = [{ pipeline_id: 1, id: 10 }, { pipeline_id: 1, id: 11 }];
    expect(statusesToPrune([], espejo)).toEqual([]);
  });

  it("una etapa borrada DENTRO de un embudo vivo sí es candidata", () => {
    const vivo = [{ pipeline_id: 100, id: 10 }, { pipeline_id: 100, id: 11 }];
    const espejo = [
      { pipeline_id: 100, id: 10 },
      { pipeline_id: 100, id: 11 },
      { pipeline_id: 100, id: 12 }, // el asesor la borró en Kommo
    ];
    expect(statusesToPrune(vivo, espejo)).toEqual([{ pipeline_id: 100, id: 12 }]);
  });

  it("todo coincide → cero candidatos", () => {
    const same = [{ pipeline_id: 1, id: 10 }];
    expect(statusesToPrune(same, same)).toEqual([]);
  });
});

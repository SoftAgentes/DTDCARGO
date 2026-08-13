/**
 * El verbo "mover de etapa" tiene que estar en LAS DOS vistas.
 *
 * Nació sólo en la fila del worklist (Asesor) y el Tablero quedó de sólo
 * lectura. En la práctica eso es peor que no tenerlo: el kanban es donde uno
 * mueve cosas, así que el founder clickeó una tarjeta, no pasó nada, y la
 * conclusión fue "el ERP no escribe al CRM" — cuando la cola probaba que nunca
 * se había encolado una orden. Este contrato fija que el control viva en las dos
 * superficies y que las dos usen el MISMO predicado de destinos válidos.
 *
 * Es un test de fuente (no de render) por lo mismo que `crm-rename.test.ts`:
 * lo que se quiere afirmar es el CABLEADO, y montar el árbol exigiría el
 * runtime de Server Actions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { stageTargets, type KommoStatusRow } from "@/lib/studio/kommo-types";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const DIR = "app/studio/(app)/crm/_components";
const VISTAS = [`${DIR}/KommoClient.tsx`, `${DIR}/KommoBoardView.tsx`] as const;

describe("el control de etapa está en las dos vistas", () => {
  it.each(VISTAS)("%s monta <StageControl> y deriva destinos con stageTargets", (path) => {
    const code = read(path);
    expect(code).toContain("<StageControl");
    expect(code).toContain("stageTargets(");
  });

  it.each(VISTAS)("%s le pasa el rótulo 'en camino' leyendo patch_stage", (path) => {
    expect(read(path)).toContain('"patch_stage"');
  });

  it("nadie reimplementa el filtro de la bandeja de entrada por su cuenta", () => {
    // Si una vista vuelve a escribir el predicado a mano, puede quedar desfasada
    // de la otra y ofrecer un destino que Kommo rechaza con 400.
    for (const path of VISTAS) {
      expect(read(path)).not.toContain("Number(s.type) !== 1");
    }
  });

  it("el Tablero ya no se anuncia como de solo lectura", () => {
    expect(read(`${DIR}/KommoBoardView.tsx`)).not.toContain("Vista de solo lectura");
  });
});

describe("stageTargets", () => {
  const s = (
    id: number,
    pipeline_id: number,
    type: number | null,
  ): KommoStatusRow => ({ id, pipeline_id, name: `E${id}`, color: null, sort: id, type });

  const STATUSES = [
    s(1, 10, 1), // bandeja de entrada del embudo 10
    s(2, 10, 0),
    s(3, 10, 142), // ganado
    s(9, 20, 0), // otro embudo
  ];

  it("deja fuera la bandeja de entrada (Kommo devuelve 400 si se mueve hacia ahí)", () => {
    expect(stageTargets(STATUSES, 10).map((x) => x.id)).toEqual([2, 3]);
  });

  it("sólo devuelve etapas del embudo pedido", () => {
    expect(stageTargets(STATUSES, 20).map((x) => x.id)).toEqual([9]);
  });

  it("sin embudo no hay destinos (un lead huérfano no se mueve a ciegas)", () => {
    expect(stageTargets(STATUSES, null)).toEqual([]);
  });

  it("un `type` nulo NO es la bandeja de entrada: se puede mover ahí", () => {
    expect(stageTargets([s(4, 10, null)], 10).map((x) => x.id)).toEqual([4]);
  });
});

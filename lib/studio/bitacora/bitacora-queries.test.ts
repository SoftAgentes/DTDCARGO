import { describe, it, expect } from "vitest";
import { groupTasksForHoy, type HoyGroupable } from "./bitacora-queries";

const HOY = "2026-07-04";

function task(
  over: Partial<HoyGroupable> & { titulo: string },
): HoyGroupable & { titulo: string } {
  return {
    estado: "pendiente",
    prioridad: "media",
    due_date: null,
    orden: 0,
    ...over,
  };
}

describe("groupTasksForHoy (SDD-0146 · vista Hoy)", () => {
  it("agrupa atrasada / para hoy / próxima / sin fecha", () => {
    const g = groupTasksForHoy(
      [
        task({ titulo: "atrasada", due_date: "2026-07-01" }),
        task({ titulo: "hoy", due_date: HOY }),
        task({ titulo: "proxima", due_date: "2026-07-10" }),
        task({ titulo: "sin-fecha", due_date: null }),
      ],
      HOY,
    );
    expect(g.atrasadas.map((t) => t.titulo)).toEqual(["atrasada"]);
    expect(g.paraHoy.map((t) => t.titulo)).toEqual(["hoy"]);
    expect(g.proximas.map((t) => t.titulo)).toEqual(["proxima"]);
    expect(g.sinFecha.map((t) => t.titulo)).toEqual(["sin-fecha"]);
  });

  it("excluye las hechas (la vista Hoy lista lo accionable)", () => {
    const g = groupTasksForHoy(
      [
        task({ titulo: "hecha", estado: "hecho", due_date: HOY }),
        task({ titulo: "viva", due_date: HOY }),
      ],
      HOY,
    );
    expect(g.paraHoy.map((t) => t.titulo)).toEqual(["viva"]);
  });

  it("ordena por due_date asc y luego prioridad alta→media→baja", () => {
    const g = groupTasksForHoy(
      [
        task({ titulo: "b-media", due_date: "2026-07-02", prioridad: "media" }),
        task({ titulo: "c-tarde", due_date: "2026-07-03", prioridad: "alta" }),
        task({ titulo: "a-alta", due_date: "2026-07-02", prioridad: "alta" }),
        task({ titulo: "d-baja", due_date: "2026-07-02", prioridad: "baja" }),
      ],
      HOY,
    );
    expect(g.atrasadas.map((t) => t.titulo)).toEqual([
      "a-alta", // 07-02 alta
      "b-media", // 07-02 media
      "d-baja", // 07-02 baja
      "c-tarde", // 07-03 (fecha manda sobre prioridad)
    ]);
  });

  it("sin fecha: ordena por prioridad alta→media→baja", () => {
    const g = groupTasksForHoy(
      [
        task({ titulo: "baja", prioridad: "baja" }),
        task({ titulo: "alta", prioridad: "alta" }),
        task({ titulo: "media", prioridad: "media" }),
      ],
      HOY,
    );
    expect(g.sinFecha.map((t) => t.titulo)).toEqual(["alta", "media", "baja"]);
  });

  it("empate total → desempata por orden y luego título (estable)", () => {
    const g = groupTasksForHoy(
      [
        task({ titulo: "zeta", due_date: HOY, orden: 1 }),
        task({ titulo: "alfa", due_date: HOY, orden: 2 }),
        task({ titulo: "beta", due_date: HOY, orden: 1 }),
      ],
      HOY,
    );
    expect(g.paraHoy.map((t) => t.titulo)).toEqual(["beta", "zeta", "alfa"]);
  });

  it("lista vacía → 4 grupos vacíos", () => {
    const g = groupTasksForHoy([], HOY);
    expect(g.atrasadas).toEqual([]);
    expect(g.paraHoy).toEqual([]);
    expect(g.proximas).toEqual([]);
    expect(g.sinFecha).toEqual([]);
  });
});

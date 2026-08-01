/**
 * Tests de la decisión de `next-number.mjs`: qué número está tomado y cuál sigue.
 *
 * QUÉ PROTEGEN: que mire TODAS las refs y no sólo la propia. Ese es el punto del
 * script — el 29-jul cuatro colisiones salieron de "mirar el disco local", que
 * sólo ve tu rama mientras hay 15-20 worktrees en paralelo.
 *
 * El acceso a git está inyectado (`lsTree`) para que el test no dependa del
 * estado real del repo, que cambia cada vez que otra ventana pushea.
 */
import { describe, expect, it } from "vitest";
import { nextFree, takenNumbers } from "./next-number.mjs";

/** Fake de `git ls-tree` — un mapa ref → archivos. */
function fakeLsTree(porRef) {
  return (ref, dir) =>
    (porRef[ref] ?? []).filter((f) => f.startsWith(dir + "/"));
}

describe("takenNumbers", () => {
  it("junta los números de TODAS las refs, no sólo de una", () => {
    // El caso real: mi rama tiene 0175 y otra ventana ya publicó 0175 y 0176.
    const lsTree = fakeLsTree({
      "feat/mio": ["docs/specs/0175-portal-estado-de-cuenta/spec.md"],
      "origin/main": [
        "docs/specs/0174-audit-atomicidad/spec.md",
        "docs/specs/0175-vis-02-tipografia/spec.md",
      ],
      "codex/otra": ["docs/specs/0176-lo-que-sea/spec.md"],
    });
    const taken = takenNumbers(
      "specs",
      ["feat/mio", "origin/main", "codex/otra"],
      lsTree,
    );
    expect([...taken].sort((a, b) => a - b)).toEqual([174, 175, 176]);
  });

  it("mirar UNA sola ref es justamente el bug — devuelve menos números", () => {
    const lsTree = fakeLsTree({
      "feat/mio": ["docs/specs/0175-mio/spec.md"],
      "origin/main": ["docs/specs/0176-ajeno/spec.md"],
    });
    expect([...takenNumbers("specs", ["feat/mio"], lsTree)]).toEqual([175]);
    expect(
      [...takenNumbers("specs", ["feat/mio", "origin/main"], lsTree)].sort(),
    ).toEqual([175, 176]);
  });

  it("separa specs de migraciones (comparten rango de números)", () => {
    const lsTree = fakeLsTree({
      main: [
        "docs/specs/0175-x/spec.md",
        "supabase/migrations/0270_y.sql",
      ],
    });
    expect([...takenNumbers("specs", ["main"], lsTree)]).toEqual([175]);
    expect([...takenNumbers("migrations", ["main"], lsTree)]).toEqual([270]);
  });

  it("cuenta el sufijo de letra como su número base (0006b → 6)", () => {
    const lsTree = fakeLsTree({
      main: ["supabase/migrations/0006b_clients_seed_align.sql"],
    });
    expect([...takenNumbers("migrations", ["main"], lsTree)]).toEqual([6]);
  });

  it("una ref sin ese directorio no aporta nada y no revienta", () => {
    const lsTree = fakeLsTree({ vacia: [] });
    expect([...takenNumbers("specs", ["vacia"], lsTree)]).toEqual([]);
  });
});

describe("nextFree", () => {
  it("devuelve el siguiente al MÁXIMO, no el primer hueco", () => {
    // Los huecos son normales (números que nunca se usaron: 0061-0065, 0089…).
    // Reusarlos rompería la trazabilidad de un correlativo ISO 9001.
    expect(nextFree(new Set([1, 2, 3, 10]))).toBe(11);
  });

  it("arranca en 1 con el set vacío", () => {
    expect(nextFree(new Set())).toBe(1);
  });

  it("no se marea con el orden de inserción", () => {
    expect(nextFree(new Set([270, 5, 174]))).toBe(271);
  });
});

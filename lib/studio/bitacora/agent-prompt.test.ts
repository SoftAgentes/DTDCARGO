import { describe, it, expect } from "vitest";
import { buildAgentPrompt, buildAllAgentPrompts } from "./agent-prompt";

describe("buildAgentPrompt", () => {
  it("arma título + descripción + checklist + contexto", () => {
    const out = buildAgentPrompt({
      titulo: "Migrar el endpoint de tracking",
      descripcion: "Reemplazar el mock por fetch real.",
      checklist: [
        { texto: "Leer la spec", done: true },
        { texto: "Escribir el fetch", done: false },
      ],
    });
    expect(out).toContain("Tarea: Migrar el endpoint de tracking");
    expect(out).toContain("Reemplazar el mock por fetch real.");
    expect(out).toContain("Pasos:");
    expect(out).toContain("- [x] Leer la spec");
    expect(out).toContain("- [ ] Escribir el fetch");
    expect(out).toContain("Claude Code");
  });

  it("sin descripción → no incluye bloque de descripción pero sí título y contexto", () => {
    const out = buildAgentPrompt({ titulo: "Tarea suelta", descripcion: null });
    expect(out).toContain("Tarea: Tarea suelta");
    expect(out).toContain("Claude Code");
    // No hay pasos ni cuerpo de descripción.
    expect(out).not.toContain("Pasos:");
  });

  it("sin checklist → omite la sección de pasos", () => {
    const out = buildAgentPrompt({
      titulo: "T",
      descripcion: "algo",
      checklist: [],
    });
    expect(out).not.toContain("Pasos:");
  });

  it("descarta puntos de checklist vacíos y recorta espacios", () => {
    const out = buildAgentPrompt({
      titulo: "  T  ",
      checklist: [
        { texto: "  real  ", done: false },
        { texto: "   ", done: false },
      ],
    });
    expect(out).toContain("Tarea: T");
    expect(out).toContain("- [ ] real");
    expect(out.match(/- \[/g)?.length).toBe(1); // solo un punto (el vacío se descartó)
  });

  it("bloques separados por doble salto de línea (legible al pegar)", () => {
    const out = buildAgentPrompt({ titulo: "T", descripcion: "D" });
    expect(out).toContain("Tarea: T\n\nD\n\n");
  });
});

describe("buildAllAgentPrompts", () => {
  const t1 = {
    titulo: "Migrar tracking",
    descripcion: "Reemplazar el mock por fetch real.",
    checklist: [{ texto: "Leer la spec", done: false }],
  };
  const t2 = { titulo: "Escribir tests", descripcion: null };

  it("junta varias tareas: cuerpo de cada una + un solo divisor", () => {
    const out = buildAllAgentPrompts([t1, t2]);
    expect(out).toContain("Tarea: Migrar tracking");
    expect(out).toContain("Tarea: Escribir tests");
    // Un único divisor entre las dos tareas.
    expect(out.match(/──────────/g)?.length).toBe(1);
  });

  it("encabezado con el conteo (plural)", () => {
    const out = buildAllAgentPrompts([t1, t2]);
    expect(out).toContain("# 2 tareas para Claude Code — Bitácora DTD");
  });

  it("una sola tarea → encabezado en singular y sin divisor", () => {
    const out = buildAllAgentPrompts([t1]);
    expect(out).toContain("# 1 tarea para Claude Code — Bitácora DTD");
    expect(out).not.toContain("──────────");
  });

  it("reusa buildAgentPrompt por tarea (mismo cuerpo)", () => {
    const out = buildAllAgentPrompts([t1]);
    expect(out).toContain(buildAgentPrompt(t1));
  });

  it("lista vacía → string vacío (nada que copiar)", () => {
    expect(buildAllAgentPrompts([])).toBe("");
  });
});

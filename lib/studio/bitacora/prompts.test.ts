import { describe, it, expect } from "vitest";
import { buildActaPrompt } from "./prompts";

const BASE = {
  transcript:
    "Reunión de prueba: hablamos del embarque de Yiwu y quedó pendiente el pago.",
  teamNames: ["Ana Pérez", "José Rodríguez"],
  hoyISO: "2026-07-04",
  hoyDia: "sábado",
};

describe("buildActaPrompt (SDD-0146 · secretario de actas)", () => {
  it("inyecta el ancla dura de HOY (día es-VE + fecha ISO)", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "interna" });
    expect(p).toContain("HOY es sábado 2026-07-04");
    expect(p).toContain("nunca hacia años pasados");
  });

  it("incluye los nombres reales del equipo para el mapeo", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "interna" });
    expect(p).toContain("Ana Pérez, José Rodríguez");
    expect(p).toContain("Mapea cada responsable");
  });

  it("usa 'puntos' (rename) y NUNCA 'bitácora'", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "interna" });
    expect(p).toContain("- puntos:");
    expect(p).not.toMatch(/bit[aá]cora/i);
  });

  it("trae la instrucción de no inventar", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "interna" });
    expect(p).toContain("NO inventes tareas ni entregables");
  });

  it("incluye la transcripción trimmeada", () => {
    const p = buildActaPrompt({
      ...BASE,
      tipo: "interna",
      transcript: "   texto con espacios alrededor   ",
    });
    expect(p).toContain("--- TRANSCRIPCIÓN ---\ntexto con espacios alrededor");
  });

  it("variante interna: contexto de reunión de equipo, sin entregables_cliente", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "interna" });
    expect(p).toContain("Esto es una reunión interna de trabajo del equipo.");
    expect(p).not.toContain("CONVERSACIÓN CON EL CLIENTE");
    expect(p).not.toContain("entregables_cliente");
  });

  it("variante cliente: contexto de cliente + nombre + entregables_cliente", () => {
    const p = buildActaPrompt({
      ...BASE,
      tipo: "cliente",
      clienteNombre: "Importadora Sol",
    });
    expect(p).toContain('CONVERSACIÓN CON EL CLIENTE "Importadora Sol"');
    expect(p).toContain(
      "El cliente NO usa nuestro sistema ni ejecuta tareas",
    );
    expect(p).toContain("entregables_cliente");
  });

  it("variante cliente sin nombre → 'el cliente'", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "cliente", clienteNombre: null });
    expect(p).toContain('CONVERSACIÓN CON EL CLIENTE "el cliente"');
  });

  it("sin lista de equipo → '(sin lista)'", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "interna", teamNames: [] });
    expect(p).toContain("(sin lista)");
  });
});

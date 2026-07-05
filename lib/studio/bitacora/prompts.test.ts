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

  // ── resumenGuia (mejora "volver a generar tareas") ──
  it("resumenGuia: inyecta la GUÍA PRIORITARIA con el resumen del líder", () => {
    const p = buildActaPrompt({
      ...BASE,
      tipo: "interna",
      resumenGuia: "Cobrar el saldo pendiente a Importadora Sol antes del viernes.",
    });
    expect(p).toContain("GUÍA PRIORITARIA");
    expect(p).toContain("Cobrar el saldo pendiente a Importadora Sol");
    expect(p).toContain("sin inventar nada que no esté en la transcripción");
  });

  it("resumenGuia va ANTES del bloque de la transcripción", () => {
    const p = buildActaPrompt({
      ...BASE,
      tipo: "interna",
      resumenGuia: "Prioridad: cerrar el embarque de Yiwu.",
    });
    expect(p.indexOf("GUÍA PRIORITARIA")).toBeGreaterThan(-1);
    expect(p.indexOf("GUÍA PRIORITARIA")).toBeLessThan(
      p.indexOf("--- TRANSCRIPCIÓN ---"),
    );
  });

  it("sin resumenGuia: el prompt es idéntico al de antes (sin bloque de guía)", () => {
    const base = buildActaPrompt({ ...BASE, tipo: "interna" });
    const vacio = buildActaPrompt({ ...BASE, tipo: "interna", resumenGuia: "" });
    const espacios = buildActaPrompt({
      ...BASE,
      tipo: "interna",
      resumenGuia: "   ",
    });
    expect(base).not.toContain("GUÍA PRIORITARIA");
    expect(vacio).toBe(base);
    expect(espacios).toBe(base);
  });
});

import { describe, it, expect } from "vitest";
import {
  buildActaPrompt,
  buildActaCommonBlock,
  buildEscuchaPrompt,
} from "./prompts";

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

  // ── SDD-0150 Fase A: contrato rico + concisión + anti-alucinación ──
  it("pide hilos, dudas y vínculo con cliente (contrato rico)", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "interna" });
    expect(p).toContain("- hilos:");
    expect(p).toContain("- dudas_clasificacion:");
    expect(p).toContain("- vinculo_cliente:");
    expect(p).toContain("NO inventes un cliente");
  });

  it("instruye concisión (BREVE) y la regla anti-alucinación de audio", () => {
    const p = buildActaPrompt({ ...BASE, tipo: "interna" });
    expect(p).toContain("sé BREVE");
    expect(p).toContain(
      "no inventes tono, pausas ni gestos que no estén en el texto",
    );
  });
});

describe("buildActaCommonBlock (SDD-0150 · núcleo compartido)", () => {
  it("interna (sin entregables): NO menciona entregables_cliente", () => {
    const b = buildActaCommonBlock({
      teamNames: ["Ana Pérez"],
      incluyeEntregables: false,
    });
    expect(b).toContain("- hilos:");
    expect(b).toContain("- dudas_clasificacion:");
    expect(b).toContain("Ana Pérez");
    expect(b).not.toContain("entregables_cliente");
  });

  it("cliente (con entregables): incluye entregables_cliente", () => {
    const b = buildActaCommonBlock({
      teamNames: [],
      incluyeEntregables: true,
    });
    expect(b).toContain("entregables_cliente");
    expect(b).toContain("(sin lista)");
  });
});

describe("buildEscuchaPrompt (SDD-0150 Fase D · crítica privada)", () => {
  const EBASE = {
    transcript: "Reunión: María dijo «voy a tratar» sobre la cotización del mes.",
    hoyISO: "2026-07-05",
    hoyDia: "domingo",
    teamNames: ["Ana Pérez"],
    actaResumen: "Se habló de la cotización pendiente.",
    actaTareas: [
      { titulo: "Cotización nueva", prioridad: "media" },
      { titulo: "Pago del almacén", prioridad: "baja" },
    ],
  };

  it("NO rehace el acta: la framea como crítica + regla anti-alucinación", () => {
    const p = buildEscuchaPrompt(EBASE);
    expect(p).toContain("NO la rehagas");
    expect(p).toContain(
      "no inventes tono, pausas ni gestos que no estén en el texto",
    );
    expect(p).toContain("HOY es domingo 2026-07-05");
  });

  it("lista las tareas ya propuestas con su índice (task_index)", () => {
    const p = buildEscuchaPrompt(EBASE);
    expect(p).toContain("[0] Cotización nueva (prioridad media)");
    expect(p).toContain("[1] Pago del almacén (prioridad baja)");
  });

  it("incluye el resumen de la default y la transcripción", () => {
    const p = buildEscuchaPrompt(EBASE);
    expect(p).toContain("Se habló de la cotización pendiente.");
    expect(p).toContain("--- TRANSCRIPCIÓN ---");
    expect(p).toContain("voy a tratar");
  });

  it("sin tareas → '(sin tareas propuestas)'", () => {
    const p = buildEscuchaPrompt({ ...EBASE, actaTareas: [] });
    expect(p).toContain("(sin tareas propuestas)");
  });
});

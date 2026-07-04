import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { extractActa } from "./extract";

const OPTS = {
  tipo: "interna" as const,
  teamNames: ["Ana Pérez", "José Rodríguez"],
  hoyISO: "2026-07-04",
  hoyDia: "sábado",
};

describe("extractActa (SDD-0146 · mock determinista + guard)", () => {
  // Forzamos el mock: dev/tests/verify NO gastan tokens ni pegan a la red.
  const prev = process.env.LLM_FORCE_MOCK;
  beforeAll(() => {
    process.env.LLM_FORCE_MOCK = "1";
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.LLM_FORCE_MOCK;
    else process.env.LLM_FORCE_MOCK = prev;
  });

  it("guard: transcript < 20 chars → { error }, nunca lanza", async () => {
    const r = await extractActa("hola corto", OPTS);
    expect("error" in r).toBe(true);
  });

  it("mock sin IA devuelve una estructura de acta válida", async () => {
    const r = await extractActa(
      "Reunión: hablamos del embarque de Yiwu y del pago pendiente del cliente.",
      OPTS,
    );
    expect("acta" in r).toBe(true);
    if ("acta" in r) {
      expect(typeof r.acta.resumen).toBe("string");
      expect(Array.isArray(r.acta.puntos)).toBe(true);
      expect(Array.isArray(r.acta.hablaron)).toBe(true);
      expect(Array.isArray(r.acta.tareas)).toBe(true);
      expect(r.acta.tareas.length).toBeGreaterThan(0);
      expect(r.acta.tareas[0].titulo.length).toBeGreaterThan(0);
      expect(r.acta.tareas[0].prioridad).toBe("media");
    }
  });

  it("el mock es determinista (misma entrada → misma salida)", async () => {
    const t = "Conversación de trabajo sobre logística internacional y aduana.";
    const a = await extractActa(t, OPTS);
    const b = await extractActa(t, OPTS);
    expect(a).toEqual(b);
  });

  it("variante cliente: el mock puebla entregables_cliente", async () => {
    const r = await extractActa(
      "Llamada con el cliente para coordinar el adelanto y el logo en vector.",
      { ...OPTS, tipo: "cliente", clienteNombre: "Sol" },
    );
    expect("acta" in r).toBe(true);
    if ("acta" in r) {
      expect(r.acta.entregables_cliente?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

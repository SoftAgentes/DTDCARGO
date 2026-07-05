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
      // SDD-0150: el contrato ahora trae hilos + dudas (arrays, vacíos en el mock).
      expect(Array.isArray(r.acta.hilos)).toBe(true);
      expect(Array.isArray(r.acta.dudas_clasificacion)).toBe(true);
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
      // SDD-0150 Fase B: el mock detecta el externo por el nombre del cliente.
      expect(r.acta.vinculo_cliente?.nombre_detectado).toBe("Sol");
    }
  });

  it("propaga resumenGuia: el mock deriva la propuesta del resumen del líder", async () => {
    const transcript =
      "Reunión larga sobre logística, embarques y varios temas administrativos del mes.";
    const conGuia = await extractActa(transcript, {
      ...OPTS,
      resumenGuia: "Cobrar el saldo pendiente a Importadora Sol antes del viernes.",
    });
    const sinGuia = await extractActa(transcript, OPTS);
    expect("acta" in conGuia && "acta" in sinGuia).toBe(true);
    if ("acta" in conGuia && "acta" in sinGuia) {
      const titulos = conGuia.acta.tareas.map((t) => t.titulo).join(" | ");
      expect(titulos).toContain("Cobrar el saldo");
      // Sin la guía la propuesta sale del transcript → distinta.
      expect(conGuia.acta.tareas[0].titulo).not.toBe(
        sinGuia.acta.tareas[0].titulo,
      );
    }
  });
});

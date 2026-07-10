import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  summarizeMonthThread,
  summarizeMonthThreadForClient,
  type DigestMessage,
} from "../digest-extract";

const OPTS = { clientName: "Importadora Sol", periodLabel: "julio 2026" };

const THREAD: DigestMessage[] = [
  { direction: "in", body: "Hola, ¿cómo va mi embarque de Yiwu?", authorName: null },
  { direction: "out", body: "Ya salió del puerto, llega en 25 días.", authorName: "Ana" },
  { direction: "in", body: "Perfecto, ¿me avisas cuando llegue?", authorName: null },
];

describe("digest-extract (SDD-0149 · mock determinista + guard)", () => {
  // Forzamos el mock: dev/tests/verify NO gastan tokens ni pegan a la red.
  const prev = process.env.LLM_FORCE_MOCK;
  beforeAll(() => {
    process.env.LLM_FORCE_MOCK = "1";
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.LLM_FORCE_MOCK;
    else process.env.LLM_FORCE_MOCK = prev;
  });

  it("guard: sin mensajes → { error }, nunca lanza (interno y cliente)", async () => {
    const ri = await summarizeMonthThread([], OPTS);
    const rc = await summarizeMonthThreadForClient([], OPTS);
    expect("error" in ri).toBe(true);
    expect("error" in rc).toBe(true);
  });

  it("interno: el mock devuelve resumen + model 'mock' + conteo de mensajes", async () => {
    const r = await summarizeMonthThread(THREAD, OPTS);
    expect("summary" in r).toBe(true);
    if ("summary" in r) {
      expect(r.model).toBe("mock");
      expect(r.summary.length).toBeGreaterThan(0);
      expect(r.summary).toContain("3 mensajes"); // 2 del cliente + 1 del equipo
    }
  });

  it("cliente: el mock habla al cliente y no filtra markdown interno", async () => {
    const r = await summarizeMonthThreadForClient(THREAD, OPTS);
    expect("summary" in r).toBe(true);
    if ("summary" in r) {
      expect(r.model).toBe("mock");
      expect(r.summary).toContain("julio 2026");
      // El resumen del cliente nunca debe llevar asteriscos markdown a la vista.
      expect(r.summary).not.toContain("**");
    }
  });

  it("ambos mocks son deterministas (misma entrada → misma salida)", async () => {
    expect(await summarizeMonthThread(THREAD, OPTS)).toEqual(
      await summarizeMonthThread(THREAD, OPTS),
    );
    expect(await summarizeMonthThreadForClient(THREAD, OPTS)).toEqual(
      await summarizeMonthThreadForClient(THREAD, OPTS),
    );
  });

  it("interno y cliente producen textos distintos (tono asesor vs cliente)", async () => {
    const ri = await summarizeMonthThread(THREAD, OPTS);
    const rc = await summarizeMonthThreadForClient(THREAD, OPTS);
    if ("summary" in ri && "summary" in rc) {
      expect(ri.summary).not.toBe(rc.summary);
    }
  });
});

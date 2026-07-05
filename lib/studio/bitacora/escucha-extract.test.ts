import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { extractEscucha } from "./escucha-extract";
import { ESCUCHA_SUGERENCIA_TIPOS } from "./bitacora-types";

const OPTS = {
  hoyISO: "2026-07-05",
  hoyDia: "domingo",
  teamNames: ["Ana Pérez", "José Rodríguez"],
  actaResumen: "Se coordinó la entrega a Maracaibo y quedó pendiente la orden de compra.",
  actaTareas: [
    { titulo: "Recordar la orden de compra firmada", prioridad: "media" },
    { titulo: "Confirmar el peso total antes del jueves", prioridad: "alta" },
  ],
};

describe("extractEscucha (SDD-0150 Fase D · mock determinista + guard)", () => {
  const prev = process.env.LLM_FORCE_MOCK;
  beforeAll(() => {
    process.env.LLM_FORCE_MOCK = "1";
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.LLM_FORCE_MOCK;
    else process.env.LLM_FORCE_MOCK = prev;
  });

  it("guard: transcript < 20 chars → { error }, nunca lanza", async () => {
    const r = await extractEscucha("corto", OPTS);
    expect("error" in r).toBe(true);
  });

  it("mock devuelve sugerencias con la forma correcta", async () => {
    const r = await extractEscucha(
      "Reunión: María dijo «voy a tratar» sobre la cotización; Julio pidió el peso total antes del jueves.",
      OPTS,
    );
    expect("sugerencias" in r).toBe(true);
    if ("sugerencias" in r) {
      expect(r.sugerencias.length).toBeGreaterThan(0);
      const s = r.sugerencias[0];
      expect(ESCUCHA_SUGERENCIA_TIPOS).toContain(s.tipo);
      expect(typeof s.sugerido).toBe("string");
      expect(typeof s.motivo).toBe("string");
      expect(s.task_index === null || typeof s.task_index === "number").toBe(true);
    }
  });

  it("es determinista (misma entrada → misma salida)", async () => {
    const t = "Conversación de trabajo sobre logística internacional y aduana del mes.";
    const a = await extractEscucha(t, OPTS);
    const b = await extractEscucha(t, OPTS);
    expect(a).toEqual(b);
  });

  it("sin tareas en el acta → el mock no inventa sugerencias", async () => {
    const r = await extractEscucha(
      "Reunión breve donde no se acordó ninguna tarea concreta todavía.",
      { ...OPTS, actaTareas: [] },
    );
    expect("sugerencias" in r).toBe(true);
    if ("sugerencias" in r) expect(r.sugerencias).toEqual([]);
  });
});

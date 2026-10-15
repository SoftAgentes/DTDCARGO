// @vitest-environment node
/**
 * SDD-0525 — el modelo de Anthropic del acta y de la Escucha Activa con la
 * variable vacía, con espacios, definida y sin definir.
 *
 * Docker Compose pasa `BITACORA_ACTA_MODEL=` como `""`. Con `??` el `""` no caía
 * al default y la llamada salía con `model: ""`. Aquí se mira el `model` que le
 * llega a `messages.create`; el SDK está doblado y no sale nada a la red.
 *
 * Cada caso importa el módulo de nuevo después de fijar el entorno, así la
 * prueba no depende de cuándo lee el módulo la variable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const DEFAULT = "claude-sonnet-4-6";
const TRANSCRIPT = "Sam: revisamos el contenedor de Yiwu y quedamos en llamar al cliente el lunes.";

function setEnv(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

function modelSent(): unknown {
  expect(create).toHaveBeenCalledTimes(1);
  return create.mock.calls[0][0].model;
}

beforeEach(() => {
  vi.resetModules();
  create.mockReset();
  create.mockResolvedValue({ content: [] });
  // Clave falsa: sólo hace que el módulo tome el camino real, que está doblado.
  setEnv({ ANTHROPIC_API_KEY: "test-key-no-real", LLM_FORCE_MOCK: undefined });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extractActa · BITACORA_ACTA_MODEL", () => {
  it.each([
    ["sin definir", undefined, DEFAULT],
    ["vacía", "", DEFAULT],
    ["con sólo espacios", "   ", DEFAULT],
    ["definida", "claude-opus-4-1", "claude-opus-4-1"],
    ["definida con espacios alrededor", " claude-opus-4-1\n", "claude-opus-4-1"],
  ])("%s", async (_caso, acta, esperado) => {
    setEnv({ BITACORA_ACTA_MODEL: acta });
    const { extractActa } = await import("../extract");

    await extractActa(TRANSCRIPT, {
      tipo: "interna",
      teamNames: ["Sam"],
      hoyISO: "2026-10-15",
      hoyDia: "jueves",
    });

    expect(modelSent()).toBe(esperado);
  });
});

describe("extractEscucha · BITACORA_ESCUCHA_MODEL → BITACORA_ACTA_MODEL → default", () => {
  it.each([
    ["las dos sin definir", undefined, undefined, DEFAULT],
    ["las dos vacías", "", "", DEFAULT],
    ["las dos con sólo espacios", "  ", "\t", DEFAULT],
    ["escucha vacía, acta definida", "", "claude-acta", "claude-acta"],
    ["escucha con espacios, acta definida", "   ", "claude-acta", "claude-acta"],
    ["escucha sin definir, acta definida", undefined, "claude-acta", "claude-acta"],
    ["escucha definida, acta vacía", "claude-escucha", "", "claude-escucha"],
    ["las dos definidas: gana escucha", "claude-escucha", "claude-acta", "claude-escucha"],
    ["escucha con espacios alrededor", " claude-escucha ", "claude-acta", "claude-escucha"],
  ])("%s", async (_caso, escucha, acta, esperado) => {
    setEnv({ BITACORA_ESCUCHA_MODEL: escucha, BITACORA_ACTA_MODEL: acta });
    const { extractEscucha } = await import("../escucha-extract");

    await extractEscucha(TRANSCRIPT, {
      hoyISO: "2026-10-15",
      hoyDia: "jueves",
      teamNames: ["Sam"],
      actaResumen: "Revisión del contenedor de Yiwu.",
      actaTareas: [{ titulo: "Llamar al cliente", prioridad: "media" }],
    });

    expect(modelSent()).toBe(esperado);
  });
});

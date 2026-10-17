// @vitest-environment node
/**
 * SDD-0525 — el modelo del resumen mensual con `CONVERSATION_DIGEST_MODEL` y
 * `BITACORA_ACTA_MODEL` vacías, con espacios, definidas y sin definir.
 *
 * `digest-extract.ts` lee el modelo al cargar el módulo, así que cada caso fija
 * el entorno y lo importa de nuevo. Se miran dos cosas: el `model` que le llega
 * a `messages.create` y el `model` que devuelve el resumen, que es la etiqueta
 * que se guarda junto al texto. El SDK está doblado y no sale nada a la red.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DigestMessage, DigestResult } from "../digest-extract";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const DEFAULT = "claude-sonnet-4-6";
const OPTS = { clientName: "Importadora Sol", periodLabel: "julio 2026" };
const THREAD: DigestMessage[] = [
  { direction: "in", body: "Hola, ¿cómo va mi embarque de Yiwu?", authorName: null },
  { direction: "out", body: "Ya salió del puerto, llega en 25 días.", authorName: "Ana" },
];

function setEnv(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

beforeEach(() => {
  vi.resetModules();
  create.mockReset();
  // Devuelve la tool que se pidió, con un resumen válido para las dos variantes.
  create.mockImplementation(async (params: { tool_choice: { name: string } }) => ({
    content: [
      {
        type: "tool_use",
        id: "toolu_test",
        name: params.tool_choice.name,
        input: { resumen: "Hablaron del embarque de Yiwu." },
      },
    ],
  }));
  // Clave falsa: sólo hace que el módulo tome el camino real, que está doblado.
  setEnv({ ANTHROPIC_API_KEY: "test-key-no-real", LLM_FORCE_MOCK: undefined });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const CASOS: Array<[string, string | undefined, string | undefined, string]> = [
  ["las dos sin definir", undefined, undefined, DEFAULT],
  ["las dos vacías", "", "", DEFAULT],
  ["las dos con sólo espacios", "   ", "\t", DEFAULT],
  ["digest vacía, acta definida", "", "claude-acta", "claude-acta"],
  ["digest con espacios, acta definida", "  ", "claude-acta", "claude-acta"],
  ["digest sin definir, acta definida", undefined, "claude-acta", "claude-acta"],
  ["digest definida, acta vacía", "claude-digest", "", "claude-digest"],
  ["las dos definidas: gana digest", "claude-digest", "claude-acta", "claude-digest"],
  ["digest con espacios alrededor", " claude-digest\n", "claude-acta", "claude-digest"],
];

describe.each([
  ["summarizeMonthThread", "summarizeMonthThread"],
  ["summarizeMonthThreadForClient", "summarizeMonthThreadForClient"],
] as const)("%s · CONVERSATION_DIGEST_MODEL → BITACORA_ACTA_MODEL → default", (_n, fn) => {
  it.each(CASOS)("%s", async (_caso, digest, acta, esperado) => {
    setEnv({ CONVERSATION_DIGEST_MODEL: digest, BITACORA_ACTA_MODEL: acta });
    const mod = await import("../digest-extract");

    const result: DigestResult = await mod[fn](THREAD, OPTS);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe(esperado);
    expect(result).toEqual({ summary: expect.any(String), model: esperado });
  });
});

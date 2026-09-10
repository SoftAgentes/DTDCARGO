import type { Locator } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pollToBe } = vi.hoisted(() => ({
  pollToBe: vi.fn(),
}));

vi.mock("@playwright/test", () => ({
  expect: {
    poll: vi.fn(() => ({ toBe: pollToBe })),
  },
}));

import { esperarHidratado } from "../../e2e/_helpers/hidratacion";

const CONDICION_ORIGINAL =
  "expect.poll: se esperaba que la condición de hidratación fuera true";
const CONTEXTO_DESTRUIDO =
  "page.evaluate: Execution context was destroyed, most likely because of a navigation";

describe("esperarHidratado", () => {
  let causaOriginal: Error;

  beforeEach(() => {
    vi.clearAllMocks();
    causaOriginal = new Error(CONDICION_ORIGINAL);
    pollToBe.mockRejectedValue(causaOriginal);
  });

  it("conserva la condición original cuando el contexto muere al diagnosticar", async () => {
    const evaluate = vi.fn().mockRejectedValue(new Error(CONTEXTO_DESTRUIDO));
    const locator = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      page: vi.fn(() => ({ evaluate })),
    } as unknown as Locator;

    let resultado: unknown;
    try {
      await esperarHidratado(locator, "el control de prueba");
    } catch (error) {
      resultado = error;
    }

    expect(evaluate).toHaveBeenCalledOnce();
    expect(resultado).toBeInstanceOf(Error);
    const error = resultado as Error & { cause?: unknown };
    expect(error.message).toContain("React nunca tomó el control de prueba");
    expect(error.message).toContain(CONDICION_ORIGINAL);
    expect(error.message).toContain("No se pudo contar");
    expect(error.message).toContain("contexto");
    expect(error.cause).toBe(causaOriginal);
  });

  it("mantiene el conteo diagnóstico cuando el contexto sigue disponible", async () => {
    const evaluate = vi.fn().mockResolvedValue(7);
    const locator = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      page: vi.fn(() => ({ evaluate })),
    } as unknown as Locator;

    let resultado: unknown;
    try {
      await esperarHidratado(locator, "el control de prueba");
    } catch (error) {
      resultado = error;
    }

    expect(resultado).toBeInstanceOf(Error);
    const error = resultado as Error & { cause?: unknown };
    expect(error.message).toContain(CONDICION_ORIGINAL);
    expect(error.message).toContain("Nodos con marcador en la página: 7");
    expect(error.message).toContain("React vive");
    expect(error.message).not.toContain("No se pudo contar");
    expect(error.cause).toBe(causaOriginal);
  });
});

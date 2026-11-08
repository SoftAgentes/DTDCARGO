/**
 * SDD-NNNN · 7.6 · motor de `dtd-bot` con un DOBLE: ninguna llamada a un modelo real.
 * Precio inventado (US$1 / US$2 por millón), no es la tarifa de ningún proveedor.
 */
import { describe, expect, it, vi } from "vitest";

import { costoLlamada, costoMaximo, estimarTokensEntrada, llamarMotor, type EntradaMotor, type Motor, type SalidaMotor } from "../motor";

const PRECIO = { entradaPorMillon: 1, salidaPorMillon: 2 };
const ENTRADA: EntradaMotor = {
  sistema: "s".repeat(100),
  mensajes: [{ rol: "cliente", texto: "c".repeat(92) }],
  maxTokensSalida: 500,
};

function doble(generar: Motor["generar"]): Motor {
  return { proveedor: "doble", modelo: "doble-1", precio: PRECIO, generar };
}

describe("costoLlamada", () => {
  it("tokens × precio por millón", () => {
    expect(costoLlamada(PRECIO, 1_000_000, 500_000)).toBe(2);
    expect(costoLlamada(PRECIO, 1_000, 1_000)).toBe(0.003);
  });

  it("redondea hacia arriba a la millonésima (el presupuesto nunca queda corto)", () => {
    expect(costoLlamada(PRECIO, 1, 0)).toBe(0.000001);
    expect(costoLlamada({ entradaPorMillon: 0.5, salidaPorMillon: 0 }, 1, 0)).toBe(0.000001);
  });

  it.each([
    [{ entradaPorMillon: -1, salidaPorMillon: 1 }, 1, 1],
    [{ entradaPorMillon: Number.NaN, salidaPorMillon: 1 }, 1, 1],
    [PRECIO, -1, 1],
    [PRECIO, 1.5, 1],
  ])("precio o tokens inválidos lanzan (%j, %s, %s)", (precio, e, s) => {
    expect(() => costoLlamada(precio, e, s)).toThrow();
  });
});

describe("estimación", () => {
  it("1 token cada 2 caracteres, por lo alto", () => {
    expect(estimarTokensEntrada(ENTRADA)).toBe(100); // (100 + 92 + 8) / 2
  });

  it("el costo máximo cuenta todos los tokens de salida permitidos", () => {
    expect(costoMaximo(PRECIO, ENTRADA)).toBe(costoLlamada(PRECIO, 100, 500));
  });
});

describe("llamarMotor", () => {
  it("una respuesta buena trae el texto y anota tokens y costo reales, sin el texto", async () => {
    const r = await llamarMotor(doble(async () => ({ texto: "  Hola  ", tokensEntrada: 80, tokensSalida: 20 })), ENTRADA, { timeoutMs: 1_000 });
    expect(r).toMatchObject({ ok: true, texto: "Hola" });
    expect(r.llamada).toMatchObject({
      proveedor: "doble",
      modelo: "doble-1",
      tokensEntrada: 80,
      tokensSalida: 20,
      costoUsd: costoLlamada(PRECIO, 80, 20),
      resultado: "ok",
      costoEstimado: false,
    });
    expect(JSON.stringify(r.llamada)).not.toContain("Hola");
  });

  it.each<[string, () => Promise<SalidaMotor>]>([
    ["texto vacío", async () => ({ texto: "   ", tokensEntrada: 1, tokensSalida: 1 })],
    ["sin texto", async () => ({ tokensEntrada: 1, tokensSalida: 1 }) as never],
    ["tokens negativos", async () => ({ texto: "x", tokensEntrada: -1, tokensSalida: 1 })],
    ["tokens con decimales", async () => ({ texto: "x", tokensEntrada: 1, tokensSalida: 0.5 })],
    ["null", async () => null as never],
  ])("respuesta inválida (%s) → no sigue y anota el peor caso", async (_caso, generar) => {
    const r = await llamarMotor(doble(generar), ENTRADA, { timeoutMs: 1_000 });
    expect(r).toMatchObject({ ok: false, motivo: "respuesta_invalida" });
    expect(r.llamada).toMatchObject({ costoUsd: costoMaximo(PRECIO, ENTRADA), costoEstimado: true, resultado: "respuesta_invalida" });
  });

  it("un error del motor → no sigue y anota el peor caso", async () => {
    const r = await llamarMotor(doble(async () => Promise.reject(new Error("caído"))), ENTRADA, { timeoutMs: 1_000 });
    expect(r).toMatchObject({ ok: false, motivo: "error" });
    expect(r.llamada.costoUsd).toBe(costoMaximo(PRECIO, ENTRADA));
  });

  it("vence por tiempo, aborta la señal y anota el peor caso", async () => {
    vi.useFakeTimers();
    try {
      let senal: AbortSignal | undefined;
      const p = llamarMotor(
        doble((_e, s) => {
          senal = s;
          return new Promise<SalidaMotor>(() => {});
        }),
        ENTRADA,
        { timeoutMs: 5_000 },
      );
      await vi.advanceTimersByTimeAsync(5_000);
      const r = await p;
      expect(r).toMatchObject({ ok: false, motivo: "timeout" });
      expect(r.llamada).toMatchObject({ resultado: "timeout", costoEstimado: true });
      expect(senal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("si el motor rechaza al abortarse, cuenta como timeout", async () => {
    vi.useFakeTimers();
    try {
      const p = llamarMotor(
        doble(
          (_e, s) =>
            new Promise<SalidaMotor>((_ok, mal) => {
              s.addEventListener("abort", () => mal(new Error("abortado")));
            }),
        ),
        ENTRADA,
        { timeoutMs: 100 },
      );
      await vi.advanceTimersByTimeAsync(100);
      expect(await p).toMatchObject({ ok: false, motivo: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("mide la duración con el reloj que se le pasa", async () => {
    const tiempos = [1_000, 1_250];
    const r = await llamarMotor(doble(async () => ({ texto: "x", tokensEntrada: 1, tokensSalida: 1 })), ENTRADA, {
      timeoutMs: 1_000,
      ahora: () => tiempos.shift() ?? 1_250,
    });
    expect(r.llamada.duracionMs).toBe(250);
  });
});

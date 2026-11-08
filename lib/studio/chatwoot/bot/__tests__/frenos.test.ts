/**
 * SDD-NNNN · 7.6 · frenos de `dtd-bot`: ráfagas, tope por conversación, presupuesto y
 * recortes. Puro; las fechas son inventadas.
 */
import { describe, expect, it } from "vitest";

import {
  abrirTiempos,
  dentroDelPresupuesto,
  dentroDelTopeConversacion,
  extenderTiempos,
  FRENOS_POR_DEFECTO,
  frenosDesde,
  recortar,
  turnoListo,
} from "../frenos";

const T0 = "2026-11-08T12:00:00.000Z";
const mas = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();

describe("frenos por defecto (decisión v3 de SDD-0582)", () => {
  it("8 s de inactividad, 24 s de máximo, recortes 2.000 / 4.096 y US$25 al mes", () => {
    expect(FRENOS_POR_DEFECTO).toMatchObject({
      inactividadMs: 8_000,
      maximoMs: 24_000,
      maxEntrada: 2_000,
      maxSalida: 4_096,
      topeMensualUsd: 25,
    });
    expect(Object.isFrozen(FRENOS_POR_DEFECTO)).toBe(true);
  });
});

describe("frenosDesde", () => {
  it("acepta valores dentro de los límites", () => {
    expect(frenosDesde({ inactividadMs: 10_000, maximoMs: 30_000, topeMensualUsd: 50 })).toMatchObject({
      inactividadMs: 10_000,
      maximoMs: 30_000,
      topeMensualUsd: 50,
    });
  });

  it.each([
    ["tope mensual sobre US$50", { topeMensualUsd: 51 }, "topeMensualUsd", 25],
    ["tope mensual negativo", { topeMensualUsd: -1 }, "topeMensualUsd", 25],
    ["salida sobre 4.096", { maxSalida: 5_000 }, "maxSalida", 4_096],
    ["texto en vez de número", { inactividadMs: "8000" }, "inactividadMs", 8_000],
    ["NaN", { topeConversacion24h: Number.NaN }, "topeConversacion24h", 6],
    ["infinito", { maxEntrada: Number.POSITIVE_INFINITY }, "maxEntrada", 2_000],
  ])("%s vuelve al valor por defecto", (_caso, parcial, clave, esperado) => {
    expect(frenosDesde(parcial as never)[clave as keyof typeof FRENOS_POR_DEFECTO]).toBe(esperado);
  });

  it("el máximo nunca queda por debajo de la inactividad", () => {
    expect(frenosDesde({ inactividadMs: 20_000, maximoMs: 5_000 })).toMatchObject({ inactividadMs: 20_000, maximoMs: 20_000 });
  });
});

describe("ráfagas", () => {
  it("un turno nuevo espera 8 s y vence a los 24 s", () => {
    expect(abrirTiempos(T0)).toEqual({ primerMensajeAt: T0, listoDesde: mas(8), limiteAt: mas(24) });
  });

  it("una llegada inválida no abre turno", () => {
    expect(() => abrirTiempos("no es fecha")).toThrow();
  });

  it("otro mensaje corre la espera 8 s más", () => {
    expect(extenderTiempos(abrirTiempos(T0), mas(5)).listoDesde).toBe(mas(13));
  });

  it("la espera nunca pasa del máximo, aunque el cliente siga escribiendo", () => {
    let t = abrirTiempos(T0);
    for (const s of [6, 12, 18, 22, 23]) t = extenderTiempos(t, mas(s));
    expect(t.listoDesde).toBe(mas(24));
    expect(t.limiteAt).toBe(mas(24));
  });

  it("un mensaje fuera de orden no adelanta la espera", () => {
    const t = extenderTiempos(abrirTiempos(T0), mas(10));
    expect(extenderTiempos(t, mas(3))).toEqual(t);
  });

  it("una llegada inválida no cambia nada", () => {
    const t = abrirTiempos(T0);
    expect(extenderTiempos(t, "x")).toEqual(t);
  });

  it("listo al cumplirse la inactividad, no antes", () => {
    const t = abrirTiempos(T0);
    expect(turnoListo(t, mas(7.999))).toBe(false);
    expect(turnoListo(t, mas(8))).toBe(true);
  });

  it("listo al llegar al límite aunque la espera diga otra cosa", () => {
    const t = { primerMensajeAt: T0, listoDesde: mas(30), limiteAt: mas(24) };
    expect(turnoListo(t, mas(24))).toBe(true);
    expect(turnoListo(t, mas(23))).toBe(false);
  });
});

describe("tope por conversación", () => {
  it.each([
    [0, true],
    [5, true],
    [6, false],
    [7, false],
    [-1, false],
    [1.5, false],
    [Number.NaN, false],
  ])("con %s respuestas en 24 h → %s", (n, esperado) => {
    expect(dentroDelTopeConversacion(n)).toBe(esperado);
  });
});

describe("presupuesto (corte duro)", () => {
  it.each([
    [0, 0.01, true],
    [24.99, 0.01, true],
    [24.99, 0.02, false],
    [25, 0, true],
    [25, 0.000001, false],
    [null, 0, false],
    [Number.NaN, 0, false],
    [-1, 0, false],
    [0, Number.NaN, false],
    [0, -1, false],
  ])("gasto %s + llamada %s → %s", (gasto, llamada, esperado) => {
    expect(dentroDelPresupuesto(gasto, llamada)).toBe(esperado);
  });
});

describe("recortar", () => {
  it("deja igual lo que cabe", () => {
    expect(recortar("hola", 4)).toEqual({ texto: "hola", recortado: false });
  });

  it("corta por puntos de código y no parte un emoji", () => {
    const r = recortar("ab📦cd", 3);
    expect(r).toEqual({ texto: "ab📦", recortado: true });
  });

  it("entrada de 2.000 y salida de 4.096 con los valores por defecto", () => {
    expect(Array.from(recortar("x".repeat(2_500), FRENOS_POR_DEFECTO.maxEntrada).texto)).toHaveLength(2_000);
    expect(Array.from(recortar("y".repeat(5_000), FRENOS_POR_DEFECTO.maxSalida).texto)).toHaveLength(4_096);
  });
});

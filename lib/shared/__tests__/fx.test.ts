/**
 * SDD-0569 · `toUsd`: la misma regla que `public.to_usd` (0495). Falla cerrado.
 */
import { describe, expect, it } from "vitest";
import { necesitaTasa, normalizarMoneda, tasaValida, toUsd } from "../fx";

describe("toUsd · el conversor canónico", () => {
  it("USD y USDT valen 1:1, sin tasa (decisión 1 de Sam)", () => {
    expect(toUsd(100, "USD")).toEqual({ ok: true, usd: 100 });
    expect(toUsd(100, "usdt", null)).toEqual({ ok: true, usd: 100 });
  });

  it("VES y CNY se dividen por la tasa; RMB es CNY", () => {
    expect(toUsd(36500, "VES", 36.5)).toEqual({ ok: true, usd: 1000 });
    expect(toUsd(718, "CNY", 7.18)).toEqual({ ok: true, usd: 100 });
    expect(toUsd(718, "RMB", "7.18")).toEqual({ ok: true, usd: 100 });
  });

  it("redondea a 2 decimales al final", () => {
    expect(toUsd(10, "VES", 3)).toEqual({ ok: true, usd: 3.33 });
  });

  it("sin tasa falla cerrado: nunca 0 ni el monto tal cual", () => {
    expect(toUsd(500, "VES", null)).toEqual({ ok: false, reason: "missing-fx-rate" });
    expect(toUsd(500, "CNY")).toEqual({ ok: false, reason: "missing-fx-rate" });
    expect(toUsd(500, "VES", 0)).toEqual({ ok: false, reason: "missing-fx-rate" });
    expect(toUsd(500, "VES", -1)).toEqual({ ok: false, reason: "missing-fx-rate" });
    expect(toUsd(500, "VES", Number.NaN)).toEqual({ ok: false, reason: "missing-fx-rate" });
    expect(toUsd(500, "VES", Number.POSITIVE_INFINITY)).toEqual({ ok: false, reason: "missing-fx-rate" });
    expect(toUsd(500, "VES", "")).toEqual({ ok: false, reason: "missing-fx-rate" });
  });

  it("una moneda desconocida o un monto que no es número fallan cerrado", () => {
    expect(toUsd(500, "EUR", 1.1)).toEqual({ ok: false, reason: "unknown-currency" });
    expect(toUsd(500, null, 1)).toEqual({ ok: false, reason: "unknown-currency" });
    expect(toUsd(Number.NaN, "USD")).toEqual({ ok: false, reason: "invalid-amount" });
    expect(toUsd("abc", "USD")).toEqual({ ok: false, reason: "invalid-amount" });
  });
});

describe("los ayudantes", () => {
  it("normalizarMoneda, necesitaTasa y tasaValida", () => {
    expect(normalizarMoneda(" rmb ")).toBe("CNY");
    expect(normalizarMoneda("eur")).toBeNull();
    expect(necesitaTasa("VES")).toBe(true);
    expect(necesitaTasa("CNY")).toBe(true);
    expect(necesitaTasa("USDT")).toBe(false);
    expect(tasaValida("36.5")).toBe(36.5);
    expect(tasaValida(0)).toBeNull();
    expect(tasaValida(Number.NaN)).toBeNull();
  });
});

describe("toUsd da lo mismo que to_usd (revisión de seguridad, hallazgos 5 y 12)", () => {
  // Los mismos casos que el contrato supabase/tests/0495_fx_rates_conversor_usd.test.sql.
  it("el medio centavo se redondea lejos de cero, con aritmética decimal exacta", () => {
    expect(toUsd(15.66, "CNY", 7.2)).toEqual({ ok: true, usd: 2.18 });
    expect(toUsd(-15.66, "CNY", 7.2)).toEqual({ ok: true, usd: -2.18 });
    expect(toUsd(10.075, "USD")).toEqual({ ok: true, usd: 10.08 });
    expect(toUsd(-10.075, "USDT")).toEqual({ ok: true, usd: -10.08 });
    expect(toUsd(0.005, "USD")).toEqual({ ok: true, usd: 0.01 });
    expect(toUsd("15.66", "CNY", "7.2")).toEqual({ ok: true, usd: 2.18 });
  });

  it("el tope es |monto| < 1e12, como en SQL", () => {
    expect(toUsd(999999999999.99, "USD")).toEqual({ ok: true, usd: 999999999999.99 });
    expect(toUsd(1e12, "USD")).toEqual({ ok: false, reason: "invalid-amount" });
    expect(toUsd(-1e12, "USD")).toEqual({ ok: false, reason: "invalid-amount" });
  });

  it("sin monto (null, vacío) falla cerrado, como en SQL", () => {
    expect(toUsd(null as unknown as number, "USD")).toEqual({ ok: false, reason: "invalid-amount" });
    expect(toUsd("", "USD")).toEqual({ ok: false, reason: "invalid-amount" });
    expect(toUsd("  ", "VES", 36)).toEqual({ ok: false, reason: "invalid-amount" });
  });

  it("una tasa con exponente o con muchos decimales también da exacto", () => {
    expect(toUsd(1, "VES", 1e-7)).toEqual({ ok: true, usd: 10000000 });
    expect(toUsd(100, "VES", "36.12345678")).toEqual({ ok: true, usd: 2.77 });
  });
});

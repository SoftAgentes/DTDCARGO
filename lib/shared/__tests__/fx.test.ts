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

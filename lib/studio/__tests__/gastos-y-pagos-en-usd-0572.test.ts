/**
 * SDD-0572 · Reglas B, C, D y E en una sola prueba de unidad:
 *  - B: `paymentAmountUsd` (pago a proveedor) sin tasa → null.
 *  - C: `amountToUsd` de Financiero China, con la cuenta exacta del conversor.
 *  - D: `toAmountUsd` de gastos, en centavos exactos y null sin tasa; el
 *    validador guarda el `amount_usd` redondeado.
 *  - E: «Gastos hoy» suma `amount_usd`, sin recalcular con 36 y 7,18 fijos.
 *
 * Decisión 1 de Sam (2026-10-19) y del Director (2026-10-20): VES y CNY
 * siempre con tasa, fallando cerrado; nunca 0 ni el monto tal cual.
 */

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sumarEnUsd } from "@/lib/shared/fx";
import { paymentAmountUsd } from "../accounting/supplier-payment-posting";
import { amountToUsd } from "../partner-finance/types";
import { CATEGORIES_BY_SCOPE, toAmountUsd, validateExpenseInput } from "../expense-types";
import { sumMyExpensesTodayUsd } from "../expense-queries";

describe("sumarEnUsd · mezcla de monedas y centavos", () => {
  it("suma las conversiones y separa los documentos sin tasa", () => {
    expect(sumarEnUsd([
      { amount: 100, currency: "USD" },
      { amount: 20, currency: "USDT" },
      { amount: 3600, currency: "VES", rate: 36 },
      { amount: 15.66, currency: "CNY", rate: 7.2 },
      { amount: 700, currency: "RMB", rate: 7 },
      { amount: 700, currency: "CNY", rate: null },
      { amount: 3600, currency: "VES", rate: 0 },
    ])).toEqual({ usd: 322.18, sinConvertir: 2 });
  });

  it("suma en centavos y conserva el redondeo simétrico del conversor", () => {
    expect(sumarEnUsd([
      { amount: "0.10", currency: "USD" },
      { amount: "0.20", currency: "USDT" },
      { amount: "15.66", currency: "CNY", rate: "7.2" },
      { amount: "-15.66", currency: "CNY", rate: "7.2" },
    ])).toEqual({ usd: 0.3, sinConvertir: 0 });
  });

  it("distingue cero convertido de documento sin tasa y no inventa un total nominal", () => {
    expect(sumarEnUsd([
      { amount: 0, currency: "USD" },
      { amount: 18000, currency: "VES", rate: null },
      { amount: 700, currency: "CNY" },
    ])).toEqual({ usd: 0, sinConvertir: 2 });
  });
});

describe("regla B · paymentAmountUsd", () => {
  it("USD y USDT 1:1; VES y CNY por su tasa; sin tasa, null", () => {
    expect(paymentAmountUsd(100, "USDT", null)).toBe(100);
    expect(paymentAmountUsd(18000, "VES", 36)).toBe(500);
    expect(paymentAmountUsd(15.66, "CNY", 7.2)).toBe(2.18);
    expect(paymentAmountUsd(18000, "VES", null)).toBeNull();
    expect(paymentAmountUsd(700, "CNY", 0)).toBeNull();
  });
});

describe("regla C · amountToUsd (Financiero China)", () => {
  it("RMB es CNY y usa la cuenta exacta (15,66 / 7,2 = 2,18, como to_usd)", () => {
    expect(amountToUsd({ amount: 15.66, currency: "RMB", fxRate: 7.2 })).toEqual({ ok: true, usd: 2.18 });
  });
  it("sin tasa falla cerrado, igual que antes", () => {
    expect(amountToUsd({ amount: 100, currency: "VES", fxRate: null })).toEqual({ ok: false, reason: "missing-fx-rate" });
  });
});

describe("regla D · gastos", () => {
  it("toAmountUsd: centavos exactos y null sin tasa (antes 0)", () => {
    expect(toAmountUsd(15.66, "CNY", 7.2)).toBe(2.18);
    expect(toAmountUsd(100, "USD", 1)).toBe(100);
    expect(toAmountUsd(100, "VES", 0)).toBeNull();
    expect(toAmountUsd(100, "VES", Number.NaN)).toBeNull();
  });

  const valido = {
    amount: 1000,
    currency: "VES" as const,
    fx_rate: 36.5,
    category: CATEGORIES_BY_SCOPE.external[0],
    scope: "external" as const,
    method: "cash" as const,
  };

  it("el validador guarda el amount_usd redondeado a centavos", () => {
    const r = validateExpenseInput(valido);
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.amount_usd).toBe(27.4); // 1000 / 36,5 = 27,3972…
  });

  it("sin tasa, error en fx_rate y no hay input", () => {
    const r = validateExpenseInput({ ...valido, fx_rate: undefined });
    expect(r.input).toBeUndefined();
    expect(r.fieldErrors?.fx_rate).toBeDefined();
  });
});

describe("regla E · «Gastos hoy» suma amount_usd", () => {
  it("lee amount_usd de cada gasto y no recalcula por moneda", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-21T03:59:59.999Z"));
      let columnas = "";
      const limites: [string, string, string][] = [];
      const stub = {
        from() {
          const chain: Record<string, unknown> = {
            select: (c: string) => {
              columnas = c;
              return chain;
            },
            is: () => chain,
            gte: (column: string, value: string) => {
              limites.push(["gte", column, value]);
              return chain;
            },
            lt: (column: string, value: string) => {
              limites.push(["lt", column, value]);
              return chain;
            },
            then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
              Promise.resolve({
                data: [{ amount_usd: "27.40" }, { amount_usd: 100 }, { amount_usd: null }],
                error: null,
              }).then(resolve),
          };
          return chain;
        },
      } as unknown as SupabaseClient;
      const r = await sumMyExpensesTodayUsd(stub);
      expect(columnas).toBe("amount_usd");
      expect(limites).toEqual([
        ["gte", "occurred_at", "2026-10-20T04:00:00.000Z"],
        ["lt", "occurred_at", "2026-10-21T04:00:00.000Z"],
      ]);
      expect(r).toEqual({ total: 127, count: 3 });
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Reparación #310, 2026-10-26: sólo documentos FICTICIOS, sin posting ni DB.
 * Los oráculos son decimales/enteros literales independientes del helper.
 */
describe("sumarEnUsd · agregación exacta y rango de salida", () => {
  const mensajeRango = "sumarEnUsd: total fuera de rango para conservar centavos";
  const usd = (amount: string) => Object.freeze({ amount, currency: "USD" });
  const bloque = Object.freeze(Array.from({ length: 90 }, () => usd("999999999999.00")));
  const prefijo = Object.freeze([...bloque, usd("70000000000.00")]);
  const ultimo = usd("1992547499.93");
  const fueraDeRango = Object.freeze([...prefijo, ultimo]);
  // 90 × 99_999_999_999_900 + 7_000_000_000_000 + 199_254_749_993.
  const centavosEsperados = BigInt("9007199254740993");
  const opuestos = Object.freeze(fueraDeRango.map((item) => usd("-" + item.amount)));
  const compensados = Object.freeze([...fueraDeRango, ...opuestos, usd("0.01")]);
  const bordeBase = Object.freeze(Array.from({ length: 70 }, () => usd("999999999999.00")));

  it("conserva 25.35 USD + 700.00 CNY / 7.00 + cero", () => {
    expect(sumarEnUsd([
      usd("25.35"),
      { amount: "700.00", currency: "CNY", rate: "7.00" },
      usd("0.00"),
    ])).toEqual({ usd: 125.35, sinConvertir: 0 });
  });

  it("rechaza el total exacto 2^53 + 1 centavos con RangeError específico", () => {
    expect(centavosEsperados).toBe(BigInt(2) ** BigInt(53) + BigInt(1));
    expect(BigInt(90) * BigInt("99999999999900") + BigInt("7000000000000") + BigInt("199254749993"))
      .toBe(centavosEsperados);
    expect(() => sumarEnUsd(fueraDeRango)).toThrowError(RangeError);
    expect(() => sumarEnUsd(fueraDeRango)).toThrowError(mensajeRango);
  });

  it("cada documento y el prefijo convierten; sólo una falta real de tasa se cuenta", () => {
    for (const item of fueraDeRango) {
      expect(sumarEnUsd([item]).sinConvertir).toBe(0);
    }
    expect(sumarEnUsd(prefijo)).toEqual({ usd: 90_069_999_999_910, sinConvertir: 0 });
    expect(sumarEnUsd([ultimo])).toEqual({ usd: 1_992_547_499.93, sinConvertir: 0 });
    expect(sumarEnUsd([...prefijo, { amount: "7.00", currency: "CNY", rate: null }]))
      .toEqual({ usd: 90_069_999_999_910, sinConvertir: 1 });
  });

  it.each([
    ["orden original", compensados, 0.01],
    ["orden inverso", [...compensados].reverse(), 0.01],
    ["signos opuestos", compensados.map((item) => usd(item.amount.startsWith("-") ? item.amount.slice(1) : "-" + item.amount)), -0.01],
  ] as const)("permite cancelación final exacta: %s", (_nombre, items, esperado) => {
    expect(sumarEnUsd(items)).toEqual({ usd: esperado, sinConvertir: 0 });
  });

  it.each([1, -1])("no toma como verdad un USD individual ya redondeado a number, signo %s", (signo) => {
    const positivo = { amount: signo === 1 ? "1" : "-1", currency: "CNY", rate: "0.000000000000000003" };
    const negativo = { amount: signo === 1 ? "-0.99999999999999999997" : "0.99999999999999999997", currency: "CNY", rate: "0.000000000000000003" };
    // Cada cociente se redondea por documento: quedan exactamente ±1 centavo.
    expect(sumarEnUsd([positivo, negativo])).toEqual({ usd: signo === 1 ? 0.01 : -0.01, sinConvertir: 0 });
    expect(sumarEnUsd([negativo, positivo])).toEqual({ usd: signo === 1 ? 0.01 : -0.01, sinConvertir: 0 });
  });

  it.each([
    ["positivo anterior", "368744177733.99", false, 70_368_744_177_663.99],
    ["positivo exacto", "368744177734.00", false, 70_368_744_177_664],
    ["negativo anterior", "368744177733.99", true, -70_368_744_177_663.99],
    ["negativo exacto", "368744177734.00", true, -70_368_744_177_664],
  ] as const)("conserva el borde de representación: %s", (_nombre, cola, negativo, esperado) => {
    const items = [...bordeBase, usd(cola)].map((item) => negativo ? usd("-" + item.amount) : item);
    expect(sumarEnUsd(items)).toEqual({ usd: esperado, sinConvertir: 0 });
  });

  it.each([false, true])("rechaza un centavo no representable tras el borde, negativo=%s", (negativo) => {
    const items = [...bordeBase, usd("368744177734.01")].map((item) => negativo ? usd("-" + item.amount) : item);
    expect(() => sumarEnUsd(items)).toThrowError(mensajeRango);
  });

  it("comprueba también dos decimales cuando el texto corto de number oculta pérdida", () => {
    const items = [...Array.from({ length: 1000 }, () => usd("999999999999.00")), usd("1000.10")];
    // Total exacto 1000000000000000.10: el double cercano se presenta a 2 decimales como .13.
    expect(() => sumarEnUsd(items)).toThrowError(mensajeRango);
  });

  it("no impone MAX_SAFE_INTEGER al acumulador de centavos si la salida sí es exacta", () => {
    const items = [...Array.from({ length: 100 }, () => usd("999999999999.00")), usd("100.00")];
    expect(sumarEnUsd(items)).toEqual({ usd: 100_000_000_000_000, sinConvertir: 0 });
  });

  it("acepta un iterable de una pasada sin mutar documentos, incluso al rechazar el total", () => {
    const antes = JSON.stringify(compensados);
    function* unaPasada() { yield* compensados; }
    expect(sumarEnUsd(unaPasada())).toEqual({ usd: 0.01, sinConvertir: 0 });
    expect(JSON.stringify(compensados)).toBe(antes);
    const antesFallo = JSON.stringify(fueraDeRango);
    expect(() => sumarEnUsd(fueraDeRango)).toThrowError(mensajeRango);
    expect(JSON.stringify(fueraDeRango)).toBe(antesFallo);
  });
});

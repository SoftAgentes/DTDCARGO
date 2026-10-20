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

import { describe, expect, it } from "vitest";
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
    let columnas = "";
    const stub = {
      from() {
        const chain: Record<string, unknown> = {
          select: (c: string) => {
            columnas = c;
            return chain;
          },
          is: () => chain,
          gte: () => chain,
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
    expect(r).toEqual({ total: 127, count: 3 });
  });
});

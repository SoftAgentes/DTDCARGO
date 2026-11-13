/**
 * SDD-0629 · El equivalente en Bs, solo vista. Montos y tasas inventados.
 */
import { describe, expect, it } from "vitest";
import { deUsdAMoneda } from "../fx";
import {
  equivalenteEnBs,
  etiquetaFuente,
  LEYENDA_BS_REFERENCIAL,
  textoEquivalenteBs,
  type TasaReferencial,
} from "../equivalente-bs";

const HOY = "2026-11-13";
const tasaHoy: TasaReferencial = { rate: 36.5, source: "bcv", validOn: HOY };
const tasaVieja: TasaReferencial = { rate: "35.25", source: "manual", validOn: "2026-11-10" };

describe("deUsdAMoneda · exacto, falla cerrado", () => {
  it("multiplica en decimal y redondea la mitad lejos de cero", () => {
    expect(deUsdAMoneda(100, 36.5)).toBe(3650);
    expect(deUsdAMoneda(15.66, 7.2)).toBe(112.75); // 112.752
    expect(deUsdAMoneda("0.1", "0.05")).toBe(0.01); // 0.005 → 0.01
    expect(deUsdAMoneda(-0.1, 0.05)).toBe(-0.01);
    expect(deUsdAMoneda(1.005, 1)).toBe(1.01); // en coma flotante daría 1.00
    expect(deUsdAMoneda(1234.56, "36.12345678")).toBe(44596.6);
  });
  it.each([
    [100, 0],
    [100, -1],
    [100, null],
    [100, "abc"],
    [100, Number.NaN],
    [null, 36.5],
    ["", 36.5],
    [Number.POSITIVE_INFINITY, 36.5],
    [1e12, 36.5],
  ])("monto %s con tasa %s → null, nunca 0", (usd, rate) => {
    expect(deUsdAMoneda(usd as number, rate as number)).toBeNull();
  });
});

describe("equivalenteEnBs", () => {
  it("con la tasa del día: monto, tasa, fuente y fecha, sin aviso", () => {
    const eq = equivalenteEnBs({ amount: 100, currency: "USD", tasa: tasaHoy, fechaPedida: HOY });
    expect(eq).toEqual({
      estado: "ok", bs: 3650, rate: 36.5, source: "bcv", validOn: HOY, fechaPedida: HOY, anterior: false,
    });
    const t = textoEquivalenteBs(eq)!;
    expect(t.monto).toBe("≈ Bs 3,650.00");
    expect(t.detalle).toBe("Tasa BCV 36.5000 Bs/USD del 2026-11-13");
    expect(t.aviso).toBeNull();
  });

  it("USDT es USD 1:1", () => {
    const eq = equivalenteEnBs({ amount: "10", currency: "usdt", tasa: tasaHoy, fechaPedida: HOY });
    expect(eq.estado === "ok" && eq.bs).toBe(365);
  });

  it("con una tasa vieja: la muestra con su fecha y avisa", () => {
    const eq = equivalenteEnBs({ amount: 100, currency: "USD", tasa: tasaVieja, fechaPedida: HOY });
    expect(eq.estado === "ok" && eq.anterior).toBe(true);
    const t = textoEquivalenteBs(eq)!;
    expect(t.monto).toBe("≈ Bs 3,525.00");
    expect(t.detalle).toBe("Tasa manual 35.2500 Bs/USD del 2026-11-10");
    expect(t.aviso).toBe("No hay tasa del 2026-11-13: es la última cargada, del 2026-11-10.");
  });

  it.each([
    ["sin tasa", null],
    ["tasa 0", { rate: 0, source: "bcv", validOn: HOY }],
    ["tasa negativa", { rate: -3, source: "bcv", validOn: HOY }],
    ["tasa de un día posterior", { rate: 40, source: "bcv", validOn: "2026-11-14" }],
    ["fecha de valor rota", { rate: 40, source: "bcv", validOn: "ayer" }],
  ])("%s → «tasa no disponible», nunca un cero", (_n, tasa) => {
    const eq = equivalenteEnBs({
      amount: 100,
      currency: "USD",
      tasa: tasa as TasaReferencial | null,
      fechaPedida: HOY,
    });
    expect(eq).toEqual({ estado: "sin-tasa", fechaPedida: HOY });
    const t = textoEquivalenteBs(eq)!;
    expect(t.monto).toBe("Bs: tasa no disponible");
    expect(`${t.monto} ${t.detalle}`).not.toMatch(/Bs 0|0\.00/);
    expect(t.aviso).toMatch(/Admin › Tasas/);
    expect(textoEquivalenteBs(eq, "portal")!.aviso).toBeNull();
  });

  it.each(["VES", "CNY", "RMB", "EUR", null])("moneda %s → no aplica", (currency) => {
    const eq = equivalenteEnBs({ amount: 100, currency, tasa: tasaHoy, fechaPedida: HOY });
    expect(eq).toEqual({ estado: "no-aplica" });
    expect(textoEquivalenteBs(eq)).toBeNull();
  });

  it("monto inválido → no aplica", () => {
    expect(equivalenteEnBs({ amount: null, currency: "USD", tasa: tasaHoy, fechaPedida: HOY }).estado).toBe("no-aplica");
    expect(equivalenteEnBs({ amount: "x", currency: "USD", tasa: tasaHoy, fechaPedida: HOY }).estado).toBe("no-aplica");
  });

  it("acepta una fecha pedida con hora", () => {
    const eq = equivalenteEnBs({ amount: 1, currency: "USD", tasa: tasaHoy, fechaPedida: `${HOY}T10:00:00Z` });
    expect(eq.estado === "ok" && eq.anterior).toBe(false);
  });

  it("fuentes y leyenda", () => {
    expect(etiquetaFuente("bcv")).toBe("BCV");
    expect(etiquetaFuente("operacion")).toBe("de operación");
    expect(LEYENDA_BS_REFERENCIAL).toMatch(/referencial/);
    expect(LEYENDA_BS_REFERENCIAL).toMatch(/USD/);
  });
});

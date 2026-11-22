// @vitest-environment node
/** SDD-0704 §7 · Tope, tarifa por modelo y plan fijo de la Oficina, con el entorno de respaldo. */
import { describe, expect, it } from "vitest";

import { aplicarCosto, esElModelo, interpretarCostoOficina } from "../costo";

const ENTORNO = { topeMensualUsd: 6, precios: { entradaPorMTok: 7, salidaPorMTok: 29 }, techoUsd: 15 };

const base = (o: Record<string, unknown> = {}) => ({
  version: 1,
  tope_usd: null,
  cuenta: { tipo_cobro: "por_token", tope_llamadas_mes: null },
  modelos: [],
  ...o,
});

describe("interpretarCostoOficina", () => {
  it("lee la forma de ia_costo_oficina()", () => {
    expect(
      interpretarCostoOficina(
        base({ tope_usd: "3.5", modelos: [{ proveedor: "anthropic", modelo: "claude-haiku-5-5", entrada: 1, salida: "5" }] }),
      ),
    ).toEqual({
      topeUsd: 3.5,
      cuenta: { tipoCobro: "por_token", topeLlamadasMes: null },
      modelos: [{ proveedor: "anthropic", modelo: "claude-haiku-5-5", entrada: 1, salida: 5 }],
    });
  });

  it("una forma inesperada vale null (manda el entorno)", () => {
    for (const malo of [null, undefined, "x", [], {}, { version: 2 }, base({ cuenta: { tipo_cobro: "plan_fijo", tope_llamadas_mes: null } })]) {
      expect(interpretarCostoOficina(malo), JSON.stringify(malo)).toBeNull();
    }
  });
});

describe("aplicarCosto: tope", () => {
  it("sin la 0570 o sin pantalla manda el entorno", () => {
    const c = aplicarCosto(null, ENTORNO, false);
    expect(c).toMatchObject({ topeMensualUsd: 6, origenTope: "entorno", conTokens: false, topeLlamadasMes: null });
  });

  it("el de la pantalla manda, recortado al techo", () => {
    expect(aplicarCosto(interpretarCostoOficina(base({ tope_usd: 2 })), ENTORNO, true)).toMatchObject({ topeMensualUsd: 2, origenTope: "pantalla" });
    expect(aplicarCosto(interpretarCostoOficina(base({ tope_usd: 40 })), ENTORNO, true).topeMensualUsd).toBe(15);
  });
});

describe("aplicarCosto: tarifa por modelo", () => {
  const modelos = [
    { proveedor: "anthropic", modelo: "claude-sonnet-5-5", entrada: 3, salida: 15 },
    { proveedor: "anthropic", modelo: "claude-haiku-5-5", entrada: 1, salida: 5 },
  ];
  const c = aplicarCosto(interpretarCostoOficina(base({ modelos })), ENTORNO, true);

  it("cobra con la tarifa del modelo que respondió, no con una global", () => {
    expect(c.precioDe("claude-haiku-5-5")).toEqual({ entradaPorMTok: 1, salidaPorMTok: 5 });
    expect(c.precioDe("anthropic/claude-sonnet-5-5")).toEqual({ entradaPorMTok: 3, salidaPorMTok: 15 });
  });

  it("si el modelo no consta o no está declarado, la más alta de la cuenta", () => {
    expect(c.precioDe(null)).toEqual({ entradaPorMTok: 3, salidaPorMTok: 15 });
    expect(c.precioDe("otro-modelo")).toEqual({ entradaPorMTok: 3, salidaPorMTok: 15 });
  });

  it("sin modelos declarados, la del entorno", () => {
    expect(aplicarCosto(interpretarCostoOficina(base()), ENTORNO, true).precioDe("claude-haiku-5-5")).toEqual(ENTORNO.precios);
  });

  it("plan fijo suma 0 USD y trae su tope de llamadas", () => {
    const pf = aplicarCosto(interpretarCostoOficina(base({ cuenta: { tipo_cobro: "plan_fijo", tope_llamadas_mes: 150 } })), ENTORNO, true);
    expect(pf.precioDe("claude-haiku-5-5")).toEqual({ entradaPorMTok: 0, salidaPorMTok: 0 });
    expect(pf.topeLlamadasMes).toBe(150);
  });
});

describe("esElModelo", () => {
  const d = { proveedor: "anthropic", modelo: "claude-haiku-5-5" };
  it("acepta el modelo solo o con su proveedor", () => {
    for (const u of ["claude-haiku-5-5", "anthropic/claude-haiku-5-5", " Anthropic/Claude-Haiku-5-5 ", "x/claude-haiku-5-5"]) {
      expect(esElModelo(d, u), u).toBe(true);
    }
  });
  it("no confunde modelos", () => {
    for (const u of [null, "", "claude-haiku-5", "claude-haiku-5-5-mini", "soporte-chatwoot"]) {
      expect(esElModelo(d, u), String(u)).toBe(false);
    }
  });
});

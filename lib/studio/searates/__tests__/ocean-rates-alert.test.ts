/**
 * Contrato del aviso de salud del refresco de fletes (SDD-0287).
 *
 * Por qué existe: el 24-ago-2026 el cron corrió, las 20 rutas volvieron en
 * `error` (SeaRates revocó el acceso) y nadie se enteró — `/fcl` se quedó mudo en
 * silencio. Estos casos fijan la regla de "esto hay que avisarlo" para que un
 * refactor no la vuelva a apagar.
 *
 * Se ancla en el CONTEO, no en la redacción: la única aserción sobre texto es que
 * el aviso nombre el impacto en el cliente y el código de error dominante, porque
 * un aviso que sólo dice "20 rutas en error" se lee como ruido y se ignora.
 */

import { describe, it, expect } from "vitest";
import {
  classifyRefreshHealth,
  dominantErrorCode,
  buildOceanRatesAlert,
} from "../ocean-rates-alert";

const SITE = "https://dtdcargo.com";

/** La corrida real del 24-ago-2026: 20 rutas, 20 en error, 0 tarifas. */
const CORRIDA_DEL_CORTE = {
  total: 20,
  ok: 0,
  no_rate: 0,
  error: 20,
  errorCodes: { graphql_error: 20 },
};

describe("classifyRefreshHealth", () => {
  it("el corte real (20/20 en error) es 'dead'", () => {
    expect(classifyRefreshHealth(CORRIDA_DEL_CORTE)).toBe("dead");
  });

  it("sin tarifas usables es 'dead' AUNQUE no haya errores de proveedor", () => {
    // Todo `no_rate`: SeaRates contestó bien pero no tiene oferta. Para el
    // cliente es idéntico — el cotizador no da precio. Por eso `dead` mira
    // `ok === 0` y no `error > 0`.
    expect(
      classifyRefreshHealth({ total: 20, ok: 0, no_rate: 20, error: 0 }),
    ).toBe("dead");
  });

  it("una corrida que no consultó nada es 'dead', no 'ok'", () => {
    expect(classifyRefreshHealth({ total: 0, ok: 0, no_rate: 0, error: 0 })).toBe(
      "dead",
    );
  });

  it("con algunas tarifas y algún error es 'degraded'", () => {
    expect(
      classifyRefreshHealth({ total: 20, ok: 18, no_rate: 0, error: 2 }),
    ).toBe("degraded");
  });

  it("'dead' le gana a 'degraded' cuando no quedó ninguna tarifa", () => {
    expect(
      classifyRefreshHealth({ total: 20, ok: 0, no_rate: 5, error: 15 }),
    ).toBe("dead");
  });

  it("todo resuelto sin errores es 'ok'", () => {
    expect(
      classifyRefreshHealth({ total: 20, ok: 17, no_rate: 3, error: 0 }),
    ).toBe("ok");
  });
});

describe("dominantErrorCode", () => {
  it("devuelve el más repetido con su conteo", () => {
    expect(dominantErrorCode({ graphql_error: 18, auth_failed: 2 })).toEqual({
      code: "graphql_error",
      count: 18,
    });
  });

  it("sin errores devuelve null", () => {
    expect(dominantErrorCode({})).toBeNull();
  });

  it("ignora códigos con conteo cero", () => {
    expect(dominantErrorCode({ graphql_error: 0 })).toBeNull();
  });

  it("desempata de forma determinista (alfabético), no por orden de inserción", () => {
    const a = dominantErrorCode({ zeta: 3, alfa: 3 });
    const b = dominantErrorCode({ alfa: 3, zeta: 3 });
    expect(a).toEqual(b);
    expect(a?.code).toBe("alfa");
  });
});

describe("buildOceanRatesAlert", () => {
  it("sana → NO arma mensaje (el caller no puede mandar de más)", () => {
    expect(
      buildOceanRatesAlert(
        { total: 20, ok: 20, no_rate: 0, error: 0 },
        "ok",
        SITE,
      ),
    ).toBeNull();
  });

  it("el corte real dice qué ve el CLIENTE y cuál fue el error dominante", () => {
    const alerta = buildOceanRatesAlert(CORRIDA_DEL_CORTE, "dead", SITE);
    expect(alerta).not.toBeNull();
    // El impacto en el cliente, que es lo que hace accionable el aviso.
    expect(alerta!.text).toContain("/fcl");
    // El código dominante, que separa "se cayó la red" de "nos revocaron".
    expect(alerta!.text).toContain("graphql_error");
    // Y el conteo, en el asunto, para verlo sin abrir el correo.
    expect(alerta!.subject).toContain("0/20");
  });

  it("degradada reporta cuántas rutas sobrevivieron", () => {
    const alerta = buildOceanRatesAlert(
      { total: 20, ok: 18, no_rate: 0, error: 2, errorCodes: { http_502: 2 } },
      "degraded",
      SITE,
    );
    expect(alerta!.subject).toContain("18/20");
    expect(alerta!.text).toContain("http_502");
  });

  it("sin códigos de error no inventa una causa", () => {
    const alerta = buildOceanRatesAlert(
      { total: 20, ok: 0, no_rate: 20, error: 0 },
      "dead",
      SITE,
    );
    expect(alerta!.text).toContain("sin oferta");
    expect(alerta!.text).not.toContain("Error dominante");
  });

  it("el enlace apunta a /studio/debug sin duplicar la barra", () => {
    const alerta = buildOceanRatesAlert(CORRIDA_DEL_CORTE, "dead", "https://dtdcargo.com/");
    expect(alerta!.text).toContain("https://dtdcargo.com/studio/debug");
  });
});

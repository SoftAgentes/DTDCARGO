/**
 * Tests del cliente SeaRates (SDD-0092 Fase 1 · benchmark interno de fletes).
 * API real = GraphQL: POST a `SEARATES_API_BASE` (= https://rates.searates.com/graphql)
 * con `{ query, variables }` y Bearer; auth aparte por GET a www.searates.com.
 *
 * Cubre:
 *   - validateSeaRatesInput: point IDs "P_<n>", modo, container (FCL exige).
 *   - getPlatformToken: mock / auth GET a www.searates.com / caché / HTTP error.
 *   - getOceanRate: mock_no_key / invalid_input / ok (data.rates) /
 *     graphql_error (errors[]) / http_<status> / auth_failed / network / no_rate.
 *   - CERO llamadas reales (global.fetch siempre stubeado).
 *
 * `searates-api.ts` importa `server-only`; vitest lo resuelve a un stub vacío vía
 * `resolve.alias` en vitest.config.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getPlatformToken,
  getOceanRate,
  __resetSeaRatesTokenCacheForTests,
} from "../searates-api";
import { validateSeaRatesInput } from "../searates-types";

const ENV_KEYS = ["SEARATES_API_BASE", "SEARATES_PLATFORM_ID", "SEARATES_API_KEY"] as const;
const saved: Record<string, string | undefined> = {};

/** Endpoint GraphQL de prueba (sin barra final). El cliente postea acá tal cual. */
const GRAPHQL_BASE = "https://rates.example.test/graphql";

function setEnv(present: boolean) {
  if (present) {
    process.env.SEARATES_API_BASE = GRAPHQL_BASE;
    process.env.SEARATES_PLATFORM_ID = "46314";
    process.env.SEARATES_API_KEY = "test-secret-key-1234567890";
  } else {
    for (const k of ENV_KEYS) delete process.env[k];
  }
}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  __resetSeaRatesTokenCacheForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// validateSeaRatesInput
// ─────────────────────────────────────────────────────────────
describe("validateSeaRatesInput", () => {
  it("FCL válido normaliza point IDs y modo a mayúsculas", () => {
    const r = validateSeaRatesInput({
      pointIdFrom: "p_27395",
      pointIdTo: "p_19774",
      shippingType: "fcl",
      container: "hc40",
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input).toEqual({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "HC40",
    });
  });

  it("FCL sin contenedor → fieldError container", () => {
    const r = validateSeaRatesInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
    });
    expect(r.input).toBeUndefined();
    expect(r.fieldErrors?.container).toBeTruthy();
  });

  it("FCL con contenedor no reconocido → fieldError container", () => {
    const r = validateSeaRatesInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "ZZ99",
    });
    expect(r.input).toBeUndefined();
    expect(r.fieldErrors?.container).toBeTruthy();
  });

  it("LCL no exige contenedor; acepta volumen/peso", () => {
    const r = validateSeaRatesInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "LCL",
      volumeM3: 3.4,
      weightKg: 1200,
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input).toMatchObject({ shippingType: "LCL", volumeM3: 3.4, weightKg: 1200 });
    expect(r.input).not.toHaveProperty("container");
  });

  it("point ID inválido → fieldError pointIdFrom", () => {
    const r = validateSeaRatesInput({
      pointIdFrom: "X",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.fieldErrors?.pointIdFrom).toBeTruthy();
  });

  it("modo inválido → fieldError shippingType", () => {
    const r = validateSeaRatesInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "AIR",
    });
    expect(r.fieldErrors?.shippingType).toBeTruthy();
  });

  it("volumen no-positivo → fieldError volumeM3", () => {
    const r = validateSeaRatesInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "LCL",
      volumeM3: 0,
    });
    expect(r.fieldErrors?.volumeM3).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// getPlatformToken
// ─────────────────────────────────────────────────────────────
describe("getPlatformToken", () => {
  it("sin envs → null SIN fetch (modo mock)", async () => {
    setEnv(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const token = await getPlatformToken();
    expect(token).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("con envs → arma el auth GET a www.searates.com y devuelve el token", async () => {
    setEnv(true);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "TKN-abc" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const token = await getPlatformToken();
    expect(token).toBe("TKN-abc");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain("https://www.searates.com/auth/platform-token");
    expect(url).toContain("id=46314");
    expect(url).toContain("api_key=test-secret-key-1234567890");
  });

  it("forma REAL de SeaRates: token en `s-token` (JWT) → lo extrae y cachea por su exp", async () => {
    setEnv(true);
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    // JWT con exp lejano: header.payload.sig (firma irrelevante, no se verifica).
    const jwt = `${b64({ typ: "JWT", alg: "HS256" })}.${b64({ platform: 46314, exp: 9_999_999_999 })}.sig`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ "s-token": jwt }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const t1 = await getPlatformToken();
    const t2 = await getPlatformToken();
    expect(t1).toBe(jwt);
    expect(t2).toBe(jwt); // exp lejano → cacheado, sin refetch
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("cachea el token: 2 llamadas → 1 sola request de auth", async () => {
    setEnv(true);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "TKN-cache" }), { status: 200 }),
    );
    const t1 = await getPlatformToken();
    const t2 = await getPlatformToken();
    expect(t1).toBe("TKN-cache");
    expect(t2).toBe("TKN-cache");
    expect(fetchSpy).toHaveBeenCalledOnce(); // 2ª usó la caché
  });

  it("auth HTTP error → null", async () => {
    setEnv(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
    expect(await getPlatformToken()).toBeNull();
  });

  it("auth devuelve body sin token → null", async () => {
    setEnv(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ foo: "bar" }), { status: 200 }),
    );
    expect(await getPlatformToken()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// getOceanRate
// ─────────────────────────────────────────────────────────────
describe("getOceanRate · mock mode", () => {
  it("sin envs → { ok:false, error:'mock_no_key' } SIN fetch", async () => {
    setEnv(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await getOceanRate({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r).toEqual({ ok: false, error: "mock_no_key" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("input inválido → { ok:false, error:'invalid_input' } SIN fetch", async () => {
    setEnv(true);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await getOceanRate({ pointIdFrom: "X", pointIdTo: "P_19774", shippingType: "FCL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_input");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("getOceanRate · con token (GraphQL)", () => {
  /**
   * Stub de 2 etapas: la 1ª llamada (auth GET) devuelve el token, la 2ª (rates
   * POST GraphQL) devuelve el envelope. Encadenamos con mockResolvedValueOnce.
   */
  function stubAuthThenRates(ratesResponse: Response) {
    return vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "TKN" }), { status: 200 }),
      )
      .mockResolvedValueOnce(ratesResponse);
  }

  it("FCL ok: elige la oferta más barata (general+points), carrier de points, raw + query inline", async () => {
    setEnv(true);
    const body = {
      data: {
        rates: [
          {
            general: {
              totalPrice: 7200,
              totalCurrency: "USD",
              totalTransitTime: 40,
              validityTo: "2026-08-01",
              spot: false,
              indicative: true,
              expired: false,
              individual: false,
              shipmentId: "A1",
            },
            points: [
              { provider: "MSC", shippingType: "FCL", totalPrice: 7200, totalCurrency: "USD" },
              { provider: null },
            ],
          },
          {
            general: {
              totalPrice: 6800,
              totalCurrency: "USD",
              totalTransitTime: 38,
              validityTo: "2026-08-01",
              spot: true,
              indicative: false,
              expired: false,
              individual: false,
              shipmentId: "A2",
            },
            points: [
              { provider: "COSCO", shippingType: "FCL", totalPrice: 6800, totalCurrency: "USD" },
              { provider: null },
            ],
          },
        ],
      },
    };
    const fetchSpy = stubAuthThenRates(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const r = await getOceanRate({
      pointIdFrom: "p_27395",
      pointIdTo: "p_19774",
      shippingType: "FCL",
      container: "HC40",
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mode).toBe("FCL");
      expect(r.rateUsd).toBe(6800); // la más barata de las 2 ofertas
      expect(r.currency).toBe("USD");
      expect(r.transitDays).toBe(38);
      expect(r.carrier).toBe("COSCO"); // provider del 1er point de la oferta barata
      expect(r.spot).toBe(true);
      expect(r.offersCount).toBe(2);
      expect(r.raw).toEqual(body); // raw crudo para auditar el mapeo en vivo
    }
    // 2 fetch: auth + rates POST GraphQL. Args INLINE en la query (sin variables).
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1]![0])).toBe(GRAPHQL_BASE);
    const init = fetchSpy.mock.calls[1]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TKN");
    const sent = JSON.parse(String(init.body));
    expect(sent.variables).toBeUndefined();
    expect(sent.query).toContain('pointIdFrom: "P_27395"');
    expect(sent.query).toContain('pointIdTo: "P_19774"');
    expect(sent.query).toContain("shippingType: FCL");
    expect(sent.query).toContain("container: HC40");
    expect(sent.query).toContain("includedServices: p2p");
    expect(sent.query).toContain("general");
    expect(sent.query).toContain("points");
  });

  it("LCL ok: arma volumen/peso inline (KG/M3), carrier de points, no manda contenedor", async () => {
    setEnv(true);
    const body = {
      data: {
        rates: [
          {
            general: { totalPrice: 1738, totalCurrency: "USD", totalTransitTime: 5 },
            points: [{ provider: "ANL", shippingType: "LCL" }, { provider: null }],
          },
        ],
      },
    };
    const fetchSpy = stubAuthThenRates(new Response(JSON.stringify(body), { status: 200 }));
    const r = await getOceanRate({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "LCL",
      volumeM3: 3.4,
      weightKg: 1200,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mode).toBe("LCL");
      expect(r.rateUsd).toBe(1738);
      expect(r.transitDays).toBe(5);
      expect(r.carrier).toBe("ANL");
      expect(r.offersCount).toBe(1);
    }
    const init = fetchSpy.mock.calls[1]![1] as RequestInit;
    const sent = JSON.parse(String(init.body));
    expect(sent.query).toContain("volume: 3.4");
    expect(sent.query).toContain("volumeUnit: M3");
    expect(sent.query).toContain("weight: 1200");
    expect(sent.query).toContain("weightUnit: KG");
    expect(sent.query).not.toContain("container:"); // LCL no manda contenedor
  });

  it("GraphQL errors[] → { ok:false, error:'graphql_error', code } + raw", async () => {
    setEnv(true);
    const body = { errors: [{ message: "Variable invalid" }] };
    stubAuthThenRates(new Response(JSON.stringify(body), { status: 200 }));
    const r = await getOceanRate({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("graphql_error");
      expect(r.code).toBe("Variable invalid");
      expect(r.raw).toEqual(body);
    }
  });

  it("rates HTTP error → { ok:false, error:'http_500', code } ", async () => {
    setEnv(true);
    stubAuthThenRates(new Response(JSON.stringify({ message: "boom" }), { status: 500 }));
    const r = await getOceanRate({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("http_500");
      expect(r.code).toBe("boom");
    }
  });

  it("2xx sin tarifa parseable → { ok:false, error:'no_rate' } + raw", async () => {
    setEnv(true);
    const body = { data: { rates: [] } };
    stubAuthThenRates(new Response(JSON.stringify(body), { status: 200 }));
    const r = await getOceanRate({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("no_rate");
      expect(r.raw).toEqual(body);
    }
  });

  it("auth falla → { ok:false, error:'auth_failed' } sin pegar a rates", async () => {
    setEnv(true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("denied", { status: 403 }));
    const r = await getOceanRate({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("auth_failed");
    expect(fetchSpy).toHaveBeenCalledOnce(); // solo el intento de auth, nunca rates
  });

  it("red caída en rates → { ok:false, error: 'network: ...' }", async () => {
    setEnv(true);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "TKN" }), { status: 200 }))
      .mockRejectedValueOnce(new Error("ECONNRESET"));
    const r = await getOceanRate({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^network:/);
  });
});

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  refreshOceanRates,
  mapRateToRow,
  WEEKLY_CALL_CAP,
  type RateFetcher,
} from "../ocean-rates-queries";
import { OCEAN_RATES_MATRIX, type OceanMatrixRoute } from "../ocean-rates-matrix";
import type { SeaRatesRate } from "../searates-types";

const ROUTE_A: OceanMatrixRoute = {
  fromId: "nansha",
  toId: "la-guaira",
  coordsFrom: [22.76, 113.62],
  coordsTo: [10.6, -66.93],
  shippingType: "FCL",
  container: "HC40",
};
const ROUTE_B: OceanMatrixRoute = {
  fromId: "shekou",
  toId: "puerto-cabello",
  coordsFrom: [22.48, 113.9],
  coordsTo: [10.48, -68.01],
  shippingType: "FCL",
  container: "HC40",
};

const OK_RATE: SeaRatesRate = {
  ok: true,
  mode: "FCL",
  rateUsd: 1738,
  currency: "USD",
  transitDays: 5,
  carrier: "ANL",
  validityTo: "2026-07-01",
  spot: false,
  indicative: true,
  expired: false,
  offersCount: 2,
  raw: null,
};

// Tipado explícito como SeaRatesRate → el ternario no ensancha `ok` a boolean.
const NO_RATE: SeaRatesRate = { ok: false, error: "no_rate" };

function fakeAdmin() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { from } as unknown as SupabaseClient, from, upsert };
}

describe("mapRateToRow", () => {
  it("ok → status 'ok' + campos de tarifa; clave de caché = fromId/toId (slug)", () => {
    const row = mapRateToRow(ROUTE_A, OK_RATE, "T");
    expect(row).toMatchObject({
      point_from: "nansha",
      point_to: "la-guaira",
      shipping_type: "FCL",
      container: "HC40",
      status: "ok",
      rate_usd: 1738,
      carrier: "ANL",
      offers_count: 2,
      error_code: null,
      fetched_at: "T",
    });
  });

  it("no_rate → status 'no_rate' sin error_code", () => {
    const row = mapRateToRow(ROUTE_B, { ok: false, error: "no_rate" }, "T");
    expect(row.status).toBe("no_rate");
    expect(row.error_code).toBeNull();
    expect(row.container).toBe("HC40");
    expect(row.rate_usd).toBeNull();
  });

  it("otro error → status 'error' + error_code", () => {
    const row = mapRateToRow(ROUTE_B, { ok: false, error: "auth_failed" }, "T");
    expect(row.status).toBe("error");
    expect(row.error_code).toBe("auth_failed");
  });
});

describe("refreshOceanRates", () => {
  it("consulta cada ruta por COORDENADAS, mapea y hace upsert en bloque + summary", async () => {
    const { client, from, upsert } = fakeAdmin();
    // OK para Nansha (lat 22.76), no_rate para el resto.
    const fetchRate: RateFetcher = vi.fn(async (input) =>
      input.coordsFrom?.[0] === 22.76 ? OK_RATE : NO_RATE,
    );

    const summary = await refreshOceanRates(client, {
      fetchRate,
      matrix: [ROUTE_A, ROUTE_B],
    });

    expect(fetchRate).toHaveBeenCalledTimes(2);
    // El fetcher recibe COORDS (no pointId).
    expect(fetchRate).toHaveBeenCalledWith(
      expect.objectContaining({ coordsFrom: [22.76, 113.62], coordsTo: [10.6, -66.93] }),
    );
    expect(from).toHaveBeenCalledWith("ocean_rates");
    expect(upsert).toHaveBeenCalledOnce();
    const [rows, opts] = upsert.mock.calls[0] as [unknown[], { onConflict: string }];
    expect(rows).toHaveLength(2);
    expect(opts.onConflict).toBe("point_from,point_to,shipping_type,container");
    expect(summary).toMatchObject({ total: 2, ok: 1, no_rate: 1, error: 0, upserted: true });
  });

  it("una ruta que tira → fila 'error', no aborta el resto", async () => {
    const { client, upsert } = fakeAdmin();
    const fetchRate: RateFetcher = vi.fn(async () => {
      throw new Error("boom");
    });
    const summary = await refreshOceanRates(client, { fetchRate, matrix: [ROUTE_A] });
    expect(summary.error).toBe(1);
    const [rows] = upsert.mock.calls[0] as [Array<{ status: string; error_code: string | null }>];
    expect(rows[0]!.status).toBe("error");
    expect(rows[0]!.error_code).toContain("network:");
  });

  it("cuenta los error_code por tipo — la firma que delata un corte de acceso", async () => {
    const { client } = fakeAdmin();
    // La forma EXACTA del corte del 24-ago-2026: SeaRates revocó el acceso y las
    // 20 rutas volvieron `graphql_error`. Sin este conteo el aviso sólo puede
    // decir "fallaron 20", que no distingue una caída de red de una revocación.
    const fetchRate: RateFetcher = vi.fn(
      async () =>
        ({ ok: false, error: "graphql_error", code: "Access Denied" }) as SeaRatesRate,
    );

    const summary = await refreshOceanRates(client, {
      fetchRate,
      matrix: [ROUTE_A, ROUTE_B],
    });

    expect(summary.error).toBe(2);
    expect(summary.errorCodes).toEqual({ graphql_error: 2 });
  });

  it("no_rate NO ensucia el conteo de códigos de error", async () => {
    const { client } = fakeAdmin();
    const fetchRate: RateFetcher = vi.fn(async () => NO_RATE);
    const summary = await refreshOceanRates(client, { fetchRate, matrix: [ROUTE_A] });
    expect(summary.no_rate).toBe(1);
    expect(summary.errorCodes).toEqual({});
  });

  it("upsert falla → upserted false + errorMessage", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const from = vi.fn().mockReturnValue({ upsert });
    const fetchRate: RateFetcher = vi.fn(async () => NO_RATE);
    const summary = await refreshOceanRates({ from } as unknown as SupabaseClient, {
      fetchRate,
      matrix: [ROUTE_A],
    });
    expect(summary.upserted).toBe(false);
    expect(summary.errorMessage).toBe("db down");
  });

  it("cap explícito: corta la matriz a `cap` y marca capped", async () => {
    const { client, upsert } = fakeAdmin();
    const fetchRate: RateFetcher = vi.fn(async () => NO_RATE);
    const summary = await refreshOceanRates(client, {
      fetchRate,
      matrix: [ROUTE_A, ROUTE_B, ROUTE_A],
      cap: 2,
    });
    expect(fetchRate).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ requested: 3, total: 2, capped: true });
    const [rows] = upsert.mock.calls[0] as [unknown[]];
    expect(rows).toHaveLength(2);
  });

  it("sin cap explícito aplica WEEKLY_CALL_CAP", async () => {
    const { client } = fakeAdmin();
    const fetchRate: RateFetcher = vi.fn(async () => NO_RATE);
    const big = Array.from({ length: 25 }, () => ROUTE_B);
    const summary = await refreshOceanRates(client, { fetchRate, matrix: big });
    expect(fetchRate).toHaveBeenCalledTimes(WEEKLY_CALL_CAP);
    expect(summary).toMatchObject({ requested: 25, total: WEEKLY_CALL_CAP, capped: true });
  });

  it("la matriz de producción entra ENTERA en el cap — ninguna ruta se cae", async () => {
    // Desde que se quitó Qingdao (2026-08-13) la grilla es 4×5 = 20 = cap, así que
    // el cron no recorta nada y el cotizador no tiene rutas mudas. Se afirma la
    // propiedad, no un `min()`: con `min()` este test pasaba igual si la matriz
    // creciera y empezara a perder rutas en silencio.
    const { client } = fakeAdmin();
    const fetchRate: RateFetcher = vi.fn(async () => NO_RATE);
    const summary = await refreshOceanRates(client, { fetchRate });
    expect(OCEAN_RATES_MATRIX.length).toBeLessThanOrEqual(WEEKLY_CALL_CAP);
    expect(fetchRate).toHaveBeenCalledTimes(OCEAN_RATES_MATRIX.length);
    expect(summary).toMatchObject({ requested: OCEAN_RATES_MATRIX.length, capped: false });
  });

  it("el cap mantiene el consumo bajo las 100 llamadas/mes gratis de SeaRates", () => {
    // 5 lunes es el peor mes. Si alguien sube el cap o suma puertos, esto avisa
    // ANTES de que la factura o el corte de cuota lo hagan.
    expect(WEEKLY_CALL_CAP * 5).toBeLessThanOrEqual(100);
  });
});

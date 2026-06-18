import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  refreshOceanRates,
  mapRateToRow,
  type RateFetcher,
} from "../ocean-rates-queries";
import type { OceanMatrixRoute } from "../ocean-rates-matrix";
import type { SeaRatesRate } from "../searates-types";

const ROUTE_LCL: OceanMatrixRoute = {
  pointIdFrom: "P_27395",
  pointIdTo: "P_19774",
  shippingType: "LCL",
  volumeM3: 1,
  weightKg: 250,
};
const ROUTE_FCL: OceanMatrixRoute = {
  pointIdFrom: "P_27395",
  pointIdTo: "P_19792",
  shippingType: "FCL",
  container: "HC40",
};

const OK_RATE: SeaRatesRate = {
  ok: true,
  mode: "LCL",
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
  it("ok → status 'ok' + campos de tarifa", () => {
    const row = mapRateToRow(ROUTE_LCL, OK_RATE, "T");
    expect(row).toMatchObject({
      point_from: "P_27395",
      point_to: "P_19774",
      shipping_type: "LCL",
      container: "",
      status: "ok",
      rate_usd: 1738,
      carrier: "ANL",
      offers_count: 2,
      error_code: null,
      fetched_at: "T",
    });
  });

  it("no_rate → status 'no_rate' sin error_code; container del FCL", () => {
    const row = mapRateToRow(ROUTE_FCL, { ok: false, error: "no_rate" }, "T");
    expect(row.status).toBe("no_rate");
    expect(row.error_code).toBeNull();
    expect(row.container).toBe("HC40");
    expect(row.rate_usd).toBeNull();
  });

  it("otro error → status 'error' + error_code", () => {
    const row = mapRateToRow(ROUTE_FCL, { ok: false, error: "auth_failed" }, "T");
    expect(row.status).toBe("error");
    expect(row.error_code).toBe("auth_failed");
  });
});

describe("refreshOceanRates", () => {
  it("consulta cada ruta, mapea y hace upsert en bloque + summary", async () => {
    const { client, from, upsert } = fakeAdmin();
    const fetchRate: RateFetcher = vi.fn(async (input) =>
      input.shippingType === "LCL" ? OK_RATE : NO_RATE,
    );

    const summary = await refreshOceanRates(client, {
      fetchRate,
      matrix: [ROUTE_LCL, ROUTE_FCL],
    });

    expect(fetchRate).toHaveBeenCalledTimes(2);
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
    const summary = await refreshOceanRates(client, { fetchRate, matrix: [ROUTE_LCL] });
    expect(summary.error).toBe(1);
    const [rows] = upsert.mock.calls[0] as [Array<{ status: string; error_code: string | null }>];
    expect(rows[0]!.status).toBe("error");
    expect(rows[0]!.error_code).toContain("network:");
  });

  it("upsert falla → upserted false + errorMessage", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const from = vi.fn().mockReturnValue({ upsert });
    const fetchRate: RateFetcher = vi.fn(async () => NO_RATE);
    const summary = await refreshOceanRates({ from } as unknown as SupabaseClient, {
      fetchRate,
      matrix: [ROUTE_LCL],
    });
    expect(summary.upserted).toBe(false);
    expect(summary.errorMessage).toBe("db down");
  });
});

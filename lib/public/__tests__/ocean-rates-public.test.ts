import { describe, it, expect, vi, afterEach } from "vitest";

import * as anon from "../supabase-anon";
import { getPublicOceanRate } from "../ocean-rates-public";
import type { OceanRouteInput } from "@/lib/shared/ocean-rate";

const INPUT: OceanRouteInput = {
  pointIdFrom: "P_27395",
  pointIdTo: "P_19774",
  shippingType: "LCL",
};

/** Stub del cliente anon: solo necesitamos `.rpc()`. */
function stubRpc(impl: (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>) {
  const rpc = vi.fn(impl);
  vi.spyOn(anon, "getAnonClient").mockReturnValue({ rpc } as never);
  return rpc;
}

afterEach(() => vi.restoreAllMocks());

describe("getPublicOceanRate", () => {
  it("fila cacheada (numeric como string) → mapeada a número", async () => {
    // valid_to lejano en el futuro → vigente (si estuviera vencida, el status se
    // degradaría a 'no_rate'; ver el test de vigencia más abajo).
    const rpc = stubRpc(async () => ({
      data: [
        {
          rate_usd: "1738.00",
          currency: "USD",
          transit_days: 5,
          carrier: "ANL",
          offers_count: 2,
          valid_to: "2099-12-31",
          indicative: true,
          spot: false,
          status: "ok",
          fetched_at: "2026-06-17T00:00:00Z",
        },
      ],
      error: null,
    }));

    const r = await getPublicOceanRate(INPUT);
    expect(r).toMatchObject({
      rateUsd: 1738,
      currency: "USD",
      transitDays: 5,
      carrier: "ANL",
      offersCount: 2,
      status: "ok",
    });
    // Manda los args correctos a la RPC (container '' para LCL).
    expect(rpc).toHaveBeenCalledWith("public_ocean_rate", {
      p_from: "P_27395",
      p_to: "P_19774",
      p_type: "LCL",
      p_container: "",
    });
  });

  it("fila cacheada VENCIDA (valid_to en el pasado) → status degradado a no_rate", async () => {
    // El cron dejó de refrescar y la caché quedó vieja: no servir el precio como
    // firme. El API route trata status!=='ok' como "no disponible".
    stubRpc(async () => ({
      data: [
        {
          rate_usd: "1738.00",
          currency: "USD",
          transit_days: 5,
          carrier: "ANL",
          offers_count: 2,
          valid_to: "2020-01-01",
          indicative: true,
          spot: false,
          status: "ok",
          fetched_at: "2019-12-01T00:00:00Z",
        },
      ],
      error: null,
    }));

    const r = await getPublicOceanRate(INPUT);
    expect(r?.status).toBe("no_rate");
  });

  it("sin fila cacheada → null", async () => {
    stubRpc(async () => ({ data: [], error: null }));
    expect(await getPublicOceanRate(INPUT)).toBeNull();
  });

  it("RPC error → null (nunca tira)", async () => {
    stubRpc(async () => ({ data: null, error: { message: "boom" } }));
    expect(await getPublicOceanRate(INPUT)).toBeNull();
  });

  it("getAnonClient tira (env faltante) → null", async () => {
    vi.spyOn(anon, "getAnonClient").mockImplementation(() => {
      throw new Error("no env");
    });
    expect(await getPublicOceanRate(INPUT)).toBeNull();
  });
});

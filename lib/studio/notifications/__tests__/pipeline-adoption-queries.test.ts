/**
 * Motor de Crecimiento · F2-T04 — adopción del pipeline de captura CN.
 * FUND-S3-01: % recepciones escaneadas (prealerta_id) vs tipeadas.
 */
import { describe, it, expect } from "vitest";
import {
  computePipelineAdoption,
  getPipelineAdoption,
} from "../pipeline-adoption-queries";

describe("computePipelineAdoption", () => {
  it("calcula %, escaneadas y tipeadas", () => {
    expect(computePipelineAdoption({ total: 7, scanned: 1 })).toEqual({
      total: 7,
      scanned: 1,
      typed: 6,
      adoptionPct: 14, // 1/7 = 14,28 → 14
    });
  });

  it("sin recepciones → todo 0, sin dividir por cero", () => {
    expect(computePipelineAdoption({ total: 0, scanned: 0 })).toEqual({
      total: 0,
      scanned: 0,
      typed: 0,
      adoptionPct: 0,
    });
  });

  it("100% adopción cuando todas escaneadas", () => {
    expect(computePipelineAdoption({ total: 4, scanned: 4 })).toMatchObject({
      typed: 0,
      adoptionPct: 100,
    });
  });

  it("satura escaneadas al total y trunca negativos", () => {
    expect(computePipelineAdoption({ total: 3, scanned: 9 })).toMatchObject({
      scanned: 3,
      typed: 0,
      adoptionPct: 100,
    });
    expect(computePipelineAdoption({ total: -5, scanned: -2 })).toEqual({
      total: 0,
      scanned: 0,
      typed: 0,
      adoptionPct: 0,
    });
  });
});

/** Mock: la query de total no llama `.not`; la de escaneadas sí. */
function makeSupabase(total: number, scanned: number, error: unknown = null) {
  return {
    from: () => ({
      select: () => {
        const state = { hasNot: false };
        const chain: Record<string, unknown> = {
          eq: () => chain,
          is: () => chain,
          not: () => {
            state.hasNot = true;
            return chain;
          },
          then: (resolve: (v: unknown) => void) =>
            resolve({
              count: error ? null : state.hasNot ? scanned : total,
              error,
            }),
        };
        return chain;
      },
    }),
  } as never;
}

describe("getPipelineAdoption", () => {
  it("arma el manómetro desde los head-counts", async () => {
    const res = await getPipelineAdoption(makeSupabase(7, 1), "t-1");
    expect(res).toEqual({ total: 7, scanned: 1, typed: 6, adoptionPct: 14 });
  });

  it("falla-seguro: ante error → ceros", async () => {
    const res = await getPipelineAdoption(
      makeSupabase(7, 1, { message: "boom" }),
      "t-1",
    );
    expect(res).toEqual({ total: 0, scanned: 0, typed: 0, adoptionPct: 0 });
  });
});

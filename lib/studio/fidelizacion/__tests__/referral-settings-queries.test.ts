/**
 * Tests de getReferralSettings (SDD-0159): parsea la fila o cae al fallback
 * $80/$60, y scopea por tenantId cuando se le pasa (ruta del portal).
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReferralSettings } from "../referral-settings-queries";

function stub(row: Record<string, unknown> | null, error: unknown = null) {
  const calls: { eqTenant?: string } = {};
  const b: Record<string, unknown> = {};
  Object.assign(b, {
    select: () => b,
    eq: (_col: string, val: string) => {
      calls.eqTenant = val;
      return b;
    },
    maybeSingle: () => Promise.resolve({ data: row, error }),
  });
  const client = { from: () => b } as unknown as SupabaseClient;
  return { client, calls };
}

describe("getReferralSettings", () => {
  it("devuelve los montos de la fila (numeric string → number)", async () => {
    const { client } = stub({
      referrer_reward_usd: "120.00",
      referred_reward_usd: "40.00",
    });
    const s = await getReferralSettings(client);
    expect(s).toEqual({ referrerRewardUsd: 120, referredRewardUsd: 40 });
  });

  it("cae al fallback $80/$60 cuando no hay fila", async () => {
    const { client } = stub(null);
    const s = await getReferralSettings(client);
    expect(s).toEqual({ referrerRewardUsd: 80, referredRewardUsd: 60 });
  });

  it("cae al fallback ante un error de la query", async () => {
    const { client } = stub(null, { message: "boom" });
    const s = await getReferralSettings(client);
    expect(s).toEqual({ referrerRewardUsd: 80, referredRewardUsd: 60 });
  });

  it("scopea por tenantId cuando se pasa (ruta del portal, sin RLS)", async () => {
    const { client, calls } = stub({
      referrer_reward_usd: 80,
      referred_reward_usd: 60,
    });
    await getReferralSettings(client, "tenant-xyz");
    expect(calls.eqTenant).toBe("tenant-xyz");
  });

  it("no scopea cuando se omite el tenantId (Studio, RLS)", async () => {
    const { client, calls } = stub(null);
    await getReferralSettings(client);
    expect(calls.eqTenant).toBeUndefined();
  });
});

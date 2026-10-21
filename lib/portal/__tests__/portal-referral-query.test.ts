import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getMyReferralProgram } from "../portal-referral-queries";

function dbWithRpc(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    markbox: "DTD-1004",
    billed_usd: 60000,
    billing_v2: { version: 2, subtotal_usd: "60000.00", sin_tasa_count: 0, conversion_state: "completo" },
    referrer_reward_usd: 80,
    referred_reward_usd: 60,
    referrals: [],
    ...overrides,
  };
}

describe("getMyReferralProgram por principal", () => {
  it("v2 conserva subtotal y contador sin certificar el nivel legado", async () => {
    const { db } = dbWithRpc(row({ billing_v2: { version: 2, subtotal_usd: "100.00", sin_tasa_count: 1, conversion_state: "sin_tasa" } }));
    const program = await getMyReferralProgram(db);
    expect(program).toMatchObject({ billing: { state: "sin_tasa", subtotalUsd: "100.00", sinTasaCount: 1 }, tier: null });
  });

  it("distingue fallo RPC de ausencia de principal", async () => {
    const { db } = dbWithRpc(null, { message: "detalle interno no publicable" });
    await expect(getMyReferralProgram(db)).rejects.toThrow("Facturación anual no disponible");
  });

  it("consulta la RPC sin enviar markbox ni ids", async () => {
    const { db, rpc } = dbWithRpc(row());
    const program = await getMyReferralProgram(db);

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_portal_referral_program");
    expect(program).toMatchObject({
      shareCode: "REF-1004",
      billedUsd: 60000,
      referredReward: 60,
      referrerReward: 80,
    });
  });

  it("mantiene niveles y créditos sobre el snapshot mínimo", async () => {
    const { db } = dbWithRpc(
      row({
        referrals: [
          { id: "a", referred_name: "Ana", status: "acreditado", reward_usd: 80, created_at: "2026-05-18" },
          { id: "b", referred_name: "Luis", status: "aplicado", reward_usd: 80, created_at: "2026-05-17" },
          { id: "c", referred_name: "Rosa", status: "registrado", reward_usd: 0, created_at: "2026-05-16" },
          { id: "d", referred_name: "Pablo", status: "invitado", reward_usd: 0, created_at: "2026-05-15" },
        ],
      }),
    );

    const program = await getMyReferralProgram(db);
    expect(program?.tier?.tier.id).toBe("silver");
    expect(program?.tier?.next?.id).toBe("gold");
    expect(program?.creditsEarnedUsd).toBe(160);
    expect(program?.pendingCreditsUsd).toBe(80);
    expect(program?.referrals[0]).toMatchObject({
      id: "a",
      referredName: "Ana",
      status: "acreditado",
      rewardUsd: 80,
    });
  });

  it("solo NULL real representa ausencia de principal", async () => {
    const { db } = dbWithRpc(null);
    await expect(getMyReferralProgram(db)).resolves.toBeNull();
  });

  it.each([[], {}, { markbox: "" }, { markbox: "  " }, undefined, false, true, 0, 42, "DTD-1004", [row()], { markbox: 1004 }, { markbox: true }, { markbox: [] }, { markbox: {} }].map((data) => ({ data })))("rechaza shape no nulo $data sin confundirlo con ausencia", async ({ data }) => {
    const { db } = dbWithRpc(data);
    await expect(getMyReferralProgram(db)).rejects.toMatchObject({ name: "AnnualBillingError", reason: "shape", message: "Facturación anual no disponible" });
  });

  it.each([undefined, {}, { version: 1 }, { version: 2, subtotal_usd: 100, sin_tasa_count: 0, conversion_state: "completo" }])("principal válido con v2 inválida conserva normalización, créditos y referidos", async (billing_v2) => {
    const { db } = dbWithRpc(row({ markbox: " dtd-1004 ", billing_v2, referrals: [{ id: "r", referred_name: "Sintético", status: "acreditado", reward_usd: 80 }] }));
    const program = await getMyReferralProgram(db);
    expect(program).toMatchObject({ shareCode: "REF-1004", tier: null, billedUsd: null, billing: { state: "no_disponible" }, creditsEarnedUsd: 80, referrerReward: 80, referredReward: 60 });
    expect(program?.referrals).toHaveLength(1);
  });
});

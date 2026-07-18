/**
 * Tests del Programa de Referidos del portal (cara cliente de SDD-0051).
 *
 *  - `getMyReferralProgram`: deriva el código REF-XXXX, el nivel (de la
 *    facturación trailing-12m USD), los créditos (espejo de creditsEarned/
 *    pendingCredits) y mapea los referidos. Todo scopeado por markbox.
 *  - Cubre normalización USD (VES por fx_rate, CNY omitido) y la ventana de 12m.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyReferralProgram } from "../portal-referral-queries";

/**
 * Stub del admin client. `from(invoices|referrals)` → listas (terminan en
 * `.limit()`); `from(clients|referral_settings)` → fila única (`.maybeSingle()`).
 * SDD-0159: getMyReferralProgram resuelve el tenant por `clients` y lee los
 * montos de `referral_settings` (fallback $80/$60 sin fila).
 */
function stub(opts: {
  invoices?: Record<string, unknown>[];
  referrals?: Record<string, unknown>[];
  clientTenantId?: string;
  settings?: { referrer_reward_usd: number; referred_reward_usd: number } | null;
}): { admin: SupabaseClient; touched: () => string[] } {
  const touched: string[] = [];
  function builder(result: {
    listRows?: Record<string, unknown>[];
    single?: Record<string, unknown> | null;
  }) {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      is: () => b,
      order: () => b,
      limit: () => Promise.resolve({ data: result.listRows ?? [], error: null }),
      maybeSingle: () =>
        Promise.resolve({ data: result.single ?? null, error: null }),
    });
    return b;
  }
  const admin = {
    from: (table: string) => {
      touched.push(table);
      if (table === "invoices") return builder({ listRows: opts.invoices ?? [] });
      if (table === "referrals")
        return builder({ listRows: opts.referrals ?? [] });
      if (table === "clients")
        return builder({
          single: opts.clientTenantId
            ? { tenant_id: opts.clientTenantId }
            : null,
        });
      if (table === "referral_settings")
        return builder({ single: opts.settings ?? null });
      return builder({});
    },
  } as unknown as SupabaseClient;
  return { admin, touched: () => touched };
}

const NOW = new Date("2026-06-13T12:00:00.000Z");

function inv(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    currency: "USD",
    total_amount: 10000,
    fx_rate: null,
    status: "emitida",
    issued_at: "2026-05-01",
    created_at: "2026-05-01T00:00:00.000Z",
    ...over,
  };
}
function ref(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "r1",
    referred_name: "Jorge Calderón",
    referred_company: "Calderón Industrial",
    status: "registrado",
    reward_usd: 0,
    created_at: "2026-05-18T00:00:00.000Z",
    ...over,
  };
}

describe("getMyReferralProgram", () => {
  it("deriva shareCode del markbox (REF- sin DTD-) y normaliza a mayúsculas", async () => {
    const { admin } = stub({});
    const p = await getMyReferralProgram(admin, "dtd-1004", NOW);
    expect(p.shareCode).toBe("REF-1004");
  });

  it("deriva el nivel de la facturación trailing-12m USD", async () => {
    const { admin } = stub({ invoices: [inv({ total_amount: 60000 })] });
    const p = await getMyReferralProgram(admin, "DTD-1004", NOW);
    expect(p.billedUsd).toBe(60000);
    expect(p.tier.tier.id).toBe("silver");
    expect(p.tier.next?.id).toBe("gold");
    expect(p.tier.toNext).toBe(90000);
  });

  it("sin facturación → Bronze", async () => {
    const { admin } = stub({});
    const p = await getMyReferralProgram(admin, "DTD-1004", NOW);
    expect(p.billedUsd).toBe(0);
    expect(p.tier.tier.id).toBe("bronze");
  });

  it("excluye facturas borrador y fuera de la ventana trailing-12m", async () => {
    const { admin } = stub({
      invoices: [
        inv({ total_amount: 10000, status: "borrador" }), // no billable
        inv({ total_amount: 5000, issued_at: "2024-01-01" }), // vieja
        inv({ total_amount: 7000, status: "pagada", issued_at: "2026-03-01" }), // cuenta
      ],
    });
    const p = await getMyReferralProgram(admin, "DTD-1004", NOW);
    expect(p.billedUsd).toBe(7000);
  });

  it("normaliza VES por fx_rate y omite CNY", async () => {
    const { admin } = stub({
      invoices: [
        inv({ currency: "VES", total_amount: 3700, fx_rate: 37 }), // 100 USD
        inv({ currency: "CNY", total_amount: 5000 }), // 0
      ],
    });
    const p = await getMyReferralProgram(admin, "DTD-1004", NOW);
    expect(p.billedUsd).toBe(100);
  });

  it("créditos: ganados = Σ acreditados; en camino = $80 por cada uno en pipeline", async () => {
    const { admin } = stub({
      referrals: [
        ref({ id: "a", status: "acreditado", reward_usd: 80 }),
        ref({ id: "b", status: "acreditado", reward_usd: 80 }),
        ref({ id: "c", status: "primer-embarque", reward_usd: 0 }), // pipeline
        ref({ id: "d", status: "registrado", reward_usd: 0 }), // pipeline
        ref({ id: "e", status: "invitado", reward_usd: 0 }), // ni earned ni pending
      ],
    });
    const p = await getMyReferralProgram(admin, "DTD-1004", NOW);
    expect(p.creditsEarnedUsd).toBe(160);
    expect(p.pendingCreditsUsd).toBe(160);
    expect(p.referrals).toHaveLength(5);
    expect(p.referrals[0]).toMatchObject({
      id: "a",
      referredName: "Jorge Calderón",
      referredCompany: "Calderón Industrial",
      status: "acreditado",
      rewardUsd: 80,
    });
  });

  it("expone las recompensas del programa (fallback $80/$60 sin config)", async () => {
    const { admin } = stub({});
    const p = await getMyReferralProgram(admin, "DTD-1004", NOW);
    expect(p.referredReward).toBe(60);
    expect(p.referrerReward).toBe(80);
  });

  it("usa los montos configurados de referral_settings (SDD-0159)", async () => {
    const { admin } = stub({
      clientTenantId: "t1",
      settings: { referrer_reward_usd: 100, referred_reward_usd: 50 },
      referrals: [
        ref({ id: "a", status: "acreditado", reward_usd: 100 }),
        ref({ id: "b", status: "primer-embarque", reward_usd: 0 }), // pipeline
        ref({ id: "c", status: "registrado", reward_usd: 0 }), // pipeline
      ],
    });
    const p = await getMyReferralProgram(admin, "DTD-1004", NOW);
    expect(p.referrerReward).toBe(100);
    expect(p.referredReward).toBe(50);
    // en camino = referrerReward configurado × 2 en pipeline.
    expect(p.pendingCreditsUsd).toBe(200);
  });
});

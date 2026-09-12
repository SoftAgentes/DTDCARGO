/**
 * Tests del Programa de Referidos del portal (cara cliente de SDD-0051).
 *
 *  - `getMyReferralProgram`: deriva el código REF-XXXX, el nivel (de la
 *    facturación trailing-12m USD), los créditos (espejo de creditsEarned/
 *    pendingCredits) y mapea los referidos.
 *  - SDD-0339: los datos llegan del snapshot de la RPC
 *    `get_portal_referral_program()`, ligada al principal de la sesión. Los
 *    estados billable, la ventana de 12m, la normalización USD (VES por fx_rate,
 *    CNY omitido), el aislamiento por tenant y el fallback $80/$60 se calculan en
 *    la RPC 0404 y los fija su contrato
 *    `supabase/tests/0404_portal_referidos_por_principal.test.sql`.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyReferralProgram } from "../portal-referral-queries";

/**
 * Stub de la sesión Portal: `rpc()` devuelve el snapshot de 0404 y `from()`
 * lanza, para que volver a leer invoices/referrals/clients/referral_settings
 * directo desde TypeScript rompa el test.
 */
function stub(snapshot: Record<string, unknown>) {
  const rpc = vi.fn().mockResolvedValue({ data: snapshot, error: null });
  const from = vi.fn(() => {
    throw new Error("lectura directa de tabla no permitida en Referidos");
  });
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

function snapshot(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    markbox: "DTD-1004",
    billed_usd: 0,
    referrer_reward_usd: 80,
    referred_reward_usd: 60,
    referrals: [],
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
    const { db } = stub(snapshot({ markbox: " dtd-1004 " }));
    const p = await getMyReferralProgram(db);
    expect(p?.shareCode).toBe("REF-1004");
  });

  it("deriva el nivel de la facturación trailing-12m USD", async () => {
    const { db } = stub(snapshot({ billed_usd: 60000 }));
    const p = await getMyReferralProgram(db);
    expect(p?.billedUsd).toBe(60000);
    expect(p?.tier.tier.id).toBe("silver");
    expect(p?.tier.next?.id).toBe("gold");
    expect(p?.tier.toNext).toBe(90000);
  });

  it("sin facturación → Bronze", async () => {
    const { db } = stub(snapshot({ billed_usd: 0 }));
    const p = await getMyReferralProgram(db);
    expect(p?.billedUsd).toBe(0);
    expect(p?.tier.tier.id).toBe("bronze");
  });

  it("toma la facturación ya filtrada por la RPC (borradores y ventana 12m) sin leer invoices", async () => {
    // Contrato 0404 ($own_program): 100 USD emitida + 3700 VES / 37 = 200; el
    // borrador, la factura de hace 400 días y la del otro tenant quedan fuera.
    const { db, rpc, from } = stub(snapshot({ billed_usd: 7000 }));
    const p = await getMyReferralProgram(db);
    expect(p?.billedUsd).toBe(7000);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_portal_referral_program");
    expect(from).not.toHaveBeenCalled();
  });

  it("normaliza montos del snapshot: la conversión VES/CNY es de la RPC; TS sólo acepta números ≥ 0", async () => {
    const texto = await getMyReferralProgram(
      stub(snapshot({ billed_usd: "100.50" })).db,
    );
    expect(texto?.billedUsd).toBe(100.5);
    const negativo = await getMyReferralProgram(
      stub(snapshot({ billed_usd: -50 })).db,
    );
    expect(negativo?.billedUsd).toBe(0);
    const invalido = await getMyReferralProgram(
      stub(snapshot({ billed_usd: "abc" })).db,
    );
    expect(invalido?.billedUsd).toBe(0);
  });

  it("créditos: ganados = Σ acreditados; en camino = $80 por cada uno en pipeline", async () => {
    const { db } = stub(
      snapshot({
        referrals: [
          ref({ id: "a", status: "acreditado", reward_usd: 80 }),
          ref({ id: "b", status: "acreditado", reward_usd: 80 }),
          ref({ id: "c", status: "primer-embarque", reward_usd: 0 }), // pipeline
          ref({ id: "d", status: "registrado", reward_usd: 0 }), // pipeline
          ref({ id: "e", status: "invitado", reward_usd: 0 }), // ni earned ni pending
        ],
      }),
    );
    const p = await getMyReferralProgram(db);
    expect(p?.creditsEarnedUsd).toBe(160);
    expect(p?.pendingCreditsUsd).toBe(160);
    expect(p?.referrals).toHaveLength(5);
    expect(p?.referrals[0]).toMatchObject({
      id: "a",
      referredName: "Jorge Calderón",
      referredCompany: "Calderón Industrial",
      status: "acreditado",
      rewardUsd: 80,
    });
  });

  it("expone las recompensas del snapshot (el fallback $80/$60 sin config lo resuelve la RPC)", async () => {
    const { db } = stub(snapshot());
    const p = await getMyReferralProgram(db);
    expect(p?.referredReward).toBe(60);
    expect(p?.referrerReward).toBe(80);
  });

  it("usa los montos configurados de referral_settings (SDD-0159)", async () => {
    const { db } = stub(
      snapshot({
        referrer_reward_usd: 100,
        referred_reward_usd: 50,
        referrals: [
          ref({ id: "a", status: "acreditado", reward_usd: 100 }),
          ref({ id: "b", status: "primer-embarque", reward_usd: 0 }), // pipeline
          ref({ id: "c", status: "registrado", reward_usd: 0 }), // pipeline
        ],
      }),
    );
    const p = await getMyReferralProgram(db);
    expect(p?.referrerReward).toBe(100);
    expect(p?.referredReward).toBe(50);
    // en camino = referrerReward configurado × 2 en pipeline.
    expect(p?.pendingCreditsUsd).toBe(200);
  });
});

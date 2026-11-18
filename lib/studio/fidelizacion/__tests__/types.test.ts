/**
 * Tests del motor de Fidelización & Referidos (SDD-0051 · Slice A) — types.
 *
 * Cubre Acceptance §5 Slice A:
 *  - tierOf da los 4 cortes + bordes exactos (49.999 / 50.000 / 149.999 /
 *    150.000 / 299.999 / 300.000) — mismos resultados que fidelizacion-data.jsx.
 *  - tierProgress (pct / toNext / nivel máximo).
 *  - referralShareCode determinístico.
 *  - validateReferralInput (happy path + todos los errores).
 *  - invoiceUsdAmount por moneda (USD/USDT 1:1, VES con/sin fx, CNY omitida).
 */

import { describe, it, expect } from "vitest";
import {
  invoiceUsdAmount,
  nextTier,
  referralShareCode,
  REFERRAL_RULES,
  REFERRAL_STEPS,
  tierOf,
  tierProgress,
  TIERS,
  validateReferralInput,
} from "../types";
import type { Invoice } from "@/lib/studio/invoice-types";

describe("tierOf", () => {
  it("0 → Bronze", () => {
    expect(tierOf(0).id).toBe("bronze");
  });

  it("borde 49.999 → Bronze (justo debajo de Silver)", () => {
    expect(tierOf(49999).id).toBe("bronze");
  });

  it("borde 50.000 → Silver (umbral exacto)", () => {
    expect(tierOf(50000).id).toBe("silver");
  });

  it("borde 149.999 → Silver", () => {
    expect(tierOf(149999).id).toBe("silver");
  });

  it("borde 150.000 → Gold (umbral exacto)", () => {
    expect(tierOf(150000).id).toBe("gold");
  });

  it("borde 299.999 → Gold", () => {
    expect(tierOf(299999).id).toBe("gold");
  });

  it("borde 300.000 → Platinum (umbral exacto)", () => {
    expect(tierOf(300000).id).toBe("platinum");
  });

  it("muy alto → Platinum", () => {
    expect(tierOf(5_000_000).id).toBe("platinum");
  });

  it("negativo o NaN → Bronze (defensivo)", () => {
    expect(tierOf(-100).id).toBe("bronze");
    expect(tierOf(Number.NaN).id).toBe("bronze");
  });
});

describe("nextTier", () => {
  it("Bronze → Silver", () => {
    expect(nextTier(TIERS[0])?.id).toBe("silver");
  });
  it("Gold → Platinum", () => {
    expect(nextTier(TIERS[2])?.id).toBe("platinum");
  });
  it("Platinum → null (nivel máximo)", () => {
    expect(nextTier(TIERS[3])).toBeNull();
  });
});

describe("tierProgress", () => {
  it("Bronze a mitad de camino a Silver (25.000) → 50%", () => {
    const p = tierProgress(25000);
    expect(p.tier.id).toBe("bronze");
    expect(p.next?.id).toBe("silver");
    expect(p.pct).toBeCloseTo(50, 5);
    expect(p.toNext).toBe(25000);
  });

  it("justo en el umbral de Silver (50.000) → 0% del tramo Silver→Gold", () => {
    const p = tierProgress(50000);
    expect(p.tier.id).toBe("silver");
    expect(p.next?.id).toBe("gold");
    expect(p.pct).toBeCloseTo(0, 5);
    expect(p.toNext).toBe(100000); // 150.000 − 50.000
  });

  it("Platinum (nivel máximo) → 100% / toNext 0 / next null", () => {
    const p = tierProgress(400000);
    expect(p.tier.id).toBe("platinum");
    expect(p.next).toBeNull();
    expect(p.pct).toBe(100);
    expect(p.toNext).toBe(0);
  });

  it("nunca supera 100% dentro de un tramo", () => {
    // 149.999 está casi al tope del tramo Silver→Gold (span 100.000)
    const p = tierProgress(149999);
    expect(p.tier.id).toBe("silver");
    expect(p.pct).toBeLessThanOrEqual(100);
    expect(p.toNext).toBe(1);
  });
});

describe("referralShareCode", () => {
  it("DTD-5452 → REF-5452 (determinístico)", () => {
    expect(referralShareCode("DTD-5452")).toBe("REF-5452");
  });
  it("idempotente para el mismo markbox", () => {
    expect(referralShareCode("DTD-1001")).toBe(referralShareCode("DTD-1001"));
  });
  it("sin prefijo DTD- deja el resto", () => {
    expect(referralShareCode("9999")).toBe("REF-9999");
  });
  it("vacío / null → REF-", () => {
    expect(referralShareCode("")).toBe("REF-");
    expect(referralShareCode(undefined as unknown as string)).toBe("REF-");
  });
});

describe("REFERRAL_RULES / REFERRAL_STEPS", () => {
  it("reglas V1: referidor 80 / referido 60 / USD", () => {
    expect(REFERRAL_RULES.referrerReward).toBe(80);
    expect(REFERRAL_RULES.referredReward).toBe(60);
    expect(REFERRAL_RULES.currency).toBe("USD");
  });
  it("steps en orden del timeline", () => {
    expect(REFERRAL_STEPS).toEqual([
      "invitado",
      "registrado",
      "primer-embarque",
      "acreditado",
    ]);
  });
});

describe("validateReferralInput", () => {
  const happy = {
    referrer_markbox: "DTD-5452",
    referred_name: "Pedro Mejías",
    referred_company: "Mejías Construcción",
    referred_email: "pedro@mejias.com",
    referred_phone: "+58 412 000 0000",
    status: "invitado" as const,
    lead_id: "L-0135",
    notes: "vino por recomendación",
  };

  it("happy path → input normalizado", () => {
    const r = validateReferralInput(happy);
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.referrer_markbox).toBe("DTD-5452");
    expect(r.input?.referred_name).toBe("Pedro Mejías");
    expect(r.input?.referred_email).toBe("pedro@mejias.com");
    expect(r.input?.status).toBe("invitado");
  });

  it("referrer_markbox vacío → error", () => {
    const r = validateReferralInput({ ...happy, referrer_markbox: "  " });
    expect(r.input).toBeUndefined();
    expect(r.fieldErrors?.referrer_markbox).toBeTruthy();
  });

  it("referred_name vacío → error", () => {
    const r = validateReferralInput({ ...happy, referred_name: "" });
    expect(r.fieldErrors?.referred_name).toBeTruthy();
  });

  it("referred_name > 200 → error", () => {
    const r = validateReferralInput({
      ...happy,
      referred_name: "x".repeat(201),
    });
    expect(r.fieldErrors?.referred_name).toBeTruthy();
  });

  it("email inválido si viene → error", () => {
    const r = validateReferralInput({ ...happy, referred_email: "no-es-mail" });
    expect(r.fieldErrors?.referred_email).toBeTruthy();
  });

  it("email vacío es válido (opcional) → null", () => {
    const r = validateReferralInput({ ...happy, referred_email: "  " });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.referred_email).toBeNull();
  });

  it("status faltante → default 'invitado'", () => {
    const r = validateReferralInput({
      referrer_markbox: "DTD-1",
      referred_name: "X",
    });
    expect(r.input?.status).toBe("invitado");
  });

  it("status inválido → error", () => {
    const r = validateReferralInput({
      ...happy,
      status: "loquesea" as never,
    });
    expect(r.fieldErrors?.status).toBeTruthy();
  });

  it("trim de campos opcionales / vacíos → null", () => {
    const r = validateReferralInput({
      referrer_markbox: "DTD-2",
      referred_name: "  Ana  ",
      referred_company: "   ",
      referred_phone: "",
      lead_id: "   ",
      notes: "",
    });
    expect(r.input?.referred_name).toBe("Ana");
    expect(r.input?.referred_company).toBeNull();
    expect(r.input?.referred_phone).toBeNull();
    expect(r.input?.lead_id).toBeNull();
    expect(r.input?.notes).toBeNull();
  });
});

describe("invoiceUsdAmount", () => {
  const base = (
    p: Partial<Pick<Invoice, "currency" | "total_amount" | "fx_rate">>,
  ): Pick<Invoice, "currency" | "total_amount" | "fx_rate"> => ({
    currency: "USD",
    total_amount: 0,
    fx_rate: null,
    ...p,
  });

  it("USD 1:1", () => {
    expect(invoiceUsdAmount(base({ currency: "USD", total_amount: 1000 }))).toBe(
      1000,
    );
  });

  it("USDT 1:1", () => {
    expect(
      invoiceUsdAmount(base({ currency: "USDT", total_amount: 2500 })),
    ).toBe(2500);
  });

  it("VES con fx_rate > 0 → total / fx", () => {
    expect(
      invoiceUsdAmount(
        base({ currency: "VES", total_amount: 36500, fx_rate: 36.5 }),
      ),
    ).toBe(1000);
  });

  // SDD-0572 (decisión 1 de Sam; el Director, 2026-10-20): sin tasa no se convierte, null; nunca 0.
  it("VES sin fx_rate (null) → null (va a «sin tasa»)", () => {
    expect(
      invoiceUsdAmount(base({ currency: "VES", total_amount: 36500, fx_rate: null })),
    ).toBeNull();
  });

  it("VES con fx_rate 0 → null", () => {
    expect(
      invoiceUsdAmount(base({ currency: "VES", total_amount: 100, fx_rate: 0 })),
    ).toBeNull();
  });

  it("CNY sin tasa → null; con tasa convierte (antes 0 siempre)", () => {
    expect(
      invoiceUsdAmount(base({ currency: "CNY", total_amount: 9999 })),
    ).toBeNull();
    expect(
      invoiceUsdAmount(base({ currency: "CNY", total_amount: 7200, fx_rate: 7.2 })),
    ).toBe(1000);
  });

  it("total_amount no numérico → null (falla cerrado)", () => {
    expect(
      invoiceUsdAmount(
        base({ currency: "USD", total_amount: Number.NaN }),
      ),
    ).toBeNull();
  });
});

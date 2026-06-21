/**
 * Tests del guard de cuota del tracking (SDD-0101 · Slice B.2 · lógica PURA).
 */
import { describe, it, expect } from "vitest";
import {
  trackingQuotaDecision,
  trackingPeriod,
} from "../tracking-quota";

const CFG = { monthlyCap: 40, reserve: 10 };

describe("trackingQuotaDecision", () => {
  it("permite cuando hay margen local y de plan", () => {
    const d = trackingQuotaDecision({ callsThisPeriod: 3, lastRemaining: 80, ...CFG });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBeNull();
  });

  it("bloquea al alcanzar el tope mensual local", () => {
    const d = trackingQuotaDecision({ callsThisPeriod: 40, lastRemaining: 80, ...CFG });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("monthly_cap");
    expect(d.message).toContain("40");
  });

  it("bloquea cuando el remaining del plan está en/bajo la reserva", () => {
    const atReserve = trackingQuotaDecision({ callsThisPeriod: 1, lastRemaining: 10, ...CFG });
    expect(atReserve.allowed).toBe(false);
    expect(atReserve.reason).toBe("account_reserve");

    const below = trackingQuotaDecision({ callsThisPeriod: 1, lastRemaining: 5, ...CFG });
    expect(below.allowed).toBe(false);
  });

  it("permite si nunca se llamó (remaining null) y hay margen local", () => {
    const d = trackingQuotaDecision({ callsThisPeriod: 0, lastRemaining: null, ...CFG });
    expect(d.allowed).toBe(true);
  });

  it("el tope mensual manda sobre la reserva (ambos bloqueos posibles)", () => {
    const d = trackingQuotaDecision({ callsThisPeriod: 40, lastRemaining: 3, ...CFG });
    expect(d.reason).toBe("monthly_cap");
  });
});

describe("trackingPeriod", () => {
  it("formatea YYYY-MM en UTC", () => {
    expect(trackingPeriod(new Date("2026-06-21T10:00:00Z"))).toBe("2026-06");
    expect(trackingPeriod(new Date("2026-01-03T23:30:00Z"))).toBe("2026-01");
  });
});

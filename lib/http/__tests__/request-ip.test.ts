// @vitest-environment node
/**
 * Tests del helper compartido de IP del request (SDD-0054 · Slice C /
 * SDD-0042 §10). `resolveRequestIp` es puro (recibe Headers) → testeable sin
 * `next/headers`. Cubre: primer x-forwarded-for, fallback x-real-ip, unknown,
 * y la guarda anti-cadena-anómala.
 */

import { describe, it, expect } from "vitest";
import { resolveRequestIp } from "../request-ip";

function h(entries: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [k, v] of Object.entries(entries)) headers.set(k, v);
  return headers;
}

describe("resolveRequestIp", () => {
  it("toma el PRIMER x-forwarded-for (la IP del cliente en el edge)", () => {
    expect(
      resolveRequestIp(h({ "x-forwarded-for": "190.142.88.214, 10.0.0.1, 10.0.0.2" })),
    ).toBe("190.142.88.214");
  });

  it("trimea espacios del primer hop", () => {
    expect(
      resolveRequestIp(h({ "x-forwarded-for": "  203.0.113.7 , 10.0.0.1 " })),
    ).toBe("203.0.113.7");
  });

  it("un solo hop en x-forwarded-for también vale", () => {
    expect(resolveRequestIp(h({ "x-forwarded-for": "8.8.8.8" }))).toBe("8.8.8.8");
  });

  it("cae a x-real-ip si no hay x-forwarded-for", () => {
    expect(resolveRequestIp(h({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("sin headers de IP → 'unknown'", () => {
    expect(resolveRequestIp(h({}))).toBe("unknown");
  });

  it("cadena XFF anómalamente larga (> 8 hops) → no confía, cae a x-real-ip", () => {
    const longChain = Array.from({ length: 12 }, (_, i) => `10.0.0.${i}`).join(", ");
    expect(
      resolveRequestIp(h({ "x-forwarded-for": longChain, "x-real-ip": "9.9.9.9" })),
    ).toBe("9.9.9.9");
  });

  it("cadena XFF anómala sin x-real-ip → 'unknown'", () => {
    const longChain = Array.from({ length: 12 }, (_, i) => `10.0.0.${i}`).join(", ");
    expect(resolveRequestIp(h({ "x-forwarded-for": longChain }))).toBe("unknown");
  });

  it("x-forwarded-for vacío (solo comas/espacios) → cae a x-real-ip", () => {
    expect(
      resolveRequestIp(h({ "x-forwarded-for": " , , ", "x-real-ip": "5.5.5.5" })),
    ).toBe("5.5.5.5");
  });
});

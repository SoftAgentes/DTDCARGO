// @vitest-environment node
/**
 * Tests del helper compartido de IP del request (SDD-0054 · Slice C /
 * SDD-0042 §10). `resolveRequestIp` es puro (recibe Headers y env) → testeable
 * sin `next/headers`. Cubre: primer x-forwarded-for, fallback x-real-ip, unknown,
 * la guarda anti-cadena-anómala y el header del proxy de confianza
 * (`REQUEST_IP_HEADER`, SDD-0505).
 */

import { afterEach, describe, it, expect, vi } from "vitest";
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

/**
 * Header del proxy de confianza (SDD-0505). El caso que discrimina es el spoof:
 * XFF `1.2.3.4` del cliente + `x-real-ip 9.9.9.9` fijado por Traefik ⇒ sin la
 * regla, la función devolvería `1.2.3.4`.
 */
describe("resolveRequestIp · REQUEST_IP_HEADER", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("configurado y presente: gana el header del proxy", () => {
    expect(
      resolveRequestIp(h({ "x-real-ip": "9.9.9.9" }), { REQUEST_IP_HEADER: "x-real-ip" }),
    ).toBe("9.9.9.9");
  });

  it("spoof: el XFF del cliente no manda cuando el proxy fija x-real-ip", () => {
    expect(
      resolveRequestIp(
        h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "9.9.9.9" }),
        { REQUEST_IP_HEADER: "x-real-ip" },
      ),
    ).toBe("9.9.9.9");
  });

  it("detrás de Cloudflare: cf-connecting-ip gana sobre XFF y x-real-ip", () => {
    expect(
      resolveRequestIp(
        h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "10.0.0.1", "cf-connecting-ip": "203.0.113.9" }),
        { REQUEST_IP_HEADER: "cf-connecting-ip" },
      ),
    ).toBe("203.0.113.9");
  });

  it("configurado y ausente: cae a la conducta actual (XFF)", () => {
    expect(
      resolveRequestIp(h({ "x-forwarded-for": "1.2.3.4" }), { REQUEST_IP_HEADER: "cf-connecting-ip" }),
    ).toBe("1.2.3.4");
  });

  it("configurado pero el header llega vacío: cae a XFF", () => {
    expect(
      resolveRequestIp(
        h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "   " }),
        { REQUEST_IP_HEADER: "x-real-ip" },
      ),
    ).toBe("1.2.3.4");
  });

  it("vacío o no definido ⇒ conducta actual", () => {
    const headers = h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "9.9.9.9" });
    expect(resolveRequestIp(headers, { REQUEST_IP_HEADER: "" })).toBe("1.2.3.4");
    expect(resolveRequestIp(headers, { REQUEST_IP_HEADER: "   " })).toBe("1.2.3.4");
    expect(resolveRequestIp(headers, {})).toBe("1.2.3.4");
  });

  it("el nombre del header ignora mayúsculas y espacios", () => {
    expect(
      resolveRequestIp(
        h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "9.9.9.9" }),
        { REQUEST_IP_HEADER: "  X-Real-IP " },
      ),
    ).toBe("9.9.9.9");
  });

  it("si el header del proxy trae una lista, toma el primer elemento recortado", () => {
    expect(
      resolveRequestIp(
        h({ "cf-connecting-ip": "  203.0.113.9 , 10.0.0.1" }),
        { REQUEST_IP_HEADER: "cf-connecting-ip" },
      ),
    ).toBe("203.0.113.9");
  });

  it("x-forwarded-for no se acepta como header de confianza: sigue la conducta actual con su guarda", () => {
    const longChain = Array.from({ length: 12 }, (_, i) => `10.0.0.${i}`).join(", ");
    const headers = h({ "x-forwarded-for": longChain, "x-real-ip": "9.9.9.9" });
    // Si se aceptara, devolvería `10.0.0.0` (primer hop) saltándose la guarda.
    expect(resolveRequestIp(headers, { REQUEST_IP_HEADER: "x-forwarded-for" })).toBe("9.9.9.9");
    expect(resolveRequestIp(headers, { REQUEST_IP_HEADER: "X-Forwarded-For" })).toBe("9.9.9.9");
  });

  it("un nombre de header inválido no tumba el request: cae a XFF", () => {
    expect(
      resolveRequestIp(h({ "x-forwarded-for": "1.2.3.4" }), { REQUEST_IP_HEADER: "x real ip" }),
    ).toBe("1.2.3.4");
  });

  it("sin segundo argumento lee process.env", () => {
    vi.stubEnv("REQUEST_IP_HEADER", "x-real-ip");
    expect(
      resolveRequestIp(h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "9.9.9.9" })),
    ).toBe("9.9.9.9");
  });
});

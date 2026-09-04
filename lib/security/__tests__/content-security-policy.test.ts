import { describe, expect, it } from "vitest";

import {
  buildPrivateAppCsp,
  createCspNonce,
} from "../content-security-policy";

describe("CSP con nonce de las superficies privadas", () => {
  it("genera un nonce nuevo y apto para una directiva CSP", () => {
    const first = createCspNonce();
    const second = createCspNonce();

    expect(first).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
    expect(second).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
    expect(first).not.toBe(second);
  });

  it("cierra scripts inline y eval en producción", () => {
    const csp = buildPrivateAppCsp("abc123", { development: false });

    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp.match(/'unsafe-inline'/g)).toHaveLength(1);
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("googletagmanager.com");
  });

  it("habilita eval únicamente para el runtime local de Next", () => {
    const csp = buildPrivateAppCsp("abc123", { development: true });

    expect(csp).toContain("'unsafe-eval'");
  });

  it("rechaza valores que podrían inyectar otra directiva", () => {
    expect(() =>
      buildPrivateAppCsp("abc'; img-src *", { development: false }),
    ).toThrow("Nonce CSP inválido");
  });
});

/**
 * Tests del TOTP del No-Olvidar (SDD-0025 §4.5).
 */

import { describe, it, expect } from "vitest";
import { generateSync } from "otplib";
import { generateTotpSecret, buildTotpUri, verifyTotp } from "@/lib/studio/no-olvidar/totp";

describe("no-olvidar/totp", () => {
  it("genera un secret base32 no vacío", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("verifica el código actual generado para el secret", () => {
    const secret = generateTotpSecret();
    const code = generateSync({ secret });
    expect(verifyTotp(code, secret)).toBe(true);
  });

  it("rechaza un código incorrecto", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp("000000", secret)).toBe(false);
  });

  it("rechaza formatos inválidos sin lanzar", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp("abc", secret)).toBe(false);
    expect(verifyTotp("12345", secret)).toBe(false);
    expect(verifyTotp("1234567", secret)).toBe(false);
    expect(verifyTotp("123456", "")).toBe(false);
  });

  it("tolera espacios en el código", () => {
    const secret = generateTotpSecret();
    const code = generateSync({ secret });
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(verifyTotp(spaced, secret)).toBe(true);
  });

  it("buildTotpUri arma un otpauth:// con emisor y cuenta", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, "empleado@dtdcargo.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("empleado%40dtdcargo.com");
    expect(uri).toContain(`secret=${secret}`);
  });
});

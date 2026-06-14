/**
 * Tests de las utilidades puras de email (SDD-0082 · SDD-0062 Slice D).
 */

import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  canonicalizeEmail,
  isEmailOptinSource,
  EMAIL_OPTIN_SOURCES,
} from "../email-utils";

describe("isValidEmail", () => {
  it("acepta emails con formato válido", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("  Cliente@DTD.com ")).toBe(true); // trim antes de validar
  });
  it("rechaza basura, vacío y null", () => {
    expect(isValidEmail("no-es-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false); // sin TLD
    expect(isValidEmail("a @b.com")).toBe(false); // espacio
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
});

describe("canonicalizeEmail", () => {
  it("trim + minúsculas en un email válido", () => {
    expect(canonicalizeEmail("  Cliente@DTD.COM ")).toBe("cliente@dtd.com");
    expect(canonicalizeEmail("a@b.com")).toBe("a@b.com");
  });
  it("devuelve null si es inválido o vacío", () => {
    expect(canonicalizeEmail("no-es-email")).toBeNull();
    expect(canonicalizeEmail("")).toBeNull();
    expect(canonicalizeEmail(null)).toBeNull();
  });
  it("dos variantes del mismo email canonicalizan igual (dedup)", () => {
    expect(canonicalizeEmail(" SAM@dtd.com")).toBe(canonicalizeEmail("sam@dtd.com "));
  });
});

describe("isEmailOptinSource", () => {
  it("valida contra el catálogo", () => {
    for (const s of EMAIL_OPTIN_SOURCES) expect(isEmailOptinSource(s)).toBe(true);
  });
  it("rechaza valores fuera del catálogo", () => {
    expect(isEmailOptinSource("otra")).toBe(false);
    expect(isEmailOptinSource(null)).toBe(false);
    expect(isEmailOptinSource(123)).toBe(false);
  });
});

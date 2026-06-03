/**
 * Tests del gating del auto (SDD-0046 · V1 manual-only).
 *
 * `isAutoVerifyEnabled` decide si la UI muestra el botón "Verificar con
 * CNE/SENIAT" o degrada al piso manual. Hoy:
 *   - persona/unknown → CNE: habilitado solo si `IDENTITY_CNE_URL` está seteada.
 *   - empresa → SENIAT: siempre `false` (Slice C no construido).
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  isAutoVerifyEnabled,
  isCneAutoEnabled,
  isSeniatAutoEnabled,
} from "../index";

const prev = process.env.IDENTITY_CNE_URL;

afterEach(() => {
  if (prev === undefined) delete process.env.IDENTITY_CNE_URL;
  else process.env.IDENTITY_CNE_URL = prev;
});

describe("isCneAutoEnabled", () => {
  it("false sin IDENTITY_CNE_URL", () => {
    delete process.env.IDENTITY_CNE_URL;
    expect(isCneAutoEnabled()).toBe(false);
  });

  it("false con IDENTITY_CNE_URL vacía / whitespace", () => {
    process.env.IDENTITY_CNE_URL = "   ";
    expect(isCneAutoEnabled()).toBe(false);
  });

  it("true con IDENTITY_CNE_URL seteada", () => {
    process.env.IDENTITY_CNE_URL = "https://example.test/cedula";
    expect(isCneAutoEnabled()).toBe(true);
  });
});

describe("isSeniatAutoEnabled", () => {
  it("false (Slice C no construido)", () => {
    expect(isSeniatAutoEnabled()).toBe(false);
  });
});

describe("isAutoVerifyEnabled · por tipo de documento", () => {
  it("empresa → false aunque haya IDENTITY_CNE_URL (usa SENIAT)", () => {
    process.env.IDENTITY_CNE_URL = "https://example.test/cedula";
    expect(isAutoVerifyEnabled("empresa")).toBe(false);
  });

  it("persona → sigue a isCneAutoEnabled (sin URL → false)", () => {
    delete process.env.IDENTITY_CNE_URL;
    expect(isAutoVerifyEnabled("persona")).toBe(false);
  });

  it("persona → true con IDENTITY_CNE_URL", () => {
    process.env.IDENTITY_CNE_URL = "https://example.test/cedula";
    expect(isAutoVerifyEnabled("persona")).toBe(true);
  });

  it("null / unknown → ruta CNE", () => {
    process.env.IDENTITY_CNE_URL = "https://example.test/cedula";
    expect(isAutoVerifyEnabled(null)).toBe(true);
    expect(isAutoVerifyEnabled("unknown")).toBe(true);
    delete process.env.IDENTITY_CNE_URL;
    expect(isAutoVerifyEnabled(null)).toBe(false);
    expect(isAutoVerifyEnabled("unknown")).toBe(false);
  });
});

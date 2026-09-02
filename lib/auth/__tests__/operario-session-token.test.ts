import { describe, expect, it } from "vitest";
import {
  createOperarioSessionToken,
  isOperarioSessionSecretUsable,
  readOperarioSessionToken,
} from "../operario-session-token";

const SECRET = "operario-session-secret-for-tests-32-bytes-minimum";
const OTHER_SECRET = "another-operario-session-secret-with-32-bytes";
const NOW = 1_788_321_600;
const IDENTITY = {
  operarioId: "9c8ce03d-30ac-4ca2-9901-9e84c3d2410a",
  tenantId: "5ed893f8-b17e-4d0b-8a76-b7cd5f6df429",
};

describe("token de sesión de operario · SDD-0327", () => {
  it("sella y recupera identidad, tenant y vencimiento autenticados", () => {
    const token = createOperarioSessionToken(IDENTITY, SECRET, NOW);

    expect(token).toMatch(/^o2\./);
    expect(token).not.toContain(IDENTITY.operarioId);
    expect(token).not.toContain(IDENTITY.tenantId);
    expect(readOperarioSessionToken(token, SECRET, NOW + 60)).toEqual(IDENTITY);
  });

  it("rechaza una cookie manipulada o abierta con otro secreto", () => {
    const token = createOperarioSessionToken(IDENTITY, SECRET, NOW);
    const parts = token.split(".");
    const ciphertext = parts[2];
    const flipped = ciphertext.startsWith("A")
      ? `B${ciphertext.slice(1)}`
      : `A${ciphertext.slice(1)}`;

    expect(
      readOperarioSessionToken(
        [parts[0], parts[1], flipped, parts[3]].join("."),
        SECRET,
        NOW,
      ),
    ).toBeNull();
    expect(readOperarioSessionToken(token, OTHER_SECRET, NOW)).toBeNull();
  });

  it("rechaza el UUID legado desnudo y tokens vencidos", () => {
    const token = createOperarioSessionToken(IDENTITY, SECRET, NOW);

    expect(readOperarioSessionToken(IDENTITY.operarioId, SECRET, NOW)).toBeNull();
    expect(readOperarioSessionToken(token, SECRET, NOW + 12 * 60 * 60)).toBeNull();
  });

  it("falla cerrado si el secreto falta o es débil", () => {
    expect(isOperarioSessionSecretUsable(undefined)).toBe(false);
    expect(isOperarioSessionSecretUsable("demasiado-corto")).toBe(false);
    expect(readOperarioSessionToken("o2.a.b.c", undefined, NOW)).toBeNull();
    expect(() =>
      createOperarioSessionToken(IDENTITY, "demasiado-corto", NOW),
    ).toThrow(/al menos 32/);
  });
});

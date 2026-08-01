import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("magic link del portal", () => {
  const source = readFileSync(resolve(__dirname, "../actions.ts"), "utf8");

  it("limita por origen y nunca crea usuarios desde el login", () => {
    expect(source).toContain("getRequestIp");
    expect(source).toContain("portal-login:");
    expect(source).toContain("shouldCreateUser: false");
  });

  it("no devuelve mensajes que revelen si el correo existe", () => {
    expect(source).not.toContain("todavía no tiene el portal habilitado");
    expect(source).toContain("return genericSuccess(email)");
  });
});

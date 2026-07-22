/**
 * Tests del token firmado de unsubscribe (SDD-0082 · SDD-0062 Slice D).
 */

import { describe, it, expect } from "vitest";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../unsubscribe-token";

const SECRET = "test-secret-123";

describe("unsubscribe token", () => {
  it("firma y verifica ida y vuelta (email canónico)", () => {
    const tok = signUnsubscribeToken(
      { email: "  Cliente@DTD.com ", tenantId: "tenant-1" },
      SECRET,
    );
    const out = verifyUnsubscribeToken(tok, SECRET);
    expect(out).toEqual({
      email: "cliente@dtd.com",
      tenantId: "tenant-1",
      audience: "marketing",
    });
  });

  it("firma y verifica baja de newsletter", () => {
    const tok = signUnsubscribeToken(
      {
        email: "cliente@dtdcargo.com",
        tenantId: "tenant-1",
        audience: "newsletter",
      },
      SECRET,
    );
    const out = verifyUnsubscribeToken(tok, SECRET);
    expect(out).toEqual({
      email: "cliente@dtdcargo.com",
      tenantId: "tenant-1",
      audience: "newsletter",
    });
  });

  it("rechaza con secreto distinto", () => {
    const tok = signUnsubscribeToken({ email: "a@b.com", tenantId: "t" }, SECRET);
    expect(verifyUnsubscribeToken(tok, "otro-secreto")).toBeNull();
  });

  it("rechaza token manipulado (payload cambiado, firma vieja)", () => {
    const tok = signUnsubscribeToken({ email: "a@b.com", tenantId: "t" }, SECRET);
    const forged =
      signUnsubscribeToken({ email: "victima@b.com", tenantId: "t" }, SECRET).split(".")[0] +
      "." +
      tok.split(".")[1];
    expect(verifyUnsubscribeToken(forged, SECRET)).toBeNull();
  });

  it("rechaza basura / vacío / sin punto", () => {
    expect(verifyUnsubscribeToken(null, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("sinpunto", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(".", SECRET)).toBeNull();
  });
});

// @vitest-environment node
/**
 * Tests del token firmado de unsubscribe (SDD-0082 · SDD-0062 Slice D).
 */

import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  buildUnsubscribeUrl,
  signUnsubscribeToken,
  unsubscribeTokenFingerprint,
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
    expect(tok.split(".")).toHaveLength(4);
    expect(tok.startsWith("v2.")).toBe(true);
    expect(tok).not.toContain("cliente");
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

  it("rechaza token cifrado manipulado", () => {
    const tok = signUnsubscribeToken({ email: "a@b.com", tenantId: "t" }, SECRET);
    const parts = tok.split(".");
    parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith("A") ? "B" : "A"}`;
    const forged = parts.join(".");
    expect(verifyUnsubscribeToken(forged, SECRET)).toBeNull();
  });

  it("mantiene compatibilidad con tokens HMAC ya enviados", () => {
    const body = Buffer.from(JSON.stringify({
      e: "legacy@dtdcargo.com",
      t: "tenant-1",
      a: "newsletter",
    })).toString("base64url");
    const signature = createHmac("sha256", SECRET)
      .update(body)
      .digest("base64url");

    expect(verifyUnsubscribeToken(`${body}.${signature}`, SECRET)).toEqual({
      email: "legacy@dtdcargo.com",
      tenantId: "tenant-1",
      audience: "newsletter",
    });
  });

  it("transporta el token opaco dentro de la ruta", () => {
    const tok = signUnsubscribeToken(
      { email: "cliente@dtdcargo.com", tenantId: "tenant-1", audience: "newsletter" },
      SECRET,
    );
    const url = buildUnsubscribeUrl("https://dtdcargo.com/", tok);

    expect(url).toBe(`https://dtdcargo.com/api/email/unsubscribe/${encodeURIComponent(tok)}`);
    expect(url).not.toContain("?token=");
  });

  it("rechaza basura / vacío / sin punto", () => {
    expect(verifyUnsubscribeToken(null, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("sinpunto", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(".", SECRET)).toBeNull();
  });

  it("genera una huella estable sin exponer el token", () => {
    const tok = signUnsubscribeToken(
      { email: "cliente@dtdcargo.com", tenantId: "tenant-1", audience: "newsletter" },
      SECRET,
    );
    const fingerprint = unsubscribeTokenFingerprint(tok);
    expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(unsubscribeTokenFingerprint(tok)).toBe(fingerprint);
    expect(fingerprint).not.toContain(tok);
  });
});

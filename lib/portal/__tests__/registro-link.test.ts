/**
 * SDD-0646 · Token, hash, URL y textos del link de registro.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateRegistroToken, hashRegistroToken } from "../registro-link";
import {
  isRegistroTokenShape,
  registroLinkErrorKind,
  registroLinkMensajeFinal,
  registroLinkUrl,
  registroLinkWhatsAppText,
} from "../registro-link-types";

describe("token del link de registro", () => {
  it("tiene 256 bits y forma base64url", () => {
    const t = generateRegistroToken();
    expect(isRegistroTokenShape(t)).toBe(true);
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
  });

  it("no se repite", () => {
    const vistos = new Set(Array.from({ length: 200 }, generateRegistroToken));
    expect(vistos.size).toBe(200);
  });

  it("el hash es el sha256 hex que espera la base", () => {
    const t = generateRegistroToken();
    expect(hashRegistroToken(t)).toBe(createHash("sha256").update(t).digest("hex"));
    expect(hashRegistroToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("lo que no tiene forma de token se descarta", () => {
    expect(isRegistroTokenShape("DTD-8001")).toBe(false);
    expect(isRegistroTokenShape("a".repeat(42))).toBe(false);
    expect(isRegistroTokenShape(`${"a".repeat(42)}/`)).toBe(false);
    expect(isRegistroTokenShape(null)).toBe(false);
  });
});

describe("URL y textos", () => {
  it("⭐ la URL lleva sólo el token", () => {
    const t = generateRegistroToken();
    const url = registroLinkUrl(t);
    expect(url.endsWith(`/registro/link/${t}`)).toBe(true);
    expect(url).not.toMatch(/markbox|DTD-/i);
  });

  it("el mensaje de WhatsApp lleva el link y avisa que es personal", () => {
    const txt = registroLinkWhatsAppText("Ana", "https://x.test/registro/link/abc");
    expect(txt).toContain("Hola Ana");
    expect(txt).toContain("https://x.test/registro/link/abc");
    expect(txt).toMatch(/un solo uso/);
  });

  it("el mensaje final dice el código de siempre", () => {
    expect(registroLinkMensajeFinal("DTD-8001")).toBe(
      "¡Ya eras cliente de DTD Cargo! Este es tu código de siempre: DTD-8001. Ya puedes ver tu portal.",
    );
  });

  it.each([
    [{ code: "P0002", message: "link_invalido" }, "invalido"],
    [{ code: "23505", message: "correo_en_uso" }, "correo"],
    [{ code: "22023", message: "datos_incompletos" }, "datos"],
    [{ code: "XX000", message: "otra cosa" }, "otro"],
  ] as const)("traduce %o", (err, kind) => {
    expect(registroLinkErrorKind(err)).toBe(kind);
  });
});

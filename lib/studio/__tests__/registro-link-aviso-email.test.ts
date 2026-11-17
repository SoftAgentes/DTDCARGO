/**
 * SDD-0646 D-1 · El aviso al correo registrado con el link.
 * Reglas del DG: Shipping Mark y no nombre, «si no fuiste tú, escríbenos» con el
 * contacto de soporte, y ningún enlace de entrada.
 */
import { describe, expect, it } from "vitest";
import { CONTACT } from "@/lib/design-tokens";
import { registroLinkAvisoHtml } from "../registro-link-aviso-email";

describe("aviso al correo del registro por link", () => {
  const html = registroLinkAvisoHtml("DTD-8001");

  it("identifica por el Shipping Mark", () => {
    expect(html).toContain("<b>DTD-8001</b>");
  });

  it("⭐ no trae ningún enlace", () => {
    expect(html).not.toMatch(/<a\s|href=|https?:\/\//i);
  });

  it("dice «si no fuiste tú, escríbenos» con el contacto de soporte", () => {
    expect(html).toContain("Si no fuiste tú, escríbenos");
    expect(html).toContain(CONTACT.emailGeneral);
    expect(html).toContain(CONTACT.ve.whatsapp);
  });

  it("escapa el código", () => {
    expect(registroLinkAvisoHtml("<x>")).toContain("&lt;x&gt;");
  });
});

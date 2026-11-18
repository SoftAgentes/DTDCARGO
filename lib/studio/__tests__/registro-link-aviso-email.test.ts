/**
 * SDD-0646 D-1 (opción C) · El correo de comprobación del registro por link.
 *
 * Reglas: Shipping Mark y no nombre; «si no fuiste tú» con el contacto de
 * soporte; y UN solo enlace, el de comprobación, que no abre sesión ni da acceso
 * a nada.
 */
import { describe, expect, it } from "vitest";
import { CONTACT } from "@/lib/design-tokens";
import { comprobarCorreoUrl } from "@/lib/portal/correo-comprobacion";
import { registroLinkAvisoHtml } from "../registro-link-aviso-email";

describe("correo de comprobación del registro por link", () => {
  const url = comprobarCorreoUrl("T".repeat(43));
  const html = registroLinkAvisoHtml("DTD-8001", url);

  it("identifica por el Shipping Mark", () => {
    expect(html).toContain("<b>DTD-8001</b>");
  });

  it("⭐ trae un solo enlace: el de comprobación", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([url]);
    // Ninguna otra URL suelta en el texto.
    const urls = [...html.matchAll(/https?:\/\/[^\s"<]+/g)].map((m) => m[0]);
    expect(new Set(urls)).toEqual(new Set([url]));
  });

  it("⭐ ese enlace no es de entrada: no abre sesión ni lleva al portal", () => {
    expect(url).toMatch(/\/registro\/correo\/[A-Za-z0-9_-]{43}$/);
    expect(html).not.toMatch(/\/entrar|\/abrir|\/portal\/|\/auth\/v1|token_hash|type=magiclink|type=recovery/);
    expect(html).toContain("no abre tu portal");
  });

  it("⭐ la URL lleva sólo el token: ni el correo ni el Shipping Mark", () => {
    expect(url).not.toMatch(/@|DTD|8001|\?/);
  });

  it("dice «si no fuiste tú» con el contacto de soporte", () => {
    expect(html).toContain("Si no fuiste tú, no lo confirmes");
    expect(html).toContain(CONTACT.emailGeneral);
    expect(html).toContain(CONTACT.ve.whatsapp);
  });

  it("⭐ no invita a pedir un enlace de acceso con este correo ni a recuperar nada", () => {
    expect(html).not.toMatch(/enlace de acceso|recuperar|pide tu enlace|Entrar a mi portal|Ir a mi portal/i);
  });

  it("dice dónde abrirlo: donde el cliente ya tiene su portal abierto", () => {
    expect(html).toContain("donde ya entraste a tu portal");
  });

  it("escapa el código y la URL", () => {
    const sucio = registroLinkAvisoHtml("<x>", 'https://x.test/"onmouseover="y');
    expect(sucio).toContain("&lt;x&gt;");
    expect(sucio).not.toContain('"onmouseover="');
  });
});

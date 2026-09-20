// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildWhatsAppLink, buildGoogleMapsLink } from "@/lib/design-tokens";

/**
 * Tests de los URL builders. La preocupación de seguridad es que el mensaje
 * o dirección estén URL-encoded — sin esto, caracteres como `&`, `?`, `#`,
 * o espacios pueden romper la URL y, peor, permitir inyección de
 * parámetros (`text=hola&extra=...`).
 */
describe("buildWhatsAppLink", () => {
  it("incluye prefijo wa.me con número raw", () => {
    const url = buildWhatsAppLink("hola");
    expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  });

  it("URL-encode espacios y caracteres especiales", () => {
    const url = buildWhatsAppLink("Hola mundo & cosas");
    // & debería estar codificado como %26 (sino rompería el query string)
    expect(url).toContain("%20");
    expect(url).toContain("%26");
    expect(url).not.toContain(" & "); // sin espacios crudos
  });

  it("escapa intento de query injection", () => {
    const evil = "hola&phone=999&hack=1";
    const url = buildWhatsAppLink(evil);
    // El & adentro del mensaje debe estar codificado, no aparecer crudo.
    const queryPart = url.split("?text=")[1];
    expect(queryPart).not.toContain("&phone=");
    expect(queryPart).toContain("%26phone%3D");
  });
});

describe("buildGoogleMapsLink", () => {
  it("genera link de search con query encoded", () => {
    const url = buildGoogleMapsLink("Av. Bolívar 123, Valencia");
    expect(url).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
    );
    expect(url).toContain("%20"); // espacios codificados
    expect(url).toContain("%2C"); // coma codificada
  });

  it("escapa intento de protocol injection", () => {
    const evil = "javascript:alert(1)";
    const url = buildGoogleMapsLink(evil);
    // El payload va como query, no rompe el protocolo del builder.
    expect(url.startsWith("https://www.google.com/")).toBe(true);
    expect(url).toContain("javascript%3Aalert");
  });
});

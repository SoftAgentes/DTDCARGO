// @vitest-environment node
/**
 * Tests del mensaje "Guárdalo en mi WhatsApp" (SDD-0254).
 *
 * Dos cosas se vigilan acá, y ninguna es cosmética:
 *   1. **Qué datos viajan.** El texto va en el query string de `wa.me`; que se
 *      cuele el correo o la cédula sería una fuga, no un detalle de copy.
 *   2. **El voseo.** Es regla dura del founder y el copy de cara al cliente es
 *      justo donde se escapa.
 */

import { describe, expect, it } from "vitest";
import { buildMarkboxWhatsAppMessage } from "../markbox-whatsapp";

describe("buildMarkboxWhatsAppMessage", () => {
  it("saluda con el nombre de pila y trae el Shipping Mark", () => {
    const msg = buildMarkboxWhatsAppMessage("DTD-9048", "Jessilen");
    expect(msg).toBe(
      "Hola, soy Jessilen. Acabo de registrarme en DTD Cargo y mi Shipping Mark es DTD-9048.",
    );
  });

  it("sin nombre no deja un saludo colgando", () => {
    // El bug obvio sería "Hola, soy ." — feo y delata que falta un dato.
    const msg = buildMarkboxWhatsAppMessage("DTD-9048");
    expect(msg).toBe(
      "Hola. Acabo de registrarme en DTD Cargo y mi Shipping Mark es DTD-9048.",
    );
    expect(msg).not.toContain("soy .");
  });

  it("un nombre en blanco se trata como ausente", () => {
    expect(buildMarkboxWhatsAppMessage("DTD-9048", "   ")).toBe(
      buildMarkboxWhatsAppMessage("DTD-9048"),
    );
  });

  it("NO filtra correo, teléfono, cédula ni dirección", () => {
    // El texto viaja en el query string de wa.me. Lo que no está acá no se fuga.
    const msg = buildMarkboxWhatsAppMessage("DTD-9048", "Jessilen");
    expect(msg).not.toMatch(/@/);
    expect(msg).not.toMatch(/\d{7,}/); // teléfonos y cédulas
    expect(msg).not.toMatch(/\b[VEJGP]-?\d{6,}/i); // cédula / RIF venezolano
  });

  it("usa tuteo venezolano, cero voseo", () => {
    const msg = buildMarkboxWhatsAppMessage("DTD-9048", "Jessilen");
    // Imperativos y formas voseantes que serían un bug de tono.
    expect(msg).not.toMatch(/\b(sos|tenés|podés|querés|necesitás|mirá|dale)\b/i);
  });

  it("no le mete espacios de más al código", () => {
    expect(buildMarkboxWhatsAppMessage("  DTD-1010  ", "Abdal")).toContain(
      "es DTD-1010.",
    );
  });
});

/**
 * Tests del asesor asignado del portal (ERP→Norte · clients.advisor_id).
 *
 * Cubre la lógica PURA de presentación de la card "Tu asesor" de /portal/mensajes:
 *  - `toWhatsAppRaw`: normaliza un teléfono a formato wa.me (solo dígitos) o null.
 *  - `buildAdvisorCardModel`: decide qué mostrar y a qué número apunta el CTA según
 *    haya asesor asignado, tenga o no teléfono. La resolución de DATOS
 *    (`getPortalAdvisor`) es admin-scopeada y se cubre por integración aparte.
 */
import { describe, it, expect } from "vitest";
import {
  buildAdvisorCardModel,
  toWhatsAppRaw,
  type PortalAdvisor,
} from "../portal-types";

const PUBLIC_RAW = "584121668021";

const ADVISOR: PortalAdvisor = {
  name: "José Méndez",
  phone: "+58 414 123 4567",
  avatarUrl: null,
  positionLabel: "Asesor comercial",
};

describe("toWhatsAppRaw — normaliza teléfono a wa.me", () => {
  it("deja solo dígitos de un número con espacios y +", () => {
    expect(toWhatsAppRaw("+58 414 123 4567")).toBe("584141234567");
  });

  it("null / vacío → null", () => {
    expect(toWhatsAppRaw(null)).toBeNull();
    expect(toWhatsAppRaw(undefined)).toBeNull();
    expect(toWhatsAppRaw("")).toBeNull();
  });

  it("muy corto (< 8 dígitos) → null (no es marcable)", () => {
    expect(toWhatsAppRaw("123-456")).toBeNull();
  });
});

describe("buildAdvisorCardModel — card 'Tu asesor'", () => {
  it("asesor con teléfono → su nombre + WhatsApp a SU número", () => {
    const m = buildAdvisorCardModel(ADVISOR, PUBLIC_RAW);
    expect(m.isReal).toBe(true);
    expect(m.name).toBe("José Méndez");
    expect(m.positionLabel).toBe("Asesor comercial");
    expect(m.whatsappRaw).toBe("584141234567");
  });

  it("asesor sin teléfono → su nombre, pero el WhatsApp cae al CRM público", () => {
    const m = buildAdvisorCardModel({ ...ADVISOR, phone: null }, PUBLIC_RAW);
    expect(m.isReal).toBe(true);
    expect(m.name).toBe("José Méndez");
    expect(m.whatsappRaw).toBe(PUBLIC_RAW);
  });

  it("asesor con teléfono no marcable → fallback al CRM público", () => {
    const m = buildAdvisorCardModel({ ...ADVISOR, phone: "n/a" }, PUBLIC_RAW);
    expect(m.isReal).toBe(true);
    expect(m.whatsappRaw).toBe(PUBLIC_RAW);
  });

  it("sin asesor asignado → fallback completo al contacto público", () => {
    const m = buildAdvisorCardModel(null, PUBLIC_RAW);
    expect(m.isReal).toBe(false);
    expect(m.name).toBeNull();
    expect(m.positionLabel).toBeNull();
    expect(m.avatarUrl).toBeNull();
    expect(m.whatsappRaw).toBe(PUBLIC_RAW);
  });
});

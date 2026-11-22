import { describe, expect, it } from "vitest";
import { CANAL_LABEL, canalConChat, canalDeTarjeta } from "../crm-canal";

describe("canalDeTarjeta (SDD-0648 §2)", () => {
  it.each([
    ["whatsapp_leads", "whatsapp"],
    ["whatsapp_clientes", "whatsapp"],
    ["instagram", "instagram"],
    ["messenger", "facebook"],
    ["correo", "correo"],
    ["portal", "dtd"],
    ["web_registro", "dtd"],
    ["cotizador", "dtd"],
    ["carga_erp", "dtd"],
  ] as const)("%s → %s", (fuente, canal) => {
    expect(canalDeTarjeta(fuente, null)).toBe(canal);
  });

  it("Kommo, manual, vacía o desconocida no pintan logo", () => {
    expect(canalDeTarjeta("kommo")).toBeNull();
    expect(canalDeTarjeta("manual")).toBeNull();
    expect(canalDeTarjeta("")).toBeNull();
    expect(canalDeTarjeta(null)).toBeNull();
    expect(canalDeTarjeta("telegram")).toBeNull();
  });

  it("TikTok sale de utm_source solo en fuentes web (D4)", () => {
    expect(canalDeTarjeta("web_registro", "tiktok")).toBe("tiktok");
    expect(canalDeTarjeta("portal", "TikTok_Ads")).toBe("tiktok");
    expect(canalDeTarjeta("web_registro", "instagram")).toBe("dtd");
    // Un lead de WhatsApp con utm de TikTok sigue siendo WhatsApp: la fuente manda.
    expect(canalDeTarjeta("whatsapp_leads", "tiktok")).toBe("whatsapp");
  });

  it("cada canal tiene nombre para lectores de pantalla", () => {
    for (const label of Object.values(CANAL_LABEL)) expect(label.length).toBeGreaterThan(0);
  });

  it("solo los canales de Chatwoot ofrecen chat sin ficha", () => {
    expect(canalConChat("whatsapp")).toBe(true);
    expect(canalConChat("correo")).toBe(true);
    expect(canalConChat("dtd")).toBe(false);
    expect(canalConChat("tiktok")).toBe(false);
    expect(canalConChat(null)).toBe(false);
  });
});

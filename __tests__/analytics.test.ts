import { describe, expect, it } from "vitest";
import {
  isPrivatePath,
  sanitizePath,
  sanitizeSearch,
  WHATSAPP_LINK_RE,
  WHATSAPP_SHARE_RE,
} from "@/components/Analytics";

/**
 * Capa de medición (GA4 + Google Ads) — components/Analytics.tsx.
 *
 * Estos tests DOCUMENTAN la decisión de qué rutas quedan fuera de Google
 * (regla founder: GA fuera de rutas privadas / PII) y protegen el matcher de
 * la conversión "Click WhatsApp". Si agregas una superficie nueva con datos
 * de cliente en la URL, agregala a PRIVATE_PREFIXES Y a este test.
 */

describe("isPrivatePath — GA no carga en rutas con PII", () => {
  it.each([
    "/studio",
    "/studio/clientes",
    "/portal",
    "/portal/perfil",
    "/m",
    "/m/cn",
    "/back",
    "/invitar",
    // Ampliación 2026-07-05 (fuga PII detectada):
    "/verificar", // ?c=<Shipping Mark | folio>
    "/p/abc123", // packing list con token capability (SDD-0096)
    "/interno",
    "/interno/marca",
    "/marca",
    "/marca/brand-book",
    // gtag manda `dl`/título crudos en CADA hit → el código del cliente
    // solo queda estanco NO cargando el tag en la página del código:
    "/track/DTD-1004",
    "/track/S-2026-0142/algo",
    // Iframe del FAB del portal (clientes ya captados) · Fase 3: /fcl/embed:
    "/fcl/embed",
  ])("excluye %s", (path) => {
    expect(isPrivatePath(path)).toBe(true);
  });

  it.each([
    "/",
    "/servicios",
    "/fcl",
    "/contacto",
    "/registro",
    "/track", // el buscador ES público; solo la página del código se excluye
    "/track/",
    "/noticias/importar-de-china",
    // El match por prefijo NO debe comerse rutas públicas parecidas:
    "/marcas", // ≠ /marca
    "/pedidos", // ≠ /p
    "/verificado", // ≠ /verificar
    "/internacional", // ≠ /interno
    "/menu", // ≠ /m
  ])("NO excluye %s", (path) => {
    expect(isPrivatePath(path)).toBe(false);
  });
});

describe("sanitizeSearch — whitelist de query params (PII nunca sale)", () => {
  it("deja pasar SOLO atribución (utm/origen/click IDs)", () => {
    const qs = new URLSearchParams(
      "utm_source=instagram&utm_medium=bio&utm_campaign=enlaces&origen=ddp&gclid=abc123",
    );
    expect(sanitizeSearch(qs)).toBe(
      "utm_source=instagram&utm_medium=bio&utm_campaign=enlaces&origen=ddp&gclid=abc123",
    );
  });

  it("bota los params con datos de cliente", () => {
    expect(sanitizeSearch(new URLSearchParams("est=EST-0042"))).toBe("");
    expect(sanitizeSearch(new URLSearchParams("ref=REF-XYZ"))).toBe("");
    expect(sanitizeSearch(new URLSearchParams("c=DTD-1004"))).toBe("");
    expect(sanitizeSearch(new URLSearchParams("token=secreto"))).toBe("");
  });

  it("mezcla: conserva la atribución, bota lo demás", () => {
    const qs = new URLSearchParams("utm_campaign=enlaces&est=EST-0042&ref=REF-1");
    expect(sanitizeSearch(qs)).toBe("utm_campaign=enlaces");
  });

  it("query vacío → cadena vacía", () => {
    expect(sanitizeSearch(new URLSearchParams(""))).toBe("");
  });
});

describe("sanitizePath — redacción del código de tracking", () => {
  it("redacta el código de /track/[code]", () => {
    expect(sanitizePath("/track/DTD-1004")).toBe("/track/[code]");
    expect(sanitizePath("/track/abc123xyz")).toBe("/track/[code]");
  });

  it("preserva sub-rutas después del código", () => {
    expect(sanitizePath("/track/DTD-1004/extra")).toBe("/track/[code]/extra");
  });

  it("no toca /track pelado ni el resto del sitio", () => {
    expect(sanitizePath("/track")).toBe("/track");
    expect(sanitizePath("/track/")).toBe("/track/");
    expect(sanitizePath("/")).toBe("/");
    expect(sanitizePath("/servicios")).toBe("/servicios");
    // No es un replace global: /track debe ir al inicio del path.
    expect(sanitizePath("/noticias/track/algo")).toBe("/noticias/track/algo");
  });
});

describe("WHATSAPP_LINK_RE — matcher de la conversión Click WhatsApp", () => {
  it.each([
    "https://wa.me/584121668021?text=Hola",
    "https://api.whatsapp.com/send?phone=584121668021",
    "whatsapp://send?text=Hola",
  ])("matchea %s", (href) => {
    expect(WHATSAPP_LINK_RE.test(href)).toBe(true);
  });

  it.each([
    "https://dtdcargo.com/servicios",
    "https://t.me/DTDStudioBot",
    "mailto:info@dtdcargo.com",
  ])("NO matchea %s", (href) => {
    expect(WHATSAPP_LINK_RE.test(href)).toBe(false);
  });
});

describe("WHATSAPP_SHARE_RE — compartir ≠ contactar", () => {
  it("detecta el link de COMPARTIR (wa.me/?text sin número)", () => {
    expect(
      WHATSAPP_SHARE_RE.test("https://wa.me/?text=Mira%20mi%20envio"),
    ).toBe(true);
  });

  it("NO marca como share el contacto real a DTD (con número)", () => {
    expect(
      WHATSAPP_SHARE_RE.test("https://wa.me/584121668021?text=Hola"),
    ).toBe(false);
  });
});

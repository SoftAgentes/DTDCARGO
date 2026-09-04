import { describe, expect, it } from "vitest";
import {
  isAnalyticsExcludedUrl,
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
    // Puertas públicas que transportan capabilities o datos de acceso.
    "/acceso",
    "/acceso/token-sintetico-analytics",
    "/entrar",
    "/entrar/codigo-sintetico-analytics",
    "/abrir",
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
    // Iframes del FAB del portal (clientes ya captados): calc CBM/LCL + FCL.
    "/tarifas/embed",
    "/fcl/embed",
  ])("excluye %s", (path) => {
    expect(isPrivatePath(path)).toBe(true);
  });

  it.each([
    "/",
    "/servicios",
    "/tarifas", // la calc pública SÍ se mide (la del embed no)
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
    "/accesorios", // ≠ /acceso
    "/entradas", // ≠ /entrar
    "/abrigos", // ≠ /abrir
  ])("NO excluye %s", (path) => {
    expect(isPrivatePath(path)).toBe(false);
  });
});

describe("isAnalyticsExcludedUrl — la URL completa decide si Google carga", () => {
  it.each([
    ["/registro", "ref=REF-SINTETICO-0001", ""],
    ["/registro", "est=EST-SINTETICO-0001", ""],
    ["/servicios", "token=secreto-sintetico", ""],
    ["/servicios", "code=codigo-sintetico", ""],
    ["/servicios", "email=persona%40example.com", ""],
    ["/servicios", "", "#access_token=token-sintetico"],
    ["/servicios", "", "#refresh_token=token-sintetico"],
  ])("excluye %s?%s%s", (pathname, query, hash) => {
    expect(
      isAnalyticsExcludedUrl(pathname, new URLSearchParams(query), hash),
    ).toBe(true);
  });

  it.each([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "origen",
    "gclid",
    "gbraid",
    "wbraid",
  ])("excluye una credencial anidada en el valor permitido %s", (key) => {
    expect(
      isAnalyticsExcludedUrl(
        "/servicios",
        new URLSearchParams(
          `${key}=access_token%3Dtoken-sintetico-analytics`,
        ),
      ),
    ).toBe(true);
  });

  it.each([
    "#id_token=token-sintetico",
    "#auth_token=token-sintetico",
    "#session_token=token-sintetico",
    "#client_secret=secreto-sintetico",
    "#IDToken=token-sintetico",
    "#id[token]=token-sintetico",
    "#id_token[]=token-sintetico",
    "#payload=id_token=token-sintetico",
    "#%7B%22payload%22%3A%22id_token%3Dtoken-sintetico%22%7D",
    "#id%5Ftoken%3Dtoken-sintetico",
    "#id%255Ftoken%253Dtoken-sintetico",
  ])("excluye el fragmento con credencial %s", (hash) => {
    expect(
      isAnalyticsExcludedUrl(
        "/servicios",
        new URLSearchParams(),
        hash,
      ),
    ).toBe(true);
  });

  it("excluye una credencial con doble codificación dentro de un UTM", () => {
    expect(
      isAnalyticsExcludedUrl(
        "/servicios",
        new URLSearchParams(
          "utm_campaign=id_token%253Dtoken-sintetico-analytics",
        ),
      ),
    ).toBe(true);
  });

  it.each([
    "utm_campaign=payload%3Did_token%3Dtoken-sintetico",
    "utm_campaign=IDToken%3Dtoken-sintetico",
  ])("excluye la credencial anidada o normalizada en %s", (query) => {
    expect(
      isAnalyticsExcludedUrl(
        "/servicios",
        new URLSearchParams(query),
      ),
    ).toBe(true);
  });

  it("falla cerrado ante un fragmento mal codificado", () => {
    expect(
      isAnalyticsExcludedUrl(
        "/servicios",
        new URLSearchParams(),
        "#campana-50%",
      ),
    ).toBe(true);
  });

  it("conserva la medición con atribución explícitamente permitida", () => {
    expect(
      isAnalyticsExcludedUrl(
        "/servicios",
        new URLSearchParams(
          "utm_source=instagram&utm_campaign=prueba&gclid=click-sintetico",
        ),
        "#cotizar",
      ),
    ).toBe(false);
  });

  it("no confunde texto de campaña ni hashes ordinarios con credenciales", () => {
    expect(
      isAnalyticsExcludedUrl(
        "/servicios",
        new URLSearchParams(
          "utm_campaign=access-token-launch&utm_content=tokenization-guide&gclid=click-sintetico",
        ),
        "#guia-token",
      ),
    ).toBe(false);
  });

  it("permite un porcentaje literal dentro de un UTM legítimo", () => {
    expect(
      isAnalyticsExcludedUrl(
        "/servicios",
        new URLSearchParams("utm_campaign=descuento-50%25"),
      ),
    ).toBe(false);
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
  it.each([
    ["/acceso/token-sintetico", "/acceso/[token]"],
    ["/entrar/codigo-sintetico", "/entrar/[code]"],
  ])("redacta credenciales en %s", (path, expected) => {
    expect(sanitizePath(path)).toBe(expected);
  });

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

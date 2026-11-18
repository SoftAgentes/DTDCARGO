/**
 * SDD-0657 · Ninguna página del sitemap queda sin enlaces internos.
 *
 * El 2026-11-18 se contaron los enlaces entrantes de las 48 URL del sitemap:
 * `/puerta-a-puerta`, `/llenado`, `/brochure` y `/calculadora-terrestre` no
 * tenían ninguno, y a `/importar-de-china` solo la enlazaban sus propias
 * ciudades. Search Console las tenía en «Descubierta: actualmente sin indexar».
 * El pie es el único bloque presente en todas las páginas públicas, así que es
 * la red mínima: lo que no esté aquí tiene que estar en las fichas de servicio
 * que la portada enlaza con `svcHref`.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";
import { svcHref } from "./servicios/svcHref";

// El sitemap lee las noticias de la base; aquí solo importan las rutas fijas.
vi.mock("@/lib/public/news-queries", () => ({ listPublishedPosts: async () => [] }));

afterEach(cleanup);

function hrefs(container: HTMLElement): Set<string> {
  return new Set(
    [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? ""),
  );
}

describe("Footer · enlaces a las páginas que estaban huérfanas (SDD-0657)", () => {
  it("enlaza puerta a puerta, el hub de ciudades, las tres calculadoras y el brochure", () => {
    const { container } = render(<Footer />);
    const enlazadas = hrefs(container);
    for (const ruta of [
      "/puerta-a-puerta",
      "/importar-de-china",
      "/fcl",
      "/llenado",
      "/calculadora-terrestre",
      "/brochure",
    ]) {
      expect(enlazadas.has(ruta), ruta).toBe(true);
    }
  });

  it("cada ruta fija del sitemap tiene enlace en el pie o es una ficha de servicio de la portada", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
    const rutas = (await sitemap())
      .map((entrada) => entrada.url.slice(base.length) || "/")
      // La portada no necesita enlace; las ciudades las enlaza su hub y las
      // noticias, /noticias.
      .filter((ruta) => ruta !== "/" && !ruta.startsWith("/importar-de-china/") && !ruta.startsWith("/noticias/"));

    const { container } = render(<Footer />);
    const enlazadas = hrefs(container);
    // Las cuatro fichas con ruta propia: la portada las enlaza con svcHref.
    const fichas = new Set(
      ["puerta-a-puerta", "consolidado-lcl", "fcl", "inspeccion-en-fabrica"].map(svcHref),
    );

    // Piso: un sitemap vacío dejaría esta prueba en verde sin probar nada.
    expect(rutas.length).toBeGreaterThan(20);
    expect(rutas.filter((ruta) => !enlazadas.has(ruta) && !fichas.has(ruta))).toEqual([]);
  });
});

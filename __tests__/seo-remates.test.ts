import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Remates SEO 2026-07-05 (feature "seo-remates") — 5 pendientes del
 * diagnóstico (docs/marketing/seo.md · entradas 2026-06-14 / 2026-07-05):
 *
 *  1+3. /estimacion y /nosotros dejan de ser huérfanas (links internos
 *       reales: CTA en /calculadora + Footer).
 *  2.   OG image dinámica por artículo en /noticias/[slug] (file convention
 *       opengraph-image.tsx) — sin la imagen genérica en config metadata.
 *  4.   /brochure sin VideoObject duplicado (WorkBand lo apaga vía prop).
 *  5.   sitemap sin lastModified "siempre hoy" en rutas estáticas.
 *
 * Tests a nivel de fuente (mismo patrón que app/estimacion/__tests__/
 * fase-a-renames.test.ts): validan el cableado sin levantar Next. El render
 * en runtime lo cubre el smoke E2E.
 */

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("Fase 3 · calc unificada en /tarifas + Footer sin /estimacion", () => {
  it("la calc pública vive en /tarifas (2-en-1) con CTA WhatsApp directo (sin captura)", () => {
    const page = read("app/tarifas/page.tsx");
    expect(page).toContain("TarifasTabs");
    const tabs = read("components/TarifasTabs.tsx");
    // LCL en modo WhatsApp directo (no EstimadoModal / no /api/public/estimacion).
    expect(tabs).toContain("directWhatsApp");
    expect(tabs).toContain("CotizadorFletes");
    expect(page).not.toContain("EstimadoModal");
  });

  it("el Footer enlaza a /nosotros y ya NO a /estimacion (→ 301 /tarifas)", () => {
    const footer = read("components/Footer.tsx");
    expect(footer).toContain('href="/nosotros"');
    expect(footer).not.toContain('href="/estimacion"');
  });

  it("las rutas viejas de calc/estimación se eliminaron (viven como 301 → /tarifas)", () => {
    for (const p of [
      "app/calculadora/page.tsx",
      "app/calculadora-fcl/page.tsx",
      "app/cotizador-flete/page.tsx",
      "app/estimacion/page.tsx",
    ]) {
      expect(existsSync(resolve(root, p))).toBe(false);
    }
    const cfg = read("next.config.ts");
    expect(cfg).toContain('source: "/estimacion", destination: "/tarifas"');
    expect(cfg).toContain('source: "/calculadora", destination: "/tarifas"');
  });
});

describe("remate 2 · OG image por artículo en /noticias/[slug]", () => {
  it("existe la file convention opengraph-image.tsx", () => {
    expect(
      existsSync(resolve(root, "app/noticias/[slug]/opengraph-image.tsx")),
    ).toBe(true);
    const og = read("app/noticias/[slug]/opengraph-image.tsx");
    expect(og).toContain('from "next/og"');
    // 1200×630 (tamaño canónico OG)
    expect(og).toContain("width: 1200");
    expect(og).toContain("height: 630");
    // Prohibido fetch de fuentes en runtime (regla del remate)
    expect(og).not.toContain("fonts.googleapis.com");
    expect(og).not.toContain("fonts.gstatic.com");
  });

  it("generateMetadata del post ya NO fija la OG genérica (manda la file convention)", () => {
    const page = read("app/noticias/[slug]/page.tsx");
    expect(page).not.toContain("BRAND_ASSETS.ogImage");
    expect(page).not.toContain("images:");
  });

  it("el JSON-LD NewsArticle apunta a la OG dinámica, no al isólogo 741×764", () => {
    const jsonLd = read("app/noticias/[slug]/_components/NewsArticleJsonLd.tsx");
    expect(jsonLd).toContain("/opengraph-image");
    expect(jsonLd).not.toContain(
      "ogImageUrl = `${siteUrl}/brand/dtdcargo-isologo-primary.png`",
    );
  });
});

describe("remate 4 · /brochure sin VideoObject duplicado", () => {
  it("WorkBand acepta noVideoSchema y condiciona el <script> JSON-LD", () => {
    const wb = read("components/WorkBand.tsx");
    expect(wb).toContain("noVideoSchema");
    expect(wb).toContain("!noVideoSchema &&");
  });

  it("/brochure apaga el schema en WorkBand (queda solo el de OperationGallery)", () => {
    const page = read("app/brochure/page.tsx");
    expect(page).toContain("<WorkBand noVideoSchema />");
    expect(page).toContain("<OperationGallery />");
  });

  it("el home queda intacto (OperationGallery sin prop = emite su VideoObject)", () => {
    const home = read("app/page.tsx");
    expect(home).toContain("<OperationGallery />");
    expect(home).not.toContain("WorkBand");
  });
});

describe("remate 5 · sitemap con lastModified honesto", () => {
  it("las rutas estáticas/geo omiten lastModified (nada de `new Date()` global)", () => {
    const sm = read("app/sitemap.ts");
    expect(sm).not.toContain("lastModified: now");
    expect(sm).not.toContain("const now =");
  });

  it("los posts SÍ conservan su fecha real", () => {
    const sm = read("app/sitemap.ts");
    expect(sm).toContain("lastModified: new Date(post.date)");
  });
});

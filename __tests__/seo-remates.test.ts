// @vitest-environment node
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

describe("calc CBM/LCL en /tarifas + FCL en /fcl + Footer sin /estimacion", () => {
  it("/tarifas monta la calc CBM/LCL con sus 2 pestañas (sin EstimadoModal)", () => {
    const page = read("app/tarifas/page.tsx");
    expect(page).toContain("TarifasTabs");
    expect(page).toContain("getPublicCbmRate");
    expect(page).not.toContain("EstimadoModal");

    const tabs = read("components/TarifasTabs.tsx");
    // Pestaña A = Puerta a Puerta (DDP) · Pestaña B = LCL Consolidado.
    expect(tabs).toContain("CalculadoraForm");
    expect(tabs).toContain("Puerta a Puerta");
    expect(tabs).toContain("LCL Consolidado");
    expect(tabs).toContain('modo="consolidado"');
    // Las dos con CTA WhatsApp directo — la calc NO guarda nada.
    expect(tabs).toContain("directWhatsApp");
    expect(tabs).not.toContain("EstimadoModal");
  });

  it("/fcl sigue siendo SOLO FCL — nunca la calculadora de CBM/LCL", () => {
    // Lo que este caso protege es la SEPARACIÓN: el LCL/CBM vive en /tarifas y el
    // contenedor completo en /fcl. Mezclarlos confunde al cliente y canibaliza el
    // SEO de las dos páginas.
    //
    // El motor del FCL cambió en SDD-0292: era <CotizadorFletes> (tarifas de
    // SeaRates, que cerró) y ahora es <FclCalculator> (tarifas PROPIAS, vía
    // `public_fcl_rates`). La aserción se actualizó con él — lo que no cambia es
    // que en esta página no puede aparecer la calc de CBM.
    const page = read("app/fcl/page.tsx");
    expect(page).toContain("FclCalculator");
    expect(page).not.toContain("CalculadoraForm");
    expect(page).not.toContain("TarifasTabs");
  });

  it("el Footer enlaza a /nosotros y ya NO a /estimacion (→ 301 /tarifas)", () => {
    const footer = read("components/Footer.tsx");
    expect(footer).toContain('href="/nosotros"');
    expect(footer).not.toContain('href="/estimacion"');
  });

  it("las rutas viejas de calc/estimación se eliminaron y hacen 301 a la calc que toca", () => {
    for (const p of [
      "app/calculadora/page.tsx",
      "app/calculadora-fcl/page.tsx",
      "app/cotizador-flete/page.tsx",
      "app/estimacion/page.tsx",
    ]) {
      expect(existsSync(resolve(root, p))).toBe(false);
    }
    const cfg = read("next.config.ts");
    // CBM/LCL → /tarifas
    expect(cfg).toContain('source: "/estimacion", destination: "/tarifas"');
    expect(cfg).toContain('source: "/cotizar", destination: "/tarifas"');
    expect(cfg).toContain('source: "/calculadora", destination: "/tarifas"');
    expect(cfg).toContain(
      'source: "/calculadora/embed", destination: "/tarifas/embed"',
    );
    // FCL → /fcl (no se toca)
    expect(cfg).toContain('source: "/calculadora-fcl", destination: "/fcl"');
    expect(cfg).toContain('source: "/cotizador-flete", destination: "/fcl"');
    // /tarifas existe otra vez → su 301 al FCL se retiró.
    expect(cfg).not.toContain('source: "/tarifas", destination: "/fcl"');
    expect(cfg).not.toContain('source: "/tarifas/embed", destination: "/fcl/embed"');
  });

  it("los embeds de calc (tarifas + fcl) llevan headers SAMEORIGIN", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain('source: "/tarifas/embed"');
    expect(cfg).toContain('source: "/fcl/embed"');
    // El catch-all de headers debe excluir AMBOS (si no, les pisa el DENY).
    expect(cfg).toContain("tarifas/embed|fcl/embed");
  });

  it("el nav público apunta a la calc CBM/LCL; el FAB del portal a FCL (founder 2026-07-22)", () => {
    // SDD-0473: la lista de enlaces vive en NavClient.tsx; Nav.tsx es el envoltorio de
    // servidor que decide si el menú lleva el cotizador.
    expect(read("components/NavClient.tsx")).toContain('{ href: "/tarifas", label: "Tarifas" }');
    const fab = read("app/portal/_components/PortalCalcFab.tsx");
    expect(fab).toContain("/fcl/embed?theme=");
    expect(fab).not.toContain('src={`/tarifas/embed');
  });

  it("Cotizar un servicio abre FCL; el acceso genérico conserva Rápida por defecto", () => {
    const fab = read("app/portal/_components/PortalCalcFab.tsx");
    const sidebar = read("app/portal/_components/PortalSidebar.tsx");

    expect(fab).toContain('useState<Tab>("rapida")');
    expect(fab).toContain('requestedTab === "rapida" || requestedTab === "fcl"');
    expect(sidebar).toContain(
      'new CustomEvent("portal:open-calc", { detail: { tab } })',
    );

    const quoteCta = sidebar.slice(
      sidebar.indexOf('key: "cotizar"'),
      sidebar.indexOf("];", sidebar.indexOf('key: "cotizar"')),
    );
    expect(quoteCta).toContain('label: "Cotizar un servicio"');
    expect(quoteCta).toContain('calcTab: "fcl"');
  });

  it("el ERP revalida /tarifas (la ruta que consume public_cbm_rate)", () => {
    for (const p of [
      "app/studio/(app)/admin/calculator-actions.ts",
      "app/studio/(app)/tarifas/actions.ts",
    ]) {
      const src = read(p);
      expect(src).toContain('revalidatePath("/tarifas")');
      expect(src).not.toContain('revalidatePath("/fcl")');
    }
  });
});

describe("/markbox → /shipping-mark (rename con 301)", () => {
  it("la página vive en app/shipping-mark y la vieja ya no existe", () => {
    expect(existsSync(resolve(root, "app/shipping-mark/page.tsx"))).toBe(true);
    expect(existsSync(resolve(root, "app/markbox/page.tsx"))).toBe(false);
  });

  it("canonical, JSON-LD y breadcrumb apuntan a /shipping-mark", () => {
    const page = read("app/shipping-mark/page.tsx");
    expect(page).toContain('canonical: "/shipping-mark"');
    expect(page).toContain('path: "/shipping-mark"');
    expect(page).toContain("${SITE_URL}/shipping-mark");
    // "Cómo trabajamos" (<HowWeWork/>) se retiró del sitio el 2026-07-20: el
    // proceso se cuenta en un solo lugar (los 8 pasos de esta página) y el
    // nombre sobrevive como enlace del menú Ayuda hacia /shipping-mark.
    expect(page).not.toContain("<HowWeWork />");
    // GEO conservado del build anterior.
    expect(page).toContain("RespuestaRapida");
    expect(page).toContain("WebPageJsonLd");
  });

  it("next.config hace 301 de /markbox y el sitemap lista /shipping-mark", () => {
    expect(read("next.config.ts")).toContain(
      'source: "/markbox", destination: "/shipping-mark"',
    );
    const sm = read("app/sitemap.ts");
    expect(sm).toContain("/shipping-mark");
    expect(sm).not.toContain("/markbox");
    expect(sm).toContain("/tarifas");
    expect(sm).toContain("/fcl");
  });

  it("el Footer enlaza la página nueva", () => {
    const footer = read("components/Footer.tsx");
    expect(footer).toContain('href="/shipping-mark"');
    expect(footer).not.toContain('href="/markbox"');
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

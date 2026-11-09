// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WebPageJsonLd } from "@/components/WebPageJsonLd";
import { NewsArticleJsonLd } from "@/app/noticias/[slug]/_components/NewsArticleJsonLd";
import type { NewsPostRow } from "@/lib/news/types";

/**
 * Auditoría SEO, GEO y AEO del 2026-11-07, medida sobre dtdcargo.com.
 *
 * Dos defectos de datos estructurados que se veían en el sitio publicado:
 *  1. Las 5 páginas con nodo `WebPage` (/, /tarifas, /fcl, /puerta-a-puerta y
 *     /shipping-mark) lo publicaban sin `name`.
 *  2. El `publisher.logo` del `NewsArticle` decía 512×512; el isólogo mide
 *     741×764, como ya declara el #organization del layout.
 */

const root = process.cwd();

function ldOf(html: string): Record<string, unknown> {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(m, "el componente no emitió JSON-LD").not.toBeNull();
  return JSON.parse(m![1]) as Record<string, unknown>;
}

/** Ancho y alto reales de un PNG, leídos de su cabecera IHDR. */
function pngSize(publicPath: string): { width: number; height: number } {
  const buf = readFileSync(join(root, "public", publicPath));
  expect(buf.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("WebPage JSON-LD lleva el nombre de la página", () => {
  it("emite name y description cuando la página los da", () => {
    const ld = ldOf(
      renderToStaticMarkup(
        <WebPageJsonLd path="/fcl" name="Calculadora FCL" description="Descripción de prueba" />,
      ),
    );
    expect(ld["@type"]).toBe("WebPage");
    expect(ld.name).toBe("Calculadora FCL");
    expect(ld.description).toBe("Descripción de prueba");
  });

  it("todas las páginas que lo usan le pasan name y description", () => {
    const usos: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "node_modules") walk(rel);
        } else if (e.name.endsWith(".tsx")) {
          const src = readFileSync(join(root, rel), "utf8");
          // `\s+path=` deja fuera las menciones en comentarios (`<WebPageJsonLd>`).
          for (const m of src.matchAll(/<WebPageJsonLd\s+path=[\s\S]*?\/>/g)) usos.push(`${rel} ${m[0]}`);
        }
      }
    };
    walk("app");
    // Piso: si el patrón dejara de encontrar los usos, la prueba no puede salir verde.
    expect(usos.length).toBeGreaterThanOrEqual(5);
    for (const uso of usos) {
      expect(uso, uso).toMatch(/\sname=\{/);
      expect(uso, uso).toMatch(/\sdescription=\{/);
    }
  });
});

describe("NewsArticle JSON-LD declara el logo con sus medidas reales", () => {
  const post: NewsPostRow = {
    id: "1",
    slug: "prueba",
    tipo: "informativo",
    categoria: "como-llega-tu-mercancia",
    title: "Título",
    excerpt: "Resumen",
    body_markdown: "Cuerpo del artículo.",
    author_name: "DTD Cargo",
    author_role: null,
    focus_keyword: null,
    secondary_keywords: [],
    meta_description: null,
    pain_points: [],
    date: "2026-11-01",
    read_time_min: 1,
    published: true,
    source: "manual",
    created_at: "2026-11-01",
  };

  it("width y height del publisher.logo son los del archivo", () => {
    const ld = ldOf(renderToStaticMarkup(<NewsArticleJsonLd post={post} />));
    const logo = (ld.publisher as { logo: { url: string; width: number; height: number } }).logo;
    const real = pngSize(new URL(logo.url).pathname);
    expect({ width: logo.width, height: logo.height }).toEqual(real);
  });

  it("coinciden con el logo del #organization en app/layout.tsx", () => {
    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
    const m = layout.match(/logo:\s*\{[\s\S]*?width:\s*(\d+),\s*height:\s*(\d+)/);
    expect(m, "no se encontró el logo del layout").not.toBeNull();
    expect({ width: Number(m![1]), height: Number(m![2]) }).toEqual(
      pngSize("/brand/dtdcargo-isologo-primary.png"),
    );
  });
});

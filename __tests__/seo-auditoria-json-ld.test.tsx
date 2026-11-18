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

/**
 * Recorre desde `desde` (que apunta a una `{`) hasta su `}` de cierre, contando
 * llaves: un `${…}` o un objeto anidado no cortan el bloque antes de tiempo.
 * Devuelve el texto de adentro, o null si la llave no cierra.
 */
function bloqueDeLlaves(src: string, desde: number): string | null {
  let prof = 0;
  for (let i = desde; i < src.length; i++) {
    if (src[i] === "{") prof++;
    else if (src[i] === "}" && --prof === 0) return src.slice(desde + 1, i);
  }
  return null;
}

/** Índice de la comilla que cierra la cadena que abre `src[desde]`, saltando escapes. */
function finDeCadena(src: string, desde: number): number {
  const q = src[desde];
  for (let i = desde + 1; i < src.length; i++) {
    if (src[i] === "\\") i++;
    else if (src[i] === q) return i;
  }
  return src.length;
}

/**
 * Cada `<Nombre …/>` con props del archivo, sin importar el orden de las props:
 * empieza en `<Nombre` seguido de un espacio (una mención `<Nombre>` en un
 * comentario no cuenta) y termina en el primer `/>` que no esté dentro de llaves
 * ni de una cadena (`"…"`, `'…'` o `` `…` ``), así que un `>` en un texto no lo
 * corta y no salta a otro elemento.
 *
 * Devuelve también los `<Nombre …` que no cierran con `/>` (un `>` suelto fuera
 * de llaves y cadenas): un uso que el recorrido no reconoce no puede pasar callado.
 */
function elementosJsx(src: string, nombre: string): { elementos: string[]; sinCerrar: string[] } {
  const elementos: string[] = [];
  const sinCerrar: string[] = [];
  for (const m of src.matchAll(new RegExp(`<${nombre}\\s`, "g"))) {
    let prof = 0;
    let cerrado = false;
    for (let i = m.index; i < src.length; i++) {
      const c = src[i];
      if (c === '"' || c === "'" || c === "`") i = finDeCadena(src, i);
      else if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (prof === 0 && c === "/" && src[i + 1] === ">") {
        elementos.push(src.slice(m.index, i + 2));
        cerrado = true;
        break;
      } else if (prof === 0 && c === ">") break;
    }
    if (!cerrado) sinCerrar.push(src.slice(m.index, m.index + 80));
  }
  return { elementos, sinCerrar };
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
    const sinReconocer: string[] = [];
    const importanSinUsar: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "node_modules") walk(rel);
        } else if (e.name.endsWith(".tsx")) {
          const src = readFileSync(join(root, rel), "utf8");
          const { elementos, sinCerrar } = elementosJsx(src, "WebPageJsonLd");
          for (const el of elementos) usos.push(`${rel} ${el}`);
          for (const s of sinCerrar) sinReconocer.push(`${rel} ${s}`);
          // Conteo real: quien importa el componente tiene que usarlo al menos una vez.
          if (/from\s+["']@\/components\/WebPageJsonLd["']/.test(src) && elementos.length === 0) {
            importanSinUsar.push(rel);
          }
        }
      }
    };
    walk("app");
    // Todo `<WebPageJsonLd ` tiene que reconocerse como elemento: si el recorrido se
    // pierde uno, la prueba cae aquí, sin depender de un piso fijo.
    expect(sinReconocer, sinReconocer.join("\n")).toEqual([]);
    expect(importanSinUsar, importanSinUsar.join("\n")).toEqual([]);
    // Piso de cordura: las 5 páginas de la auditoría del 2026-11-07.
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
    // Exactamente un bloque `logo: { … }`, y width y height leídos DENTRO de él:
    // si el logo no los trae, no se toman de otro bloque.
    const inicios = [...layout.matchAll(/logo:\s*\{/g)];
    expect(inicios.length, "el layout debe tener un solo bloque logo").toBe(1);
    const bloque = bloqueDeLlaves(layout, inicios[0].index! + inicios[0][0].length - 1);
    expect(bloque, "el bloque logo no cierra").not.toBeNull();
    const width = bloque!.match(/\bwidth:\s*(\d+)/);
    const height = bloque!.match(/\bheight:\s*(\d+)/);
    expect(width, "el logo del layout no declara width").not.toBeNull();
    expect(height, "el logo del layout no declara height").not.toBeNull();
    expect({ width: Number(width![1]), height: Number(height![1]) }).toEqual(
      pngSize("/brand/dtdcargo-isologo-primary.png"),
    );
  });
});

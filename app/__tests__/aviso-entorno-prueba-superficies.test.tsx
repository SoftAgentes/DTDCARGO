// @vitest-environment node
import type { ReactNode } from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";
import StudioLayout from "@/app/studio/layout";
import PortalRootLayout from "@/app/portal/layout";
import MobileLayout from "@/app/m/layout";

/**
 * SDD-0544 · el aviso «Entorno de prueba» aparece en las cuatro superficies.
 *
 * El aviso se monta en `app/layout.tsx`, el único layout raíz del repo: el sitio
 * público, el Studio, el Portal y la PWA `/m` cuelgan de él. Aquí se renderiza
 * en el servidor la cadena de cada superficie (layout raíz + el layout raíz de
 * la superficie + una página) con `APP_ENV=staging` y con `production`.
 *
 * Los layouts `(app)` del Studio y del Portal no entran: piden sesión y
 * Supabase. Para que ninguno escape del layout raíz, la última prueba exige que
 * sólo `app/layout.tsx` pinte `<html>`.
 */

// next/font sólo funciona compilado por Next; las variables no importan aquí.
vi.mock("@/lib/fonts", () => {
  const fuente = { variable: "", className: "", style: { fontFamily: "sans-serif" } };
  return {
    archivo: fuente,
    archivoBlack: fuente,
    sora: fuente,
    nunitoSans: fuente,
    jetbrainsMono: fuente,
  };
});
// Dependen del router de Next (usePathname) y no son parte de esta prueba.
vi.mock("@/components/Analytics", () => ({ Analytics: () => null }));
vi.mock("@/components/CookieConsentBanner", () => ({ CookieConsentBanner: () => null }));
vi.mock("agentation", () => ({ Agentation: () => null }));

const MARCA = "data-entorno-prueba";

const SUPERFICIES: Array<[string, (pagina: ReactNode) => ReactNode]> = [
  ["sitio público", (pagina) => <RootLayout>{pagina}</RootLayout>],
  ["Studio", (pagina) => (
    <RootLayout>
      <StudioLayout>{pagina}</StudioLayout>
    </RootLayout>
  )],
  ["Portal", (pagina) => (
    <RootLayout>
      <PortalRootLayout>{pagina}</PortalRootLayout>
    </RootLayout>
  )],
  ["PWA /m", (pagina) => (
    <RootLayout>
      <MobileLayout>{pagina}</MobileLayout>
    </RootLayout>
  )],
];

function html(armar: (pagina: ReactNode) => ReactNode, appEnv: string): string {
  vi.stubEnv("APP_ENV", appEnv);
  return renderToStaticMarkup(armar(<main id="pagina-sintetica">página</main>));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SDD-0544 · aviso «Entorno de prueba» en las cuatro superficies", () => {
  it.each(SUPERFICIES)("%s: presente con APP_ENV=staging, antes de la página", (_n, armar) => {
    const salida = html(armar, "staging");
    expect(salida).toContain(MARCA);
    expect(salida).toContain("Entorno de prueba");
    expect(salida.indexOf(MARCA)).toBeLessThan(salida.indexOf('id="pagina-sintetica"'));
    // Un solo aviso: ninguna superficie lo repite.
    expect(salida.split(MARCA).length - 1).toBe(1);
  });

  it.each(SUPERFICIES)("%s: ausente con APP_ENV=production", (_n, armar) => {
    const salida = html(armar, "production");
    expect(salida).not.toContain(MARCA);
    expect(salida).not.toContain("Entorno de prueba");
    expect(salida).toContain('id="pagina-sintetica"');
  });

  it("sólo app/layout.tsx pinta <html>: ninguna ruta escapa del aviso", () => {
    const raiz = resolve("app");
    const layouts: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/^layout\.(tsx|jsx|ts|js)$/.test(nombre)) layouts.push(ruta);
      }
    };
    recorrer(raiz);
    // Elementos JSX de verdad, no la palabra en un comentario.
    const pintaHtml = (ruta: string) => {
      const fuente = ts.createSourceFile(ruta, readFileSync(ruta, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let hay = false;
      const visitar = (nodo: ts.Node) => {
        if (
          (ts.isJsxOpeningElement(nodo) || ts.isJsxSelfClosingElement(nodo)) &&
          nodo.tagName.getText(fuente) === "html"
        ) {
          hay = true;
        }
        ts.forEachChild(nodo, visitar);
      };
      visitar(fuente);
      return hay;
    };
    expect(layouts.length).toBeGreaterThan(4);
    const conHtml = layouts
      .filter(pintaHtml)
      .map((ruta) => relative(process.cwd(), ruta).split("\\").join("/"));
    expect(conHtml).toEqual(["app/layout.tsx"]);
  });
});

// @vitest-environment node
/**
 * SDD-0542 · los enlaces internos del Dashboard llevan a una pantalla que existe.
 *
 * El 2026-10-16 la alerta «N factura(s) vencida(s) · Gestionar cobranza»
 * mandaba a `/studio/invoices`, que nunca existió: 404 en producción. El mismo
 * barrido encontró «Calendario →» en `/studio/calendar` y «Nuevo estimado» en
 * `/studio/quotes/nuevo`. Ninguna prueba miraba adónde apunta un `href`.
 *
 * Contrato: cada `href` con `/studio…` escrito en el código del Dashboard (la
 * página, sus componentes y las consultas que lo alimentan) resuelve a una
 * carpeta de `app/studio/` con `page.tsx`, con las reglas del App Router:
 *   · los grupos `(x)` y los slots `@x` no ocupan segmento;
 *   · las carpetas privadas `_x` no son rutas;
 *   · `[x]` acepta un segmento; `[...x]`, uno o más; `[[...x]]`, cero o más;
 *   · la query y el hash no cuentan.
 * Un `${…}` dentro de un segmento sólo casa con un segmento dinámico:
 * `/studio/tracking/${id}` exige `tracking/[id]`; no le basta `tracking/nuevo`.
 *
 * Lo que no cubre: un `href` armado fuera de un literal (concatenando
 * variables) no se ve. Hoy no hay ninguno en el Dashboard, y la primera prueba
 * falla si el barrido deja de encontrar los enlaces conocidos.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const APP_STUDIO = resolve(ROOT, "app", "studio");

/** Código del Dashboard: la página, sus componentes y las consultas que lo alimentan. */
const FUENTES = [
  resolve(ROOT, "app", "studio", "(app)", "dashboard"),
  resolve(ROOT, "lib", "studio", "dashboard"),
  resolve(ROOT, "lib", "studio", "dashboard-queries.ts"),
];

/** Marca de un segmento con `${…}`: sólo casa con un segmento dinámico. */
const DINAMICO = "\u0000dinamico";

type Enlace = { archivo: string; linea: number; href: string };

/** Segmentos de cada carpeta de `dir` que tiene `page.*`. */
function rutasConPagina(dir: string, segmentos: string[]): string[][] {
  const rutas: string[][] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      // Privadas (`_x`, incluye `__tests__`) e interceptoras (`(.)x`) no son URL.
      if (e.name.startsWith("_") || e.name.startsWith("(.")) continue;
      const transparente =
        (e.name.startsWith("(") && e.name.endsWith(")")) || e.name.startsWith("@");
      rutas.push(
        ...rutasConPagina(resolve(dir, e.name), transparente ? segmentos : [...segmentos, e.name]),
      );
    } else if (/^page\.(tsx|ts|jsx|js)$/.test(e.name)) {
      rutas.push(segmentos);
    }
  }
  return rutas;
}

function segmentosDe(href: string): string[] {
  return href
    .replace(/\$\{[^}]*\}/g, DINAMICO)
    .split(/[?#]/)[0]
    .split("/")
    .filter(Boolean)
    .map((s) => (s.includes(DINAMICO) ? DINAMICO : s));
}

function casa(ruta: string[], segs: string[]): boolean {
  for (let i = 0; i < ruta.length; i++) {
    const r = ruta[i];
    if (/^\[\[\.\.\..+\]\]$/.test(r)) return true;
    if (/^\[\.\.\..+\]$/.test(r)) return segs.length > i;
    if (i >= segs.length) return false;
    if (/^\[[^\]]+\]$/.test(r)) continue;
    if (segs[i] !== r) return false;
  }
  return segs.length === ruta.length;
}

const RUTAS = rutasConPagina(APP_STUDIO, ["studio"]);

function resuelve(href: string): boolean {
  const segs = segmentosDe(href);
  return RUTAS.some((r) => casa(r, segs));
}

// `href: "…"`, `href="…"`, `href={"…"}` y `href={`…`}` (con `${…}` adentro).
const HREF =
  /\bhref\s*[:=]\s*\{?\s*(?:"(\/studio(?:[/?#][^"]*)?)"|'(\/studio(?:[/?#][^']*)?)'|`(\/studio(?:[/?#](?:[^`$]|\$\{[^}]*\}|\$(?!\{))*)?)`)/g;

function enlacesDe(codigo: string, archivo: string): Enlace[] {
  return [...codigo.matchAll(HREF)].map((m) => ({
    archivo,
    linea: codigo.slice(0, m.index).split("\n").length,
    href: m[1] ?? m[2] ?? m[3],
  }));
}

function archivosDe(p: string): string[] {
  if (statSync(p).isFile()) return /\.(tsx?|jsx?)$/.test(p) ? [p] : [];
  return readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.name === "__tests__" || /\.test\.(tsx?|jsx?)$/.test(e.name)
      ? []
      : archivosDe(resolve(p, e.name)),
  );
}

const ENLACES = FUENTES.flatMap(archivosDe).flatMap((f) =>
  enlacesDe(readFileSync(f, "utf8"), relative(ROOT, f).split(sep).join("/")),
);

describe("SDD-0542 · enlaces internos del Dashboard", () => {
  it("el barrido ve las rutas del Studio y los enlaces conocidos del Dashboard", () => {
    expect(RUTAS.length).toBeGreaterThan(50);
    const hrefs = new Set(ENLACES.map((e) => e.href));
    for (const conocido of [
      "/studio/cobranzas",
      "/studio/tracking",
      "/studio/naviera",
      "/studio/calendario",
      "/studio/cotizador",
      "/studio/tracking/nuevo",
      "/studio/nomina",
      `/studio/tracking/\${s.id}`,
    ]) {
      expect(hrefs, conocido).toContain(conocido);
    }
  });

  it("cada href interno del Dashboard tiene page.tsx", () => {
    const rotos = ENLACES.filter((e) => !resuelve(e.href)).map(
      (e) => `${e.archivo}:${e.linea} → ${e.href}`,
    );
    expect(rotos).toEqual([]);
  });

  describe("controles del verificador", () => {
    it("control rojo: la alerta vieja de cobranza apunta a una ruta sin page.tsx", () => {
      const antes =
        'alerts.push({ tone: "danger", title: `${due} factura(s) vencida(s)`, meta: "Gestionar cobranza", href: "/studio/invoices" });';
      const enlaces = enlacesDe(antes, "dashboard/page.tsx (antes)");
      expect(enlaces.map((e) => e.href)).toEqual(["/studio/invoices"]);
      expect(enlaces.filter((e) => !resuelve(e.href))).toHaveLength(1);
    });

    it.each(["/studio/calendar", "/studio/quotes/nuevo"])(
      "control rojo: %s, el otro enlace viejo, tampoco existe",
      (href) => {
        expect(resuelve(href)).toBe(false);
      },
    );

    it("el destino nuevo resuelve aunque viva bajo el grupo (app)", () => {
      expect(resuelve("/studio/cobranzas")).toBe(true);
    });

    it("la query y el hash no cuentan", () => {
      expect(resuelve("/studio/facturacion?tab=overdue")).toBe(true);
      expect(resuelve("/studio/invoices?tab=overdue#top")).toBe(false);
    });

    it("un ${…} sólo casa con un segmento dinámico", () => {
      expect(resuelve(`/studio/tracking/\${s.id}`)).toBe(true);
      expect(resuelve(`/studio/cotizador/\${q.quote_code}`)).toBe(true);
      // `cobranzas` sólo tiene `recibo/[code]` debajo: un segmento suelto no casa.
      expect(resuelve(`/studio/cobranzas/\${id}`)).toBe(false);
    });

    it("las carpetas privadas no son rutas", () => {
      expect(resuelve("/studio/dashboard/_components")).toBe(false);
      expect(resuelve("/studio/dashboard/__tests__")).toBe(false);
    });
  });
});

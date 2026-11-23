/**
 * SDD-0686 · fase 3b-2c: las páginas restantes de la web y sus superficies CSS
 * (`globals.css`, `recursos.css`, `prealertas.css`, `noticias.css`, `baja.css`)
 * sin vino de acción.
 *
 * Criterio (por analogía con la 3b-2b, decidido por Sam el 2026-11-22):
 * - Foco, enlaces, botones y hover en `--color-accion*` (texto sobre relleno:
 *   `--color-on-accion`); en la banda navy, lo que se toca va en `--color-accion-on-dark`.
 * - Selección, cifras, puntos, íconos y acentos editoriales en tinta; eyebrows y
 *   rótulos en tinta suave (grey-700); sobre navy, en crema (`--color-on-accent`).
 * - Los paneles de vino pasan a navy; el chip `.f2chip` pasa de `wine` a `accion`.
 * - Lista cerrada (identidad): el guion del eyebrow (`.eyebrow::before`), la tabla
 *   de colores de la marca (`/marca`) y la página de mantenimiento. Solo baja.
 * - Fuera: `app/entrar` (fase 4), `app/studio`, `app/portal`, `app/p`,
 *   `app/registro`, `app/verificar` y `app/abrir` (3b-1 y 3b-2a).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const FUERA = /^app\/(studio|portal|back|api|admin|interno|m|entrar|p|registro|verificar|abrir)\//;
const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/globals.css": { cuenta: 1, motivo: "el guion `.eyebrow::before`: identidad (3b-1)" },
  "app/marca/_components/CatalogClient.tsx": { cuenta: 1, motivo: "la tabla de colores de la marca muestra el token wine" },
  "lib/runtime/maintenance.ts": { cuenta: 1, motivo: "la página de mantenimiento lleva la marca con su hex" },
};
const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  const rutas = [
    ...fuentesDe(join(RAIZ, "app"), /\.(tsx?|css)$/),
    ...fuentesDe(join(RAIZ, "lib", "news"), /\.(tsx?|css)$/),
    ...fuentesDe(join(RAIZ, "lib", "runtime"), /\.(tsx?|css)$/),
    join(RAIZ, "lib", "cn.ts"),
    ...fuentesDe(join(RAIZ, "components", "servicios"), /\.(tsx?|css)$/),
  ];
  for (const ruta of rutas) {
    const r = rel(ruta);
    if (FUERA.test(r) || /\.test\.tsx?$/.test(r)) continue;
    const n = cuentaVino(fuente(ruta));
    if (n) out[r] = n;
  }
  return out;
}

const RGBA_VINO = /rgba\(\s*(?:127,\s*15,\s*26|194,\s*116,\s*127|158,\s*21,\s*34)/g;

function rutasWeb(): string[] {
  return [
    ...fuentesDe(join(RAIZ, "app"), /\.(tsx?|css)$/),
    ...fuentesDe(join(RAIZ, "lib", "news"), /\.(tsx?|css)$/),
    ...fuentesDe(join(RAIZ, "lib", "runtime"), /\.(tsx?|css)$/),
    ...fuentesDe(join(RAIZ, "components"), /\.(tsx?|css)$/),
  ].filter((ruta) => !FUERA.test(rel(ruta)) && !/\.test\.tsx?$/.test(rel(ruta)));
}

/** Tokens `--color-*` declarados en el `@theme` de globals.css (sin el prefijo `--color-`). */
function tokensDeTema(): Set<string> {
  const css = leer("app/globals.css");
  const tema = css.slice(css.indexOf("@theme {"), css.indexOf("\n}", css.indexOf("@theme {")));
  return new Set([...tema.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]));
}

const CLASE_ACCION = /(?<=^|[\s"'`:])(?:bg|text|border|ring|outline|fill|stroke|from|via|to|accent|decoration|divide|placeholder|caret|shadow)-((?:on-)?accion(?:-[a-z]+)*)(?:\/\d+)?(?![\w-])/gm;
const VAR_ACCION = /var\(--color-((?:on-)?accion(?:-[a-z]+)*)\)/g;

/** Clases `*-accion-*` y `var(--color-accion-…)` de un texto cuyo token no existe en `@theme`. */
function accionSinToken(texto: string, tokens: Set<string>): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(CLASE_ACCION)) if (!tokens.has(m[1])) out.push(m[0]);
  for (const m of texto.matchAll(VAR_ACCION)) if (!tokens.has(m[1])) out.push(m[0]);
  return out;
}

const contarRgbaVino =(texto: string): number => texto.split(RGBA_VINO).length - 1;

function rgbaVino(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ruta of rutasWeb()) {
    const n = contarRgbaVino(fuente(ruta));
    if (n) out[rel(ruta)] = n;
  }
  return out;
}

describe("SDD-0686 fase 3b-2c · páginas y superficies CSS sin vino de acción", () => {
  it("el vino que queda está en la lista cerrada, con su cuenta exacta", () => {
    expect(cuentas((ruta) => readFileSync(ruta, "utf8"))).toEqual(esperado);
  });

  it.each([
    ["un enlace en vino", "app/cookies/page.tsx", 'style={{ color: "var(--color-accion-text)" }}', 'style={{ color: "var(--color-wine)" }}'],
    ["un acento editorial en vino", "app/fcl/page.tsx", '<span style={{ color: "var(--color-ink)", fontWeight: 900 }}>China a tu puerto.', '<span style={{ color: "var(--color-wine)" }}>China a tu puerto.'],
    ["un botón en vino", "app/recursos.css", ".rp-surface .btn-primary {\n  background: var(--color-accion);", ".rp-surface .btn-primary {\n  background: var(--color-wine);"],
    ["un eyebrow sobre navy en vino claro", "app/prealertas.css", ".pa-hero .eyebrow-h {\n  color: var(--color-on-accent);", ".pa-hero .eyebrow-h {\n  color: var(--wine-on-dark);"],
    ["un panel navy vuelto vino", "app/globals.css", ".cx-wine-panel {", ".cx-wine-panel {\n  background: var(--grad-wine-panel);"],
    ["el chip de ficha en vino", "components/servicios/ChipF2.tsx", 'variant === "accion" && "accion"', 'variant === "wine" && "wine"'],
    ["un enlace de Noticias en vino", "app/noticias/noticias.css", ".actual-consent a { color: var(--color-accion-on-dark);", ".actual-consent a { color: var(--color-wine-on-dark);"],
  ])("mutante: %s se detecta", (_, objetivo, de, a) => {
    const original = leer(objetivo);
    expect(original).toContain(de);
    const mutado = original.replace(de, a);
    const c = cuentas((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(c[objetivo] ?? 0).toBeGreaterThan(esperado[objetivo] ?? 0);
  });

  it("el texto sobre un relleno de botón primario es --color-on-accion", () => {
    expect(leer("app/recursos.css")).toMatch(/\.rp-surface \.btn-primary \{\s*background: var\(--color-accion\);\s*color: var\(--color-on-accion\);/);
    expect(leer("app/noticias/noticias.css")).toContain("background: var(--color-accion);\n  color: var(--color-on-accion);");
  });

  it("los alias de vino de las superficies ya no existen", () => {
    const css = leer("app/globals.css");
    expect(css).not.toMatch(/^\s*--(wine|wine-deep|wine-soft|wine-text|wine-tint|wine-on-dark|grad-wine|grad-wine-panel):/m);
    expect(leer("app/email/baja/baja.css")).not.toMatch(/--wine/);
  });

  it("la baja de correo lee el acento de --baja-ac y lo cambia en oscuro", () => {
    const css = leer("app/email/baja/baja.css");
    expect(css).toContain("--baja-ac: var(--color-accion-text);");
    expect(css).toContain("--baja-ac: var(--color-accion-on-dark);");
  });

  it("el chip de ficha usa la variante `accion`", () => {
    expect(leer("components/servicios/ChipF2.tsx")).toContain('variant?: "on" | "accion"');
    expect(leer("app/globals.css")).toContain(".f2chip.accion {");
  });
  it("ningún rgba() de la familia vino queda vivo en la web (el detector no lo ve)", () => {
    expect(rgbaVino((ruta) => readFileSync(ruta, "utf8"))).toEqual({});
  });

  it("mutante: un halo en rgba de vino se detecta", () => {
    const objetivo = "app/globals.css";
    const original = leer(objetivo);
    const de = "0 8px 24px -8px color-mix(in srgb, var(--color-accion) 45%, transparent)";
    expect(original).toContain(de);
    const mutado = original.replace(de, "0 8px 24px -8px rgba(127, 15, 26, 0.45)");
    expect(contarRgbaVino(original)).toBe(0);
    expect(contarRgbaVino(mutado)).toBe(1);
  });

  it("toda clase *-accion-* que usa la web existe como token en @theme (si no, Tailwind no la genera)", () => {
    const tokens = tokensDeTema();
    const faltan: string[] = [];
    for (const ruta of rutasWeb().filter((r) => /\.tsx?$/.test(r))) {
      for (const f of accionSinToken(readFileSync(ruta, "utf8"), tokens)) faltan.push(`${rel(ruta)}: ${f}`);
    }
    expect(faltan).toEqual([]);
    expect(tokens.has("accion")).toBe(true);
  });

  it("mutante: una clase de acción sin token se detecta (y las que sí existen no)", () => {
    const tokens = tokensDeTema();
    expect(tokens.has("accion-soft")).toBe(false);
    expect(accionSinToken('className="focus-visible:ring-accion-soft"', tokens)).toEqual(["ring-accion-soft"]);
    expect(accionSinToken('className="bg-[var(--color-accion-soft)]"', tokens)).toEqual(["var(--color-accion-soft)"]);
    expect(accionSinToken('className="hover:text-accion-text bg-accion/40 text-on-accion"', tokens)).toEqual([]);
  });
});

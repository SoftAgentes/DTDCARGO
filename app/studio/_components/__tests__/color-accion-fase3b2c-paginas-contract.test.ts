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
});

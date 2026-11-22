/**
 * SDD-0686 · fase 3b-1: el Portal del cliente (`app/portal`) sin vino de acción.
 *
 * - Botones, enlaces, foco y casillas en `--color-accion*`; selección, códigos,
 *   cifras, avatares y badges en tinta (`--color-ink`); eyebrows en tinta suave.
 * - En el portal oscuro los tokens `--color-accion*` toman los valores oscuros
 *   del Studio, con texto navy sobre el relleno.
 * - `.btn-primary` del portal (`#portal-shell`) es azul; la web pública lo
 *   conserva hasta la 3b-2.
 * - Lista cerrada: solo queda la Vista simple (EXC-0654-01), que espera la
 *   decisión A/B de Sam. Solo baja. El inicio de sesión (`(auth)`) va en la fase 4.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/portal/(app)/_simple/InicioSimple.tsx": {
    cuenta: 1,
    motivo: "tinte del bloque «proveedor» de la Vista simple (EXC-0654-01): espera la decisión A/B de Sam",
  },
};
const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ruta of fuentesDe(join(RAIZ, "app/portal"), /\.(tsx?|css)$/)) {
    const r = rel(ruta);
    if (/\.test\.tsx?$/.test(r) || r.startsWith("app/portal/(auth)/")) continue;
    const n = cuentaVino(fuente(ruta));
    if (n) out[r] = n;
  }
  return out;
}

/** Bloque CSS de un selector exacto en `app/globals.css`. */
function bloque(css: string, selector: string): string {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) return "";
  return css.slice(i, css.indexOf("}", i));
}

describe("SDD-0686 fase 3b-1 · Portal sin vino de acción", () => {
  it("el vino que queda en app/portal está en la lista cerrada, con su cuenta exacta", () => {
    expect(cuentas((ruta) => readFileSync(ruta, "utf8"))).toEqual(esperado);
  });

  it.each([
    ["un enlace en vino", "app/portal/_components/PortalFooter.tsx", "text-accion-text hover:underline", "text-wine-text hover:underline"],
    ["un foco en vino", "app/portal/_components/ReferralInviteForm.tsx", "focus-visible:ring-accion", "focus-visible:ring-wine"],
    ["un botón en vino", "app/portal/(app)/error.tsx", 'background: "var(--color-accion)"', 'background: "var(--color-wine)"'],
    ["un tono \"wine\" de KPI", "app/portal/(app)/_components/PortalDashboardNorte.tsx", 'tone="ink"', 'tone="wine"'],
  ])("mutante: %s se detecta", (_, objetivo, de, a) => {
    const original = leer(objetivo);
    expect(original).toContain(de);
    const mutado = original.replace(de, a);
    const c = cuentas((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(c[objetivo]).toBe((esperado[objetivo] ?? 0) + 1);
  });

  it("el portal oscuro redefine el azul de acción con los valores oscuros del Studio", () => {
    const css = leer("app/globals.css");
    const oscuro = bloque(css, '[data-portal-theme="dark"]');
    expect(oscuro).toContain("--color-accion: #7faaf0;");
    expect(oscuro).toContain("--color-accion-hover: #9bbdf4;");
    expect(oscuro).toContain("--color-on-accion: #0f1e3d;");
    expect(oscuro).toContain("--color-accion-text: #7faaf0;");
    const studio = leer("app/studio/tokens.css");
    expect(studio).toContain("--accion: #7FAAF0;");
  });

  it("el botón principal del portal es azul y la web pública conserva el suyo hasta la 3b-2", () => {
    const css = leer("app/globals.css");
    const portal = bloque(css, "#portal-shell .btn-primary");
    expect(portal).toContain("background: var(--color-accion);");
    expect(portal).toContain("color: var(--color-on-accion);");
    expect(bloque(css, "#portal-shell .btn-primary:hover")).toContain("var(--color-accion-hover)");
    expect(bloque(css, ".btn-primary")).toContain("var(--color-wine)");
  });

  it("sobre un relleno de acción el texto es --color-on-accion, no --color-on-accent", () => {
    const conPar: string[] = [];
    for (const ruta of fuentesDe(join(RAIZ, "app/portal"), /\.(tsx|css)$/)) {
      const r = rel(ruta);
      if (/\.test\.tsx?$/.test(r)) continue;
      const t = readFileSync(ruta, "utf8");
      for (const m of t.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        if (/background: "var\(--color-accion\)"/.test(m[1]) && /--color-on-accent/.test(m[1])) conPar.push(r);
      }
      if (/bg-accion text-\[color:var\(--color-on-accent\)\]/.test(t)) conPar.push(r);
    }
    expect(conPar).toEqual([]);
  });
});

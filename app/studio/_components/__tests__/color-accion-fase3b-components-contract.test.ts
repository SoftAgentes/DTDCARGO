/**
 * SDD-0686 · fase 3b-2b: los componentes compartidos de la web (`components/`)
 * sin vino de acción.
 *
 * - Foco, enlaces, hover, chevrones y botones con relleno en `--color-accion*`.
 * - Selección (chips, pestañas, tipo elegido, menú activo), cifras y el Shipping
 *   Mark en tinta; eyebrows en tinta suave; errores en rojo; «incluye» en verde.
 * - Lista cerrada: lo que queda espera la decisión A/B de Sam (acentos
 *   editoriales, ilustraciones, acentos sobre navy) o la 3b-2c (las fichas de
 *   servicios, que dependen de `.f2chip` en `globals.css`). Solo baja.
 * - El logo (`BrandMark`) es identidad: sus hex no se cuentan aquí.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const EDITORIAL = "A/B de Sam: acento editorial (palabra destacada, comillas o tarjeta insignia)";
const ILUSTRACION = "A/B de Sam: ilustración o diagrama";
const NAVY = "A/B de Sam: acento en vino claro sobre navy";
const FICHAS = "3b-2c: chip `.f2chip.wine`, que vive en globals.css";

const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "components/CalculadoraForm.tsx": { cuenta: 12, motivo: `${NAVY}; incluye «DTD» (identidad) y el relleno del contenedor` },
  "components/CbmAyuda.tsx": { cuenta: 3, motivo: NAVY },
  "components/CbmExplicador.tsx": { cuenta: 8, motivo: ILUSTRACION },
  "components/ChinaSupplierClip.tsx": { cuenta: 2, motivo: NAVY },
  "components/CicloCliente.tsx": { cuenta: 7, motivo: ILUSTRACION },
  "components/CicloDTD.tsx": { cuenta: 5, motivo: ILUSTRACION },
  "components/Philosophy.tsx": { cuenta: 5, motivo: EDITORIAL },
  "components/PuertaAPuerta.tsx": { cuenta: 1, motivo: EDITORIAL },
  "components/servicios/ChipF2.tsx": { cuenta: 1, motivo: FICHAS },
  "components/servicios/DdpHero.tsx": { cuenta: 2, motivo: EDITORIAL },
  "components/servicios/hub-fichas.tsx": { cuenta: 15, motivo: FICHAS },
  "components/ServiciosExplorer.tsx": { cuenta: 1, motivo: EDITORIAL },
  "components/Stats.tsx": { cuenta: 2, motivo: NAVY },
  "components/Testimonials.tsx": { cuenta: 1, motivo: EDITORIAL },
  "components/Timeline.tsx": { cuenta: 5, motivo: `${EDITORIAL} e ilustración` },
  "components/YiwuAdvantage.tsx": { cuenta: 4, motivo: NAVY },
};
const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ruta of fuentesDe(join(RAIZ, "components"), /\.(tsx?|css)$/)) {
    const r = rel(ruta);
    if (/\.test\.tsx?$/.test(r)) continue;
    const n = cuentaVino(fuente(ruta));
    if (n) out[r] = n;
  }
  return out;
}

describe("SDD-0686 fase 3b-2b · components/ sin vino de acción", () => {
  it("el vino que queda en components/ está en la lista cerrada, con su cuenta exacta", () => {
    expect(cuentas((ruta) => readFileSync(ruta, "utf8"))).toEqual(esperado);
  });

  it.each([
    ["un enlace en vino", "components/FaqExplorer.tsx", "font-bold text-accion-text underline", "font-bold text-wine-text underline"],
    ["un hover del menú en vino", "components/NavClient.tsx", "hover:text-accion-text hover:bg-accion-tint", "hover:text-wine hover:bg-wine/15"],
    ["una selección en vino", "components/ServiciosExplorer.tsx", '"bg-ink text-paper border-ink"', '"bg-wine text-white border-wine"'],
    ["un error en vino", "components/EstimadoModal.tsx", "font-medium text-status-danger\">{error}", "font-medium text-wine\">{error}"],
  ])("mutante: %s se detecta", (_, objetivo, de, a) => {
    const original = leer(objetivo);
    expect(original).toContain(de);
    const mutado = original.replace(de, a);
    const c = cuentas((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(c[objetivo]).toBeGreaterThan(esperado[objetivo] ?? 0);
  });

  it("sobre un relleno de acción el texto es --color-on-accion, no --color-on-accent", () => {
    const conPar: string[] = [];
    for (const ruta of fuentesDe(join(RAIZ, "components"), /\.tsx$/)) {
      const r = rel(ruta);
      if (/\.test\.tsx?$/.test(r)) continue;
      for (const m of readFileSync(ruta, "utf8").matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        if (/background: "var\(--color-accion\)"/.test(m[1]) && /--color-on-accent/.test(m[1])) conPar.push(r);
      }
    }
    expect(conPar).toEqual([]);
  });

  it("los errores de los formularios van en rojo, no en vino", () => {
    expect(leer("components/EstimadoModal.tsx")).toContain('text-status-danger">{error}</span>');
    expect(leer("components/UltimoKmCalculator.tsx")).toContain('"bg-status-danger/5 border-status-danger/30"');
  });
});

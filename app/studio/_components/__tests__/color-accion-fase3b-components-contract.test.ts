/**
 * SDD-0686 · fase 3b-2b: los componentes compartidos de la web (`components/`)
 * sin vino de acción.
 *
 * - Foco, enlaces, hover, chevrones y botones con relleno en `--color-accion*`.
 * - Selección (chips, pestañas, tipo elegido, menú activo), cifras y el Shipping
 *   Mark en tinta; eyebrows en tinta suave; errores en rojo; «incluye» en verde.
 * - Decisión de Sam del 2026-11-22, «Web pública: A en las tres»: acentos
 *   editoriales en tinta (negrita), comillas en tinta suave y borde insignia en
 *   tinta; ilustraciones en navy con rampa por opacidad; sobre las bandas navy,
 *   cifras y rótulos en crema y lo que se toca en `--color-accion-on-dark`.
 * - Lista cerrada: el «DTD» de la calculadora (identidad) y las fichas de
 *   servicios (3b-2c, `.f2chip` en `globals.css`). Solo baja.
 * - El logo (`BrandMark`) es identidad: sus hex no se cuentan aquí.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const FICHAS = "3b-2c: chip `.f2chip.wine`, que vive en globals.css";

const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "components/CalculadoraForm.tsx": { cuenta: 1, motivo: "«DTD» del encabezado de la calculadora: identidad (Sam, bandas A)" },
  "components/servicios/ChipF2.tsx": { cuenta: 1, motivo: FICHAS },
  "components/servicios/hub-fichas.tsx": { cuenta: 15, motivo: FICHAS },
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
    ["un estado abierto en vino con variante de grupo", "components/NavClient.tsx", "group-[[open]]:text-accion-text", "group-[[open]]:text-wine"],
    ["una selección en vino", "components/ServiciosExplorer.tsx", '"bg-ink text-paper border-ink"', '"bg-wine text-white border-wine"'],
    ["un error en vino", "components/EstimadoModal.tsx", "font-medium text-status-danger\">{error}", "font-medium text-wine\">{error}"],
    ["un acento editorial en vino (Sam, 3A)", "components/PuertaAPuerta.tsx", 'className="font-black" style={{ color: "var(--color-ink)" }}>puerta a puerta?', 'style={{ color: "var(--color-wine)" }}>puerta a puerta?'],
    ["una ilustración en vino (Sam, 4A)", "components/CicloDTD.tsx", '<tspan style={{ fill: "var(--ink)", fontFamily', '<tspan style={{ fill: "var(--wine)", fontFamily'],
    ["una cifra en vino claro sobre navy (Sam, 5A)", "components/Stats.tsx", 'color: "var(--color-on-accent)",', 'color: "var(--color-wine-soft)",'],
    ["un control en vino claro sobre navy (Sam, 5A)", "components/CbmAyuda.tsx", 'borderColor: "var(--color-accion-on-dark)",', 'borderColor: "var(--wine-on-dark, #D59FA7)",'],
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

  it("bandas navy: el azul claro y el crema pasan AA sobre cada fondo navy donde pintan", () => {
    const luz = (h: string) => {
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const contraste = (a: string, b: string) => {
      const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const css = leer("app/globals.css");
    const tema = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
    const azul = /--color-accion-on-dark:\s*(#[0-9a-f]{6});/i.exec(tema)?.[1] ?? "";
    expect(azul.toLowerCase()).toBe("#7faaf0");
    // Fondos reales: la calculadora (#16233F → #0B1428), el panel del total
    // (#203760), las bandas navy (#16274B → #26406F) y el héroe del portal.
    const calc = leer("components/CalculadoraForm.tsx");
    expect(calc).toContain("linear-gradient(180deg, #16233F 0%, #0B1428 100%)");
    for (const fondo of ["#16233F", "#0B1428", "#203760", "#0F1E3D", "#1F3055"]) {
      expect(contraste(azul, fondo), `azul sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
      expect(contraste("#FFFFFF", fondo), `crema sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
    }
    // En el extremo claro de las bandas (#26406F) el azul solo pinta foco: 3:1.
    expect(contraste(azul, "#26406F")).toBeGreaterThanOrEqual(3);
  });

  it("el «DTD» de la calculadora sigue en el vino del logo (identidad)", () => {
    expect(leer("components/CalculadoraForm.tsx")).toContain('<span style={{ color: "var(--wine-on-dark, #D59FA7)" }}>DTD</span>');
  });
});

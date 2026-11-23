/**
 * SDD-0686 · fase 3b-2a: registro, verificar, abrir y la planilla del proveedor
 * (`p/[token]`) sin vino de acción.
 *
 * - Foco, enlaces, botones con relleno y callouts informativos en `--color-accion*`
 *   (texto sobre el relleno: `--color-on-accion`).
 * - Selección, Shipping Mark, cifras y acentos editoriales en tinta; eyebrows en
 *   tinta suave (grey-700); errores y avisos de campo en rojo de estado.
 * - La tarjeta del Shipping Mark y la banda del registro van en navy (tinta) con
 *   rótulos en `--color-accion-on-dark` (misma regla de las bandas, Sam 5A).
 * - Lista cerrada: identidad del documento de la planilla (marca de agua, título
 *   en chino y folio). Solo baja.
 * - `app/entrar` queda fuera: es el inicio de sesión (fase 4).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const CARPETAS = ["app/registro", "app/verificar", "app/abrir", "app/p"];
const PLANILLA = "app/p/[token]/PackingListFormSection.tsx";
const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  [PLANILLA]: { cuenta: 3, motivo: "identidad del documento: marca de agua (.pl-wm .d), título zh-CN y folio" },
};
const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const carpeta of CARPETAS) {
    for (const ruta of fuentesDe(join(RAIZ, carpeta), /\.(tsx?|css)$/)) {
      const r = rel(ruta);
      const n = cuentaVino(fuente(ruta));
      if (n) out[r] = n;
    }
  }
  return out;
}

describe("SDD-0686 fase 3b-2a · registro, verificar, abrir y p/[token] sin vino de acción", () => {
  it("el vino que queda está en la lista cerrada, con su cuenta exacta", () => {
    expect(cuentas((ruta) => readFileSync(ruta, "utf8"))).toEqual(esperado);
  });

  it.each([
    ["un foco en vino", "app/registro/RegisterForm.tsx", "focus-visible:ring-accion focus-visible:ring-offset-1", "focus-visible:ring-wine focus-visible:ring-offset-1"],
    ["un botón con relleno en vino", "app/registro/link/[token]/RegistroLinkForm.tsx", "bg-accion text-on-accion", "bg-wine text-white"],
    ["un error en vino", "app/registro/correo/[token]/ComprobarCorreoForm.tsx", "mt-4 text-[14px] text-status-danger", "mt-4 text-[14px] text-wine"],
    ["una selección en vino", "app/p/[token]/PackingListGuidedForm.tsx", "border-ink bg-ink text-on-accent", "border-wine-text bg-wine text-on-accent"],
    ["el Shipping Mark en vino", "app/registro/RegisterForm.tsx", 'tone === "mark" ? "var(--color-ink)"', 'tone === "wine" ? "var(--color-wine)"'],
    ["un acento editorial en vino", "app/verificar/page.tsx", '<span style={{ color: "var(--color-ink)", fontWeight: 900 }}>diploma.', '<span style={{ color: "var(--color-wine)" }}>diploma.'],
    ["un control de la planilla en vino", PLANILLA, ".pl-doc .addbtn:hover { border-color: var(--color-accion);", ".pl-doc .addbtn:hover { border-color: var(--color-wine);"],
  ])("mutante: %s se detecta", (_, objetivo, de, a) => {
    const original = leer(objetivo);
    expect(original).toContain(de);
    const mutado = original.replace(de, a);
    const c = cuentas((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(c[objetivo]).toBeGreaterThan(esperado[objetivo] ?? 0);
  });

  it("el texto sobre un relleno de acción es --color-on-accion", () => {
    for (const ruta of ["app/registro/correo/[token]/ComprobarCorreoForm.tsx", "app/registro/link/[token]/RegistroLinkForm.tsx"]) {
      const t = leer(ruta);
      expect(t, ruta).not.toMatch(/bg-accion[^"`]*text-white/);
    }
    expect(leer(PLANILLA)).toContain("background: var(--color-accion); border-color: var(--color-accion); color: var(--color-on-accion)");
  });

  it("los errores de campo del registro van en rojo de estado", () => {
    const t = leer("app/registro/RegisterForm.tsx");
    expect(t).toContain('borderColor: "var(--color-status-danger)"');
    expect(t).toContain('text-[12px] text-status-danger leading-[1.4]');
  });

  it("el rótulo sobre la tarjeta navy del Shipping Mark es el azul claro de las bandas", () => {
    const t = leer("app/registro/RegisterForm.tsx");
    expect(t).toContain('style={{ background: "var(--color-ink)", color: "#fff" }}');
    expect(t).toContain('style={{ color: "var(--color-accion-on-dark)" }}');
  });

  it("el título zh-CN, el folio y la marca de agua siguen en el vino del documento", () => {
    const t = leer(PLANILLA);
    expect(t).toContain(".pl-folio { color: var(--color-wine); }");
    expect(t).toContain(".pl-wm .d { color: var(--color-wine); }");
  });
});

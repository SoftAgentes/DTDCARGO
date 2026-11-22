/**
 * SDD-0686 · fase 3: la app móvil del ERP (`app/m`) y Noticias web sin vino de acción.
 *
 * - `app/m` usa los tokens del Studio y sigue el reparto de la fase 2: botones y
 *   foco en `--accion`, selección y códigos en tinta, eyebrows en `--ink-soft`
 *   (o `--ink-side*` sobre navy) y cifras en tinta. Sin tono `"wine"`.
 * - `--surface-sel`, la selección sobre navy, deja el tinte vino por un blanco.
 * - Noticias web (bloque `data-theme="light"` fijo) usa los tokens web fijos
 *   `--color-accion*` de `app/globals.css`, con los valores claros del Studio.
 * - Lista cerrada: lo que queda espera la decisión de Sam (rótulo del login y
 *   tarjeta de la ruta del camionero). Solo baja.
 * - Tampoco quedan hex de la familia vino escritos a mano en `app/m`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const PENDIENTE_DE_SAM = "espera la decisión de Sam del croquis del 2026-11-22";
const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/m/page.tsx": { cuenta: 1, motivo: `rótulo «OPERARIO» junto a DTD: ${PENDIENTE_DE_SAM}` },
  "app/m/cn/login/page.tsx": { cuenta: 1, motivo: `rótulo «OPERARIO» junto a DTD: ${PENDIENTE_DE_SAM}` },
  "app/m/ve/login/page.tsx": { cuenta: 1, motivo: `rótulo «DESPACHO VE» junto a DTD: ${PENDIENTE_DE_SAM}` },
  "app/m/ve/camionero/_components/CamioneroClient.tsx": { cuenta: 3, motivo: `degradado de la tarjeta de la ruta: ${PENDIENTE_DE_SAM}` },
};

const HEX_VINO = /#(?:7F0F1A|5E0A12|5A0910|9E1522|A8323E|AE1A28|C2747F|D89AA4|D59FA7)\b/i;

function cuentas(bases: string[], fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const base of bases) {
    for (const ruta of fuentesDe(join(RAIZ, base), /\.(tsx?|css)$/)) {
      const r = rel(ruta);
      if (/\.test\.tsx?$/.test(r)) continue;
      const n = cuentaVino(fuente(ruta));
      if (n) out[r] = n;
    }
  }
  return out;
}

const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));
const leerAbs = (ruta: string) => readFileSync(ruta, "utf8");

describe("SDD-0686 fase 3 · app móvil y Noticias web sin vino de acción", () => {
  it("app/m: el vino que queda está en la lista cerrada, con su cuenta exacta", () => {
    expect(cuentas(["app/m"], leerAbs)).toEqual(esperado);
  });

  it("Noticias web no tiene vino", () => {
    expect(cuentas(["app/studio/(app)/marketing/noticias-web"], leerAbs)).toEqual({});
  });

  it("app/m no tiene hex de la familia vino escritos a mano", () => {
    const conHex = fuentesDe(join(RAIZ, "app/m"), /\.(tsx?|css)$/)
      .filter((r) => !/\.test\.tsx?$/.test(r))
      .filter((r) => HEX_VINO.test(readFileSync(r, "utf8")))
      .map(rel);
    expect(conHex).toEqual([]);
  });

  it.each([
    ["un botón en vino", "app/m/_components/BigButton.tsx", 'primary: { bg: "var(--accion)"', 'primary: { bg: "var(--wine)"'],
    ["un tono \"wine\" de KPI", "app/m/cn/_components/OperarioHomeClient.tsx", 'value={today.receipts} tone="ink" />', 'value={today.receipts} tone="wine" />'],
  ])("mutante: %s en app/m se detecta", (_, objetivo, de, a) => {
    const original = leer(objetivo);
    expect(original).toContain(de);
    const mutado = original.replace(de, a);
    const c = cuentas(["app/m"], (ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(c[objetivo]).toBe((esperado[objetivo] ?? 0) + 1);
  });

  it("mutante: una clase bg-wine en Noticias web se detecta", () => {
    const objetivo = "app/studio/(app)/marketing/noticias-web/_components/KeywordPanel.tsx";
    const original = leer(objetivo);
    expect(original).toContain("bg-accion ");
    const mutado = original.replace("bg-accion ", "bg-wine ");
    const c = cuentas(["app/studio/(app)/marketing/noticias-web"], (ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(c).toEqual({ [objetivo]: 1 });
  });

  it("la selección sobre navy (--surface-sel) es tinta, no vino", () => {
    const linea = leer("app/studio/tokens.css").split("\n").find((l) => l.includes("--surface-sel:")) ?? "";
    expect(linea).toContain("rgba(255,255,255,0.16)");
    expect(linea).not.toMatch(/168,\s*50,\s*62/);
  });

  it("los tokens web de acción tienen los valores claros del Studio", () => {
    const web = leer("app/globals.css");
    expect(web).toContain("--color-accion: #1f4fa8;");
    expect(web).toContain("--color-on-accion: #ffffff;");
    expect(web).toContain("--color-accion-text: #1f4fa8;");
    expect(leer("app/studio/tokens.css")).toContain("--accion: #1F4FA8;");
  });
});

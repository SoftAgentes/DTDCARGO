/**
 * SDD-0686 · fase 2, grupo 6 (BD-076): reportes, dirección, bugs, mis-bugs,
 * costing, legal y ve.
 *
 * El grupo cierra sin vino por token, clase ni tono (lo cuenta
 * `vino-detector.ts`; los hex escritos a mano son de la fase 4). Las cifras y
 * las gráficas van en tinta; el margen negativo, que es pérdida, va en
 * peligro; «en ventana · contactar ya» va en atención. Lo único que queda es
 * identidad: el encabezado impreso del constructor de reportes (regla 8).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const GRUPO_6 = ["reportes", "direccion", "bugs", "mis-bugs", "costing", "legal", "ve"].map(
  (m) => `app/studio/(app)/${m}`,
);

/** Lo único que puede quedar en vino en el grupo 6, con su motivo. */
const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/studio/(app)/reportes/_components/BuilderView.tsx": {
    cuenta: 1,
    motivo: "encabezado impreso «DTD Cargo · Constructor de reportes» (`.rpt-eyebrow`): documento de marca, regla 8",
  },
};

const leer = (ruta: string) => readFileSync(ruta, "utf8");
const archivos = () => GRUPO_6.flatMap((b) => fuentesDe(join(RAIZ, b), /\.(tsx?|css)$/));

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ruta of archivos()) {
    const n = cuentaVino(fuente(ruta));
    if (n > 0) out[rel(ruta)] = n;
  }
  return out;
}

function mutar(objetivo: string, de: string, a: string): number | undefined {
  expect(leer(join(RAIZ, objetivo))).toContain(de);
  return cuentas((ruta) => (rel(ruta) === objetivo ? leer(ruta).replace(de, a) : leer(ruta)))[objetivo];
}

describe("SDD-0686 fase 2 · grupo 6: reportes y dirección sin vino", () => {
  it("mide algo: el grupo 6 tiene al menos 40 archivos de producción", () => {
    expect(archivos().length).toBeGreaterThanOrEqual(40);
  });

  it("cada archivo con vino está en la lista permitida, con su cuenta exacta", () => {
    const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));
    expect(cuentas(leer)).toEqual(esperado);
  });

  it("mutante: el margen negativo otra vez en vino se detecta", () => {
    const objetivo = "app/studio/(app)/costing/_components/CostingClient.tsx";
    expect(mutar(objetivo, 'totals.margin < 0 ? "var(--color-status-danger-on-dark)"', 'totals.margin < 0 ? "var(--wine-soft)"')).toBe(1);
  });

  it("mutante: una gráfica de reportes en vino se detecta", () => {
    const objetivo = "app/studio/(app)/reportes/_components/charts.tsx";
    expect(mutar(objetivo, 'tone = "var(--ink)",', 'tone = "var(--wine)",')).toBe(1);
  });
});

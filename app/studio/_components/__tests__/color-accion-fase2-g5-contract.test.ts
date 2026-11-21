/**
 * SDD-0686 · fase 2, grupo 5 (BD-076): el vino de los módulos de operación
 * de la oficina: despacho, calendario, tms, operarios, etiquetas, cola-qr,
 * tarifas y reclamos.
 *
 * El grupo cierra sin vino por token, clase ni tono (lo cuenta
 * `vino-detector.ts`); aquí no hay identidad que conservar. Los hex escritos
 * a mano de la etiqueta impresa (`Label.tsx`) son de la fase 4: el detector
 * no los ve. El feriado de China pasa a atención (`--warning`) con su Badge
 * «CN»; el crítico, que para la operación, va en peligro con su ícono.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const GRUPO_5 = ["despacho", "calendario", "tms", "operarios", "etiquetas", "cola-qr", "tarifas", "reclamos"].map(
  (m) => `app/studio/(app)/${m}`,
);

const leer = (ruta: string) => readFileSync(ruta, "utf8");
const archivos = () => GRUPO_5.flatMap((b) => fuentesDe(join(RAIZ, b), /\.(tsx?|css)$/));

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

describe("SDD-0686 fase 2 · grupo 5: la operación de la oficina queda sin vino", () => {
  it("mide algo: el grupo 5 tiene al menos 60 archivos de producción", () => {
    expect(archivos().length).toBeGreaterThanOrEqual(60);
  });

  it("ningún archivo del grupo usa vino", () => {
    expect(cuentas(leer)).toEqual({});
  });

  it("mutante: el feriado de China otra vez en vino se detecta", () => {
    const objetivo = "app/studio/(app)/calendario/_components/AgendaView.tsx";
    expect(mutar(objetivo, '"CN" ? "warning" : "success"', '"CN" ? "wine" : "success"')).toBe(1);
  });

  it("mutante: un KPI de flota en vino se detecta", () => {
    const objetivo = "app/studio/(app)/tms/_components/IncidentsTab.tsx";
    expect(mutar(objetivo, 'sub="Programados"\n          valueColor="var(--ink)"', 'sub="Programados"\n          valueColor="var(--wine-text)"')).toBe(1);
  });
});

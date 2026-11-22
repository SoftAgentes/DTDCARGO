/**
 * SDD-0686 · fase 2, grupo 4 (BD-076): el vino de las pantallas de dinero.
 * Son contabilidad, financiero-china, seniat, fiscal, cotizador, nómina,
 * proveedores, tesorería y gastos.
 *
 * El grupo cierra sin vino de acción ni de cifras, se escriba como se escriba
 * (lo cuenta `vino-detector.ts`). Saldos, deudas, débitos y totales van en
 * tinta: un monto va en rojo solo si está vencido (regla 4), y ningún vino de
 * estas pantallas marcaba un vencido. Lo único que queda es identidad: el
 * encabezado impreso de los libros fiscales (regla 8), con su cuenta exacta.
 * La lista solo baja.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const GRUPO_4 = [
  "contabilidad",
  "financiero-china",
  "seniat",
  "fiscal",
  "cotizador",
  "nomina",
  "proveedores",
  "tesoreria",
  "gastos",
].map((m) => `app/studio/(app)/${m}`);

/** Lo único que puede quedar en vino en el grupo 4, con su motivo. */
const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/studio/(app)/fiscal/_components/FiscalClient.tsx": {
    cuenta: 1,
    motivo: "encabezado impreso «DTD Cargo · Libros de IVA» (`.fp-eyebrow`): documento de marca, regla 8",
  },
  "app/studio/(app)/fiscal/_components/WithholdingsView.tsx": {
    cuenta: 1,
    motivo: "encabezado impreso «DTD Cargo · Retenciones» (`.fp-eyebrow`): documento de marca, regla 8",
  },
};

const leer = (ruta: string) => readFileSync(ruta, "utf8");
const archivos = () => GRUPO_4.flatMap((b) => fuentesDe(join(RAIZ, b), /\.(tsx?|css)$/));

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

describe("SDD-0686 fase 2 · grupo 4: en las pantallas de dinero solo queda identidad", () => {
  it("mide algo: el grupo 4 tiene al menos 100 archivos de producción", () => {
    expect(archivos().length).toBeGreaterThanOrEqual(100);
  });

  it("cada archivo con vino está en la lista permitida, con su cuenta exacta", () => {
    const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));
    expect(cuentas(leer)).toEqual(esperado);
  });

  it("mutante: devolver el vino al KPI «Por pagar» de tesorería rompe el contrato", () => {
    const objetivo = "app/studio/(app)/tesoreria/_components/TesoreriaClient.tsx";
    expect(mutar(objetivo, 'label="Por pagar"\n', 'label="Por pagar"\n          valueColor="var(--wine-text)"\n')).toBe(1);
  });

  it("mutante: un débito en vino por tono de Badge se detecta", () => {
    const objetivo = "app/studio/(app)/contabilidad/_components/ConciliacionTab.tsx";
    expect(mutar(objetivo, 'isCredit ? "success" : "neutral"', 'isCredit ? "success" : "wine"')).toBe(1);
  });
});

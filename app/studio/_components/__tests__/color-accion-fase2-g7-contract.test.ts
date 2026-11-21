/**
 * SDD-0686 · fase 2, grupo 7 (BD-076): naviera, fidelización, documentos,
 * órdenes de compra, órdenes de venta, club e inventario, con sus tipos de
 * `lib/studio`.
 *
 * El grupo cierra sin vino por token, clase ni tono (lo cuenta
 * `vino-detector.ts`; los hex escritos a mano son de la fase 4). La
 * sobrecapacidad del contenedor, que es peligro, va en `--danger`; la carga
 * suelta pendiente va en atención; los Shipping Mark, los códigos y las
 * cifras van en tinta; la selección, en tinta; los enlaces, en acción. El
 * tono guardado de la naviera (`carriers.tone`) cae a neutral al leerlo: lo
 * prueba `lib/studio/naviera/__tests__/carrier-tone.test.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const MODULOS = ["naviera", "fidelizacion", "documentos", "ordenes-compra", "ordenes-venta", "club", "inventario"].map(
  (m) => `app/studio/(app)/${m}`,
);
const LIB = ["naviera", "documents", "purchase-orders", "sales-orders", "club", "fidelizacion"].map(
  (m) => `lib/studio/${m}`,
);

const leer = (ruta: string) => readFileSync(ruta, "utf8");
const archivos = () => [...MODULOS, ...LIB].flatMap((b) => fuentesDe(join(RAIZ, b), /\.(tsx?|css)$/));

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

describe("SDD-0686 fase 2 · grupo 7: naviera, fidelización y órdenes sin vino", () => {
  it("mide algo: el grupo 7 tiene al menos 60 archivos de producción", () => {
    expect(archivos().length).toBeGreaterThanOrEqual(60);
  });

  it("ningún archivo del grupo 7 tiene vino", () => {
    expect(cuentas(leer)).toEqual({});
  });

  it("mutante: la sobrecapacidad otra vez en vino se detecta", () => {
    const objetivo = "app/studio/(app)/naviera/_components/UtilizationBar.tsx";
    expect(mutar(objetivo, 'if (pct > 100) return "var(--danger)";', 'if (pct > 100) return "var(--wine)";')).toBe(1);
  });

  it("mutante: el badge FCL otra vez en tono vino se detecta", () => {
    const objetivo = "app/studio/(app)/naviera/_components/NavieraClient.tsx";
    expect(mutar(objetivo, 'b.mode === "LCL" ? "info" : "neutral"', 'b.mode === "LCL" ? "info" : "wine"')).toBe(1);
  });

  it("mutante: la selección de carpeta de documentos otra vez en vino se detecta", () => {
    const objetivo = "app/studio/(app)/documentos/_components/DocumentosHubClient.tsx";
    expect(mutar(objetivo, 'color: topActive ? "var(--ink)" : "var(--ink-mute)",', 'color: topActive ? "var(--wine)" : "var(--ink-mute)",')).toBe(1);
  });
});

describe("SDD-0686 · arrastre de la #742: impresas de legal", () => {
  it("evidencia y expediente ya no declaran --wine", () => {
    for (const f of ["evidencia", "expediente"]) {
      expect(leer(join(RAIZ, `app/studio/(app)/legal/${f}/[code]/page.tsx`))).not.toMatch(/--wine\s*:/);
    }
  });
});

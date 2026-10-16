// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * SDD-0544 · con `NEXT_PUBLIC_GA_ID=off` los IDs de GA y Ads no llegan al bundle.
 *
 * La aceptación de la SDD-0540 (Fase 2) es «0 archivos de `.next/static` con
 * `G-25CD7BZH98` o `AW-561290482`». Vitest lee `process.env` en vivo y no ve lo
 * que hace el bundler, así que esta prueba repite sus dos pasos sobre
 * `components/Analytics.tsx` con el compilador de Next (SWC, el mismo que usa
 * Turbopack):
 *   1. el reemplazo de `process.env.NEXT_PUBLIC_GA_ID` y `process.env.NODE_ENV`
 *      por literales, que es lo que hace el define del build;
 *   2. la transformación de TSX y el minificador.
 * Si el apagado deja de ser una comparación que el minificador pliega (por
 * ejemplo, con un `.trim()` o un helper en medio: la 0518 midió que `"".trim()`
 * no se pliega), los IDs vuelven al código minificado y esta prueba falla.
 *
 * El build real con Turbopack se midió con un proyecto Next mínimo (handoff de
 * la 0544): `off` → 0 archivos de `.next/static` con cada ID; vacío → 1 y 1,
 * igual que `main`.
 */

// Cargar los bindings nativos de SWC toma unos segundos en frío.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

type Swc = {
  loadBindings: () => Promise<unknown>;
  transform: (src: string, opts: object) => Promise<{ code: string }>;
  minify: (src: string, opts: object) => Promise<{ code: string }>;
};

const require = createRequire(import.meta.url);
const swc = require("next/dist/build/swc") as Swc;
const FUENTE = readFileSync(resolve("components/Analytics.tsx"), "utf8");
const GA = "G-25CD7BZH98";
const ADS = "AW-561290482";

async function minificado(fuente: string, gaId: string): Promise<string> {
  const definido = fuente
    .split("process.env.NEXT_PUBLIC_GA_ID")
    .join(JSON.stringify(gaId))
    .split("process.env.NODE_ENV")
    .join(JSON.stringify("production"));
  const { code } = await swc.transform(definido, {
    filename: "Analytics.tsx",
    jsc: {
      parser: { syntax: "typescript", tsx: true },
      transform: { react: { runtime: "automatic" } },
      target: "es2022",
    },
    module: { type: "es6" },
  });
  return (await swc.minify(code, { compress: true, mangle: true, module: true })).code;
}

beforeAll(async () => {
  await swc.loadBindings();
});

describe("SDD-0544 · los IDs no llegan al bundle con el apagado", () => {
  it("off: ni el ID de la propiedad ni el de Ads quedan en el código minificado", async () => {
    const codigo = await minificado(FUENTE, "off");
    expect(codigo).not.toContain(GA);
    expect(codigo).not.toContain(ADS);
  });

  it("producción sin cambios: con el valor vacío quedan los dos IDs", async () => {
    const codigo = await minificado(FUENTE, "");
    expect(codigo).toContain(GA);
    expect(codigo).toContain(`${ADS}/qbu2CILjn7ocEPK50osC`);
  });

  it("producción sin cambios: con un ID propio queda ese ID y la etiqueta de Ads", async () => {
    const codigo = await minificado(FUENTE, "G-SYNTHETIC0544");
    expect(codigo).toContain("G-SYNTHETIC0544");
    expect(codigo).toContain(ADS);
  });

  it("control: un apagado con .trim() en medio no se pliega y deja los IDs", async () => {
    // La forma ingenua del apagado. Si este control dejara de dar rojo, la
    // prueba de arriba ya no distinguiría una forma correcta de una incorrecta.
    const ingenuo = FUENTE.split('process.env.NEXT_PUBLIC_GA_ID === "off"').join(
      'process.env.NEXT_PUBLIC_GA_ID?.trim() === "off"',
    );
    expect(ingenuo).not.toBe(FUENTE);
    const codigo = await minificado(ingenuo, "off");
    expect(codigo).toContain(ADS);
  });
});

// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * SDD-0684 · con Clarity apagado en el build, `clarity.ms` no llega al bundle.
 *
 * `build-image-prueba.yml` construye con `NEXT_PUBLIC_CLARITY_ID=off` y exige
 * 0 archivos de `.next/static` que nombren `clarity.ms`; producción, mientras
 * Sam no cree la variable, construye con el valor vacío. Mismo método que
 * `Analytics.apagado-build.test.ts` (SDD-0544): se repite el define del build
 * sobre `components/Clarity.tsx` y se pasa por la transformación y el
 * minificador de Next (SWC).
 */

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

type Swc = {
  loadBindings: () => Promise<unknown>;
  transform: (src: string, opts: object) => Promise<{ code: string }>;
  minify: (src: string, opts: object) => Promise<{ code: string }>;
};

const require = createRequire(import.meta.url);
const swc = require("next/dist/build/swc") as Swc;
const FUENTE = readFileSync(resolve("components/Clarity.tsx"), "utf8");

async function minificado(fuente: string, clarityId: string): Promise<string> {
  const definido = fuente.split("process.env.NEXT_PUBLIC_CLARITY_ID").join(JSON.stringify(clarityId));
  const { code } = await swc.transform(definido, {
    filename: "Clarity.tsx",
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

describe("SDD-0684 · clarity.ms no llega al bundle con el apagado", () => {
  it.each(["off", ""])("con %j el código minificado no nombra clarity.ms", async (valor) => {
    expect(await minificado(FUENTE, valor)).not.toContain("clarity.ms");
  });

  it("con un ID sí queda la etiqueta (la prueba distingue)", async () => {
    expect(await minificado(FUENTE, "synthetic00")).toContain("https://www.clarity.ms/tag/");
  });

  it("control: un apagado con .trim() en medio no se pliega y deja clarity.ms", async () => {
    const ingenuo = FUENTE.split('process.env.NEXT_PUBLIC_CLARITY_ID === "off"').join(
      'process.env.NEXT_PUBLIC_CLARITY_ID?.trim() === "off"',
    ).split("!process.env.NEXT_PUBLIC_CLARITY_ID;").join("!process.env.NEXT_PUBLIC_CLARITY_ID?.trim();");
    expect(ingenuo).not.toBe(FUENTE);
    expect(await minificado(ingenuo, "off")).toContain("clarity.ms");
  });
});

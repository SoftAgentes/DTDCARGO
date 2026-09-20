// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo.
 *
 * Aislado corre en ~1 s. Pero la suite tiene NUEVE contratos que hacen lo mismo
 * y vitest los reparte en paralelo sobre 427 archivos de test: compitiendo por
 * el mismo disco, la lectura se va a 26-53 s y expira contra el `testTimeout`
 * global de 20 s. Falla un conjunto DISTINTO cada corrida — la firma de la
 * contención, no de una regresión (una regresión falla el mismo test las dos
 * veces, y con una aserción, no con un reloj).
 *
 * El timeout se sube ACÁ y no en `vitest.config.ts` a propósito: subirlo global
 * relajaría los otros ~4.960 tests, donde 20 s ya es señal de que algo va mal.
 */
vi.setConfig({ testTimeout: 120_000 });


/**
 * Contrato de `.env.example`.
 *
 * Toda variable de entorno que el código lee tiene que estar documentada acá, o
 * levantar el proyecto obliga a leer el código para descubrir qué falta. Al
 * auditar el 2026-08-02 había 18 variables de configuración sin documentar,
 * entre ellas MARCA_ACCESS_SECRET (que sin valor cae a un default de desarrollo)
 * y tres de SeaRates que protegen la cuota mensual del plan.
 *
 * NO entran las que inyecta la plataforma ni los interruptores del harness: no
 * son configuración del proyecto y listarlas sólo haría ruido.
 */
const IGNORAR =
  /^(NODE_ENV|LOCALAPPDATA|VERCEL_(ENV|URL|GIT_.*|PROJECT_ID|TEAM_ID)|VERIFY_|E2E_|STUDIO_E2E_|SQL_TEST_PG_IMAGE|PLAYWRIGHT_BROWSERS_PATH)/;

const RAICES = ["lib", "app", "scripts", "components"];

function fuentes(dir: string, acc: string[] = []): string[] {
  let entradas;
  try {
    entradas = readdirSync(join(process.cwd(), dir), { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entradas) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if ([".next", "node_modules", ".git"].includes(e.name)) continue;
      fuentes(rel, acc);
    } else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
      acc.push(rel);
    }
  }
  return acc;
}

describe(".env.example documenta lo que el código lee", () => {
  it("no hay variables de configuración sin documentar", () => {
    const usadas = new Set<string>();
    for (const f of RAICES.flatMap((r) => fuentes(r))) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z_0-9]+)/g)) {
        usadas.add(m[1]);
      }
    }
    const ejemplo = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    // Límite de palabra, no `includes`: con subcadena, FOO se daría por
    // documentada porque existe FOO_BAR. Lo cazó una prueba de mutación.
    const documentada = (v: string) => new RegExp(`\\b${v}\\b`).test(ejemplo);
    const faltantes = [...usadas]
      .filter((v) => !IGNORAR.test(v) && !documentada(v))
      .sort();
    expect(faltantes).toEqual([]);
  });
});

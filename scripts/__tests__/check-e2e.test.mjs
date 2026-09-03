/**
 * SDD-0329 · Contrato de aislamiento de la salida de Next usada por el gate E2E.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  E2E_DIST_DIR,
  resolverArgumentosE2E,
  limpiarSalidaE2E,
  prepararSalidaE2E,
} from "../check-e2e.mjs";

const temporales = [];

function nuevaRaiz() {
  const raiz = mkdtempSync(path.join(os.tmpdir(), "dtd-e2e-output-"));
  temporales.push(raiz);
  return raiz;
}

afterEach(() => {
  for (const raiz of temporales.splice(0)) {
    rmSync(raiz, { recursive: true, force: true });
  }
});

describe("salida aislada del gate E2E", () => {
  it("precarga el guard sólo en Windows sin NODE_OPTIONS ni shell", () => {
    const args = ["--project=mobile-safari", "--reporter=json"];
    const windows = resolverArgumentosE2E(args, "win32");
    expect(windows[0]).toBe("--import");
    expect(path.isAbsolute(fileURLToPath(windows[1]))).toBe(true);
    expect(fileURLToPath(windows[1]).replaceAll("\\", "/")).toMatch(/\/scripts\/e2e\/webkit-exit\.mjs$/);
    expect(windows.slice(2)).toEqual(["node_modules/@playwright/test/cli.js", "test", ...args]);
    expect(resolverArgumentosE2E(args, "linux")).toEqual(["node_modules/@playwright/test/cli.js", "test", ...args]);
    expect(args).toEqual(["--project=mobile-safari", "--reporter=json"]);
  });
  it("elimina residuos anteriores sin tocar la caché normal .next", () => {
    const raiz = nuevaRaiz();
    const normal = path.join(raiz, ".next", "dev", "sentinel.txt");
    const aislada = path.join(raiz, E2E_DIST_DIR, "sentinel.txt");
    mkdirSync(path.dirname(normal), { recursive: true });
    mkdirSync(path.dirname(aislada), { recursive: true });
    writeFileSync(normal, "conservar");
    writeFileSync(aislada, "viejo");

    prepararSalidaE2E(raiz);

    expect(readFileSync(normal, "utf8")).toBe("conservar");
    expect(existsSync(path.join(raiz, E2E_DIST_DIR))).toBe(false);
  });

  it("restaura tsconfig byte por byte y borra la salida nueva", () => {
    const raiz = nuevaRaiz();
    const tsconfig = path.join(raiz, "tsconfig.json");
    const original = Buffer.from('{"include":["app/**/*.ts"]}\r\n', "utf8");
    writeFileSync(tsconfig, original);

    const estado = prepararSalidaE2E(raiz);
    writeFileSync(tsconfig, '{"include":[".next-verify-e2e/types/**/*.ts"]}\n');
    mkdirSync(estado.dist, { recursive: true });
    writeFileSync(path.join(estado.dist, "BUILD_ID"), "temporal");

    limpiarSalidaE2E(estado);

    expect(readFileSync(tsconfig).equals(original)).toBe(true);
    expect(existsSync(estado.dist)).toBe(false);
  });
});

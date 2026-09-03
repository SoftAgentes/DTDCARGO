#!/usr/bin/env node
/**
 * Ejecutor aislado del paso E2E del gate (SDD-0329).
 *
 * `next dev` usa `.next` por defecto. Reutilizar esa carpeta en el gate dejó
 * bundles incompatibles entre corridas consecutivas y produjo errores internos
 * de Webpack (`__webpack_require__.C`) antes de que cargara la página bajo
 * prueba. Este wrapper conserva intacta la caché normal del desarrollador:
 *
 * 1. borra únicamente `.next-verify-e2e` antes de arrancar;
 * 2. ejecuta Playwright con ese `distDir` exclusivo;
 * 3. restaura `tsconfig.json` byte por byte si Next lo modificó;
 * 4. borra la salida exclusiva también al fallar la suite.
 *
 * Exit 2 identifica un fallo del propio arnés (spawn o limpieza).
 * SDD-0378: ningún error global/real de E2E se absuelve.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export const E2E_DIST_DIR = ".next-verify-e2e";

export function resolverArgumentosE2E(argv, platform = process.platform) {
  const cli = ["node_modules/@playwright/test/cli.js", "test", ...argv];
  if (platform !== "win32") return cli;
  // fork() hereda execArgv: sólo CLI/workers, no NODE_OPTIONS en Next.
  return [
    "--import",
    pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "e2e", "webkit-exit.mjs")).href,
    ...cli,
  ];
}

function rutasAisladas(root) {
  const raiz = path.resolve(root);
  const dist = path.resolve(raiz, E2E_DIST_DIR);
  if (path.dirname(dist) !== raiz || path.basename(dist) !== E2E_DIST_DIR) {
    throw new Error("la salida E2E dejó de ser un hijo directo y conocido del repositorio");
  }
  return { raiz, dist, tsconfig: path.join(raiz, "tsconfig.json") };
}

export function prepararSalidaE2E(root = process.cwd()) {
  const rutas = rutasAisladas(root);
  const tsconfigAntes = existsSync(rutas.tsconfig)
    ? readFileSync(rutas.tsconfig)
    : null;

  rmSync(rutas.dist, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });

  return { ...rutas, tsconfigAntes };
}

export function limpiarSalidaE2E(estado) {
  if (estado.tsconfigAntes && existsSync(estado.tsconfig)) {
    const actual = readFileSync(estado.tsconfig);
    if (!actual.equals(estado.tsconfigAntes)) {
      writeFileSync(estado.tsconfig, estado.tsconfigAntes);
      console.log("[e2e] tsconfig.json restaurado (Next le inyectó el distDir)");
    }
  }

  rmSync(estado.dist, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

export function ejecutarE2EAislado(argv = process.argv.slice(2)) {
  let estado;
  try {
    estado = prepararSalidaE2E();
  } catch (error) {
    console.error("[e2e] no se pudo preparar la salida aislada:", error.message);
    return 2;
  }

  let code = 2;
  try {
    const resultado = spawnSync(
      process.execPath,
      resolverArgumentosE2E(argv),
      {
        cwd: estado.raiz,
        stdio: "inherit",
        env: { ...process.env, VERIFY_DIST_DIR: E2E_DIST_DIR },
      },
    );
    if (resultado.error) {
      console.error("[e2e] no se pudo ejecutar Playwright:", resultado.error.message);
      code = 2;
    } else {
      code = resultado.status ?? 2;
    }
  } finally {
    try {
      limpiarSalidaE2E(estado);
    } catch (error) {
      console.error("[e2e] la limpieza de la salida aislada falló:", error.message);
      code = 2;
    }
  }

  return code;
}

const esEntradaDirecta =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esEntradaDirecta) process.exit(ejecutarE2EAislado());

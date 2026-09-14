/**
 * SDD-0464: el paso `harness` de `pnpm verify` corre exactamente lo que corre
 * `pnpm harness:test`. Antes verify llevaba una lista manual de archivos y los
 * demás scripts/tests/*.node.mjs solo corrían en harness:test y en CI.
 *
 * Importar verify.mjs desde una prueba solo es posible porque su ejecución vive
 * detrás de una frontera CLI/import; la segunda prueba lo demuestra en un
 * proceso aparte.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STEPS } from "../verify.mjs";
import { HARNESS_TESTS_DIRECTORY, HARNESS_TEST_SUFFIX, discoverHarnessTests } from "./run-harness.mjs";

const repo = fileURLToPath(new URL("../..", import.meta.url));

test("el paso harness de verify corre exactamente los archivos que descubre harness:test", () => {
  const step = STEPS.find((candidate) => candidate.name === "harness");
  const discovered = discoverHarnessTests();

  assert.ok(step, "verify declara el paso harness");
  assert.deepEqual(step.argv, ["--test", ...discovered]);
  assert.equal(HARNESS_TESTS_DIRECTORY, path.join("scripts", "tests"));
  assert.equal(HARNESS_TEST_SUFFIX, ".node.mjs");

  // El descubrimiento es real: trae los cinco archivos de la lista manual
  // anterior, los que esa lista omitía y esta misma prueba.
  for (const name of [
    "director-status",
    "harness-worktree",
    "next-number.integration",
    "verify-critical-coverage",
    "verify-watchdog",
    "harness-discovery",
    "merge-generated-records",
    "pending-migration-symbols-utf16",
    "verify-harness-discovery",
  ]) {
    assert.ok(discovered.some((file) => file.endsWith(`${name}${HARNESS_TEST_SUFFIX}`)), `${name} descubierto`);
  }
  for (const file of discovered) assert.ok(file.endsWith(HARNESS_TEST_SUFFIX), `${file} no es un test del harness`);

  const { scripts } = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
  assert.equal(scripts["harness:test"], "node scripts/tests/run-harness.mjs");
});

test("importar verify.mjs expone los pasos sin lanzar el gate", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const verifyUrl = pathToFileURL(path.join(repo, "scripts", "verify.mjs")).href;
  const code = [
    `const verify = await import(${JSON.stringify(verifyUrl)});`,
    "console.log(JSON.stringify({ steps: verify.STEPS.map((step) => step.name), main: typeof verify.main }));",
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: repo,
    encoding: "utf8",
    env,
    windowsHide: true,
    timeout: 90_000,
  });

  assert.ifError(result.error);
  assert.equal(result.signal, null, "el import no puede colgar ni correr el gate entero");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout.trim().split(/\r?\n/).pop());
  assert.equal(report.main, "function");
  assert.ok(report.steps.includes("harness") && report.steps.includes("build"), report.steps.join(", "));
  // Ningún paso arrancó: el gate imprime «── <paso> ──» al iniciar cada uno.
  assert.doesNotMatch(result.stdout + result.stderr, /── (harness|lint) ──/);
});

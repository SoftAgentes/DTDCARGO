/**
 * Las dos decisiones del paso `e2e` del gate, separadas de `verify.mjs` para
 * poder PROBARLAS: qué puerto usa el dev server y si el reporte acredita una
 * corrida completa. SDD-0378: un fallo global nunca se absuelve por sus contadores.
 *
 * Viven juntas porque fallaron juntas el 2026-08-25, y la segunda tapó a la
 * primera: el puerto cayó en un rango que Windows reserva, el dev server nunca
 * levantó, la suite corrió CERO tests y el gate imprimió `[OK] e2e (con aviso)`.
 */

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const PUERTO_BASE = 3100;
export const PUERTO_RANGO = 700; // 3100–3799
/** Coprimo con 700 → la sucesión recorre el rango ENTERO sin repetir. */
const PASO = 101;

/**
 * Puertos candidatos para el dev server del e2e, en orden de preferencia.
 *
 * DETERMINÍSTICO POR WORKTREE: el primero sale del hash del directorio, así que
 * dos ventanas en carpetas distintas nunca se pelean el mismo puerto — que es
 * lo que este cálculo vino a resolver, para que Playwright no reuse con
 * `reuseExistingServer` el `next dev` de OTRA ventana y mida código ajeno.
 *
 * PERO YA NO ES UNO SOLO, y ahí estaba el bug. Windows reserva rangos enteros
 * para Hyper-V/WSL (`netsh interface ipv4 show excludedportrange protocol=tcp`)
 * y en esta máquina el bloque va de **3308 a 3807 sin cortes** — casi todo el
 * rango de arriba. Al worktree `cambios-erp` le tocó el 3365 y el servidor
 * murió con `EACCES: permission denied 0.0.0.0:3365`.
 *
 * ⚠️ Los saltos son de 101 y NO de 1 a propósito: con pasos de 1 los 40
 * candidatos caerían todos dentro del mismo bloque reservado, que mide
 * cientos de puertos, y la lista entera sería inútil.
 */
export function candidatosDePuerto(cwd, cuantos = 40) {
  const h = crypto.createHash("sha1").update(cwd).digest();
  const base = h.readUInt16BE(0) % PUERTO_RANGO;
  return Array.from({ length: Math.min(cuantos, PUERTO_RANGO) }, (_, i) =>
    PUERTO_BASE + ((base + i * PASO) % PUERTO_RANGO),
  );
}

/**
 * El primer candidato en el que el sistema operativo DEJA escuchar, o `null`.
 *
 * No se parsea la salida de `netsh`: sus encabezados están traducidos y varían
 * por máquina. Se prueba a atar el puerto, que es la pregunta real y no depende
 * de adivinar por qué está prohibido — reservado por Hyper-V, tomado por otro
 * worktree o por cualquier otro proceso, da igual.
 *
 * Corre en un hijo porque el gate resuelve esto de forma síncrona.
 */
export function primerPuertoLibre(candidatos) {
  const guion = `
    const net = require("node:net");
    const puertos = ${JSON.stringify(candidatos)};
    (async () => {
      for (const p of puertos) {
        const libre = await new Promise((res) => {
          const s = net.createServer();
          s.once("error", () => res(false));
          s.listen(p, "0.0.0.0", () => s.close(() => res(true)));
        });
        if (libre) { process.stdout.write(String(p)); return; }
      }
    })();
  `;
  const r = spawnSync(process.execPath, ["-e", guion], { encoding: "utf8" });
  const p = Number(String(r.stdout ?? "").trim());
  return Number.isInteger(p) && p > 0 ? p : null;
}

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const outcomes = ["expected", "unexpected", "flaky", "skipped"];
const resultStatuses = ["passed", "failed", "timedOut", "skipped"];

/** Lee todas las hojas; una estructura parcialmente legible no acredita cobertura. */
function reportTests(suites, tests = []) {
  if (!Array.isArray(suites)) throw new Error("suites inválidas");
  for (const suite of suites) {
    if (!record(suite)) throw new Error("suite inválida");
    if (suite.specs !== undefined) {
      if (!Array.isArray(suite.specs)) throw new Error("specs inválidos");
      for (const spec of suite.specs) {
        if (!record(spec) || !Array.isArray(spec.tests) || spec.tests.length === 0) {
          throw new Error("tests inválidos");
        }
        tests.push(...spec.tests);
      }
    }
    if (suite.suites !== undefined) reportTests(suite.suites, tests);
  }
  return tests;
}

function resultMessages(result) {
  if (!Array.isArray(result.errors)) throw new Error("errors de resultado inválidos");
  const errors = result.error === undefined ? result.errors : [result.error, ...result.errors];
  if (errors.some((error) => !record(error) || typeof error.message !== "string" || !error.message.trim())) {
    throw new Error("mensaje de error inválido");
  }
  return errors.map((error) => error.message);
}

/**
 * SDD-0378. Valida salida, errores globales, estructura y hojas del JSONReporter.
 * Nunca diagnostica un motor a partir de expected/unexpected. Sólo un fallo
 * exclusivo de lanzamiento ausente permite SKIP parcial; no acredita éxito.
 */
export function classifyE2EReport(exitStatus, report) {
  const fail = (reason) => ({ status: "fail", reason });
  if (exitStatus !== 0 && exitStatus !== 1) return fail("E2E: salida de wrapper, señal o código no reconocido.");
  if (!record(report) || !Array.isArray(report.errors)) return fail("E2E: reporte ausente o inválido.");
  if (report.errors.length > 0) return fail("E2E: hay errores globales; revisar el JSON conservado.");
  const stats = report.stats;
  if (!record(stats) || outcomes.some((key) => !Number.isSafeInteger(stats[key]) || stats[key] < 0)) {
    return fail("E2E: contadores ausentes o inválidos.");
  }
  let tests;
  try {
    tests = reportTests(report.suites);
    const counts = Object.fromEntries(outcomes.map((key) => [key, 0]));
    for (const test of tests) {
      if (!record(test) || !outcomes.includes(test.status) || !resultStatuses.includes(test.expectedStatus)
        || !Array.isArray(test.results) || test.results.length === 0) throw new Error("hoja incompleta");
      counts[test.status]++;
      for (const result of test.results) {
        if (!record(result) || !resultStatuses.includes(result.status)) throw new Error("resultado interrumpido o inválido");
        const messages = resultMessages(result);
        if (["passed", "skipped"].includes(result.status) && messages.length > 0) throw new Error("errores en resultado aprobado");
      }
      // JSONReporter calcula el outcome con TODOS los intentos, no sólo el último.
      // Los skipped no equivalen a un intento fallido recuperado.
      let expected = 0;
      let unexpected = 0;
      let skipped = 0;
      for (const result of test.results) {
        if (result.status === "skipped") {
          if (test.expectedStatus === "skipped") skipped++;
        } else if (result.status === test.expectedStatus) expected++;
        else unexpected++;
      }
      const outcome = expected === 0 && unexpected === 0 ? "skipped"
        : unexpected === 0 ? "expected"
          : expected === 0 && skipped === 0 ? "unexpected" : "flaky";
      if (outcome !== test.status) throw new Error("outcome no corresponde a sus intentos");
      const last = test.results.at(-1);
      if (test.status === "skipped" && last.status !== "skipped") throw new Error("salto incoherente");
      if (test.status === "expected" && (last.status !== test.expectedStatus || last.status === "skipped")) {
        throw new Error("aprobación incoherente");
      }
      if (test.status === "flaky" && (last.status !== test.expectedStatus || last.status === "skipped"
        || !test.results.slice(0, -1).some((result) => result.status !== test.expectedStatus))) {
        throw new Error("reintento incoherente");
      }
      if (test.status === "unexpected" && last.status === test.expectedStatus) throw new Error("fallo incoherente");
    }
    if (outcomes.some((key) => counts[key] !== stats[key])) throw new Error("contadores no corresponden a hojas");
  } catch (error) {
    return fail(`E2E: reporte incoherente (${error.message}).`);
  }
  if (stats.unexpected > 0) {
    const failedTests = tests.filter((test) => test.status === "unexpected");
    const missingOnly = failedTests.every((test) => test.results.every((result) => {
      const messages = resultMessages(result);
      return result.status === "failed" && messages.length > 0
        && messages.every((message) => /^browserType\.launch: Executable doesn't exist at [^\r\n]+/.test(message));
    }));
    if (exitStatus === 1 && missingOnly) {
      const projects = [...new Set(failedTests.map((test) => test.projectName ?? "proyecto sin nombre"))].sort();
      return { status: "skip", reason: `E2E: cobertura incompleta; falta el navegador de ${projects.join(", ")}. No es una aprobación.` };
    }
    return fail("E2E: hay pruebas fallidas; revisar el JSON conservado.");
  }
  if (exitStatus !== 0) return fail("E2E: proceso fallido aunque las hojas no declaren fallos.");
  if (stats.expected + stats.flaky === 0) return fail("E2E: cero pruebas aprobadas no acredita una corrida.");
  return { status: "pass", reason: `E2E: ${stats.expected} aprobadas, ${stats.flaky} recuperadas, ${stats.skipped} omitidas explícitamente.` };
}

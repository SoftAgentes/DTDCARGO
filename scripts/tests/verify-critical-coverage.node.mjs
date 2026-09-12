import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const STEP_NAMES = [
  "harness",
  "lint",
  "rsc-boundary",
  "typecheck",
  "edge-functions",
  "test",
  "docs:check",
  "numbering",
  "feature-constants",
  "components:check",
  "governance:check",
  "migrations-applied",
  "pending-migration-symbols",
  "sql-tests",
  "schema-rebuild",
  "e2e",
  "build",
];

async function loadPolicy() {
  return import("../verify-step-policy.mjs");
}

test("verify conecta la política explícita al veredicto final", async () => {
  const source = await readFile(new URL("../verify.mjs", import.meta.url), "utf8");
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );

  assert.match(source, /assertCompleteStepPolicy/);
  assert.match(source, /buildVerifyVerdict/);
  assert.match(source, /scripts\/tests\/verify-critical-coverage\.node\.mjs/);
  assert.match(
    packageJson.scripts["harness:test"],
    /scripts\/tests\/run-harness\.mjs/,
  );
});

test("todos los pasos tienen clasificación y motivo, sin entradas huérfanas", async () => {
  const { STEP_POLICY, assertCompleteStepPolicy } = await loadPolicy();

  assert.doesNotThrow(() => assertCompleteStepPolicy(STEP_NAMES));
  assert.deepEqual(Object.keys(STEP_POLICY).sort(), [...STEP_NAMES].sort());
  for (const [name, policy] of Object.entries(STEP_POLICY)) {
    assert.equal(typeof policy.critical, "boolean", `${name}: falta critical booleano`);
    assert.match(policy.reason, /\S/, `${name}: falta motivo legible`);
  }
  assert.equal(STEP_POLICY["migrations-applied"].critical, true);
});

test("un crítico sin medir no se confunde con un cierre completo", async () => {
  const { buildVerifyVerdict } = await loadPolicy();
  const complete = buildVerifyVerdict({
    stepNames: ["lint", "migrations-applied"],
    skipped: [],
    failures: [],
  });
  const incomplete = buildVerifyVerdict({
    stepNames: ["lint", "migrations-applied"],
    skipped: [{ name: "migrations-applied", reason: "sin credenciales" }],
    failures: [],
  });

  assert.equal(complete.kind, "complete");
  assert.equal(complete.tone, "ok");
  assert.equal(complete.exitCode, 0);
  assert.equal(complete.message, "verify: TODO VERDE ✓ (2/2 pasos medidos)");

  assert.equal(incomplete.kind, "critical-unmeasured");
  assert.equal(incomplete.exitCode, 0);
  assert.match(incomplete.message, /CIERRE INCOMPLETO/);
  assert.match(incomplete.message, /CRÍTICOS SIN MEDIR: migrations-applied/);
  assert.match(incomplete.message, /exit 0 NO equivale a cierre verde completo/);
  assert.doesNotMatch(incomplete.message, /TODO VERDE/);
  assert.notEqual(incomplete.message, complete.message);
});

test("un omitido no crítico queda como cobertura parcial, no como crítico", async () => {
  const { buildVerifyVerdict } = await loadPolicy();
  const verdict = buildVerifyVerdict({
    stepNames: ["lint", "docs:check"],
    skipped: [{ name: "docs:check", reason: "fixture" }],
    failures: [],
  });

  assert.equal(verdict.kind, "noncritical-unmeasured");
  assert.equal(verdict.exitCode, 0);
  assert.match(verdict.message, /COBERTURA PARCIAL/);
  assert.match(verdict.message, /no críticos sin medir: docs:check/);
  assert.doesNotMatch(verdict.message, /CRÍTICOS SIN MEDIR/);
  assert.doesNotMatch(verdict.message, /TODO VERDE/);
});

test("un fallo conserva exit 1 y además nombra los críticos sin medir", async () => {
  const { buildVerifyVerdict } = await loadPolicy();
  const verdict = buildVerifyVerdict({
    stepNames: ["lint", "migrations-applied"],
    skipped: [{ name: "migrations-applied", reason: "sin credenciales" }],
    failures: ["lint"],
  });

  assert.equal(verdict.kind, "failed");
  assert.equal(verdict.exitCode, 1);
  assert.match(verdict.message, /1 fallo\(s\) → lint/);
  assert.match(verdict.message, /CRÍTICOS SIN MEDIR: migrations-applied/);
});

test("un fallo con cobertura completa conserva el cierre rojo previo sin avisos nuevos", async () => {
  const { buildVerifyVerdict } = await loadPolicy();
  const verdict = buildVerifyVerdict({
    stepNames: ["lint", "migrations-applied"],
    skipped: [],
    failures: ["lint"],
  });

  assert.equal(verdict.kind, "failed");
  assert.equal(verdict.tone, "fail");
  assert.equal(verdict.exitCode, 1);
  assert.equal(verdict.message, "verify: 1 fallo(s) → lint");
  assert.doesNotMatch(verdict.message, /INCOMPLETO|SIN MEDIR|COBERTURA PARCIAL/);
});

test("un paso colgado es un fallo con motivo en la línea final, nunca una omisión", async () => {
  const { buildVerifyVerdict } = await loadPolicy();
  const reason =
    "COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)";
  const verdict = buildVerifyVerdict({
    stepNames: ["lint", "e2e", "build"],
    skipped: [],
    failures: [{ name: "e2e", reason }],
  });

  assert.equal(verdict.kind, "failed");
  assert.equal(verdict.tone, "fail");
  assert.equal(verdict.exitCode, 1);
  assert.equal(verdict.message, `verify: 1 fallo(s) → e2e [${reason}]`);
  assert.deepEqual(verdict.criticalMissing, []);
  assert.doesNotMatch(verdict.message, /TODO VERDE|SIN MEDIR|COBERTURA PARCIAL/);

  const mixed = buildVerifyVerdict({
    stepNames: ["lint", "e2e", "migrations-applied"],
    skipped: [{ name: "migrations-applied", reason: "sin credenciales" }],
    failures: ["lint", { name: "e2e", reason }],
  });
  assert.match(mixed.message, /^verify: 2 fallo\(s\) → lint, e2e \[COLGADO\/TIMEOUT: /);
  assert.match(mixed.message, /CRÍTICOS SIN MEDIR: migrations-applied\./);
  assert.deepEqual(mixed.criticalMissing, ["migrations-applied"]);

  assert.throws(
    () => buildVerifyVerdict({ stepNames: ["e2e"], skipped: [], failures: [{ name: "e2e", reason: "  " }] }),
    /motivo vacío: e2e/,
  );
  assert.throws(
    () => buildVerifyVerdict({ stepNames: ["e2e"], skipped: [], failures: [{ name: "otro", reason }] }),
    /pasos desconocidos: otro/,
  );
});

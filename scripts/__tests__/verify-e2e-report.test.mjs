// @vitest-environment node
/** SDD-0378: un resultado global incompleto nunca es una corrida verde. */
import { describe, expect, it } from "vitest";
import { classifyE2EReport as classify } from "../verify-e2e.mjs";

const missingMessage = "browserType.launch: Executable doesn't exist at C:/synthetic/ms-playwright/browser.exe";
const result = (status = "passed", messages = []) => ({
  status,
  errors: messages.map((message) => ({ message })),
});
const passed = () => ({ expectedStatus: "passed", status: "expected", results: [result()] });
const skipped = () => ({ expectedStatus: "skipped", status: "skipped", results: [result("skipped")] });
const flaky = () => ({ expectedStatus: "passed", status: "flaky", results: [result("failed", ["Synthetic initial assertion"]), result()] });
const absent = () => ({ expectedStatus: "passed", status: "unexpected", results: [result("failed", [missingMessage])] });
const failed = () => ({ expectedStatus: "passed", status: "unexpected", results: [result("failed", ["Synthetic assertion failed"])] });

function reportFor(tests = [passed()]) {
  const stats = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  const specs = tests.map((test, index) => {
    stats[test.status]++;
    return { title: `synthetic-${index}`, tests: [{ projectName: `synthetic-project-${index}`, ...test }] };
  });
  return { errors: [], stats, suites: [{ title: "synthetic root", suites: [{ title: "nested", specs }] }] };
}

function firstTest(report) {
  return report.suites[0].suites[0].specs[0].tests[0];
}

function expectStatus(exitStatus, report, status) {
  const decision = classify(exitStatus, report);
  expect(decision).toEqual({ status, reason: expect.any(String) });
  expect(decision.reason.trim()).not.toBe("");
  return decision;
}

describe("classifyE2EReport · lifecycle fail-closed", () => {
  it.each([0, 1])("rechaza timeout global de suite aunque los tests pasen (exit %s)", (exitStatus) => {
    const report = reportFor();
    report.errors = [{ message: "Timed out waiting 480s for the entire test run." }];
    expectStatus(exitStatus, report, "fail");
  });

  it.each([0, 1])("rechaza timeout global de teardown aunque los tests pasen (exit %s)", (exitStatus) => {
    const report = reportFor();
    report.errors = [{ message: "Timed out waiting 30000ms for the global teardown." }];
    expectStatus(exitStatus, report, "fail");
  });

  it.each([undefined, null, {}, "error", [null], [{}]].map((value) => [value]))("rechaza errors ausente o malformado: %j", (errors) => {
    const report = reportFor();
    report.errors = errors;
    expectStatus(0, report, "fail");
  });

  it.each([2, null, undefined, -1, 7, "0", "1"])("rechaza wrapper, señal o exit desconocido: %s", (exitStatus) => {
    expectStatus(exitStatus, reportFor(), "fail");
  });

  it.each([undefined, null, [], "{incomplete", 1, {}].map((value) => [value]))("rechaza reporte ilegible o inválido: %j", (report) => {
    expectStatus(0, report, "fail");
  });

  it("no atribuye un exit1 sin causa a WebKit ni lo convierte en éxito", () => {
    expectStatus(1, reportFor(), "fail");
  });

  it("acepta un reporte completo con tests aprobados y exit0", () => {
    expectStatus(0, reportFor([passed(), passed()]), "pass");
  });

  it("conserva un fallo esperado declarado explícitamente por la prueba", () => {
    const expectedFailure = {
      expectedStatus: "failed",
      status: "expected",
      results: [result("failed", ["Synthetic failure declared by test.fail()"])],
    };
    expectStatus(0, reportFor([expectedFailure]), "pass");
  });

  it("conserva los retries individuales: flaky recuperado y exit0 es aprobado", () => {
    expectStatus(0, reportFor([flaky()]), "pass");
  });

  it("acepta aprobados y omitidos explícitos sin certificar ejecuciones ausentes", () => {
    expectStatus(0, reportFor([passed(), skipped()]), "pass");
  });

  it("acepta flaky recuperado más omitidos explícitos", () => {
    expectStatus(0, reportFor([flaky(), skipped()]), "pass");
  });

  it.each([0, 1])("cero pruebas aprobadas no es verde (exit %s)", (exitStatus) => {
    expectStatus(exitStatus, reportFor([]), "fail");
  });

  it("sólo tests omitidos no constituyen una aprobación", () => {
    expectStatus(0, reportFor([skipped(), skipped()]), "fail");
  });
});

describe("classifyE2EReport · coherencia del reporte", () => {
  it.each(["expected", "unexpected", "flaky", "skipped"])("exige %s entero no negativo", (counter) => {
    for (const value of [undefined, null, "1", -1, 0.5, NaN, Infinity]) {
      const report = reportFor();
      report.stats[counter] = value;
      expectStatus(0, report, "fail");
    }
  });

  it.each(["expected", "unexpected", "flaky", "skipped"])("rechaza counter %s que no corresponde a las hojas", (counter) => {
    const report = reportFor();
    report.stats[counter]++;
    expectStatus(0, report, "fail");
  });

  it.each([undefined, null, [], "stats"].map((value) => [value]))("rechaza stats inválidos: %j", (stats) => {
    const report = reportFor();
    report.stats = stats;
    expectStatus(0, report, "fail");
  });

  it.each([undefined, null, {}, "suites"])("rechaza suites inválidas: %j", (suites) => {
    const report = reportFor();
    report.suites = suites;
    expectStatus(0, report, "fail");
  });

  it("rechaza aprobación declarada sin hojas de tests", () => {
    const report = reportFor();
    report.suites = [];
    expectStatus(0, report, "fail");
  });

  it("rechaza un grupo de tests malformado dentro de una suite válida", () => {
    const report = reportFor();
    report.suites[0].suites[0].specs[0].tests = {};
    expectStatus(0, report, "fail");
  });

  it.each([undefined, null, "unknown", "passed", "interrupted"])("rechaza status de hoja desconocido: %j", (status) => {
    const report = reportFor();
    firstTest(report).status = status;
    expectStatus(0, report, "fail");
  });

  it.each([undefined, null, {}, []].map((value) => [value]))("rechaza resultados ausentes/malformados: %j", (results) => {
    const report = reportFor();
    firstTest(report).results = results;
    expectStatus(0, report, "fail");
  });

  it.each(["interrupted", "unknown", "failed", "timedOut", "skipped"])("no acepta expected cuando el resultado final es %s", (status) => {
    const report = reportFor();
    firstTest(report).results = [result(status)];
    expectStatus(0, report, "fail");
  });

  it("no acepta flaky cuyo último retry sigue fallando", () => {
    const report = reportFor([flaky()]);
    firstTest(report).results.push(result("failed", ["Synthetic final assertion"]));
    expectStatus(0, report, "fail");
  });

  it("un resultado interrumpido no se disfraza de flaky recuperado", () => {
    const report = reportFor([flaky()]);
    firstTest(report).results[0].status = "interrupted";
    expectStatus(0, report, "fail");
  });

  it("expected no puede ocultar un retry previo fallido que lo convierte en flaky", () => {
    const report = reportFor();
    firstTest(report).results.unshift(result("failed", ["Synthetic earlier assertion failed"]));
    expectStatus(0, report, "fail");
  });

  it("skipped no puede ocultar un intento anterior realmente fallido", () => {
    const report = reportFor([passed(), skipped()]);
    const omitted = report.suites[0].suites[0].specs[1].tests[0];
    omitted.expectedStatus = "passed";
    omitted.results.unshift(result("failed", ["Synthetic failed attempt before skip"]));
    expectStatus(0, report, "fail");
  });

  it("flaky no puede inventar recuperación de un intento sólo omitido", () => {
    const report = reportFor([flaky()]);
    firstTest(report).results[0] = result("skipped");
    expectStatus(0, report, "fail");
  });

  it("rechaza error real en hoja unexpected incluso si el proceso devuelve0", () => {
    expectStatus(0, reportFor([passed(), failed()]), "fail");
  });

  it.each(["error", "errors"])("passed con error real en %s no acredita éxito", (field) => {
    const report = reportFor();
    const error = { message: "Synthetic teardown assertion after the test passed" };
    firstTest(report).results[0][field] = field === "error" ? error : [error];
    expectStatus(0, report, "fail");
  });
});

describe("classifyE2EReport · cobertura omitida por navegador ausente", () => {
  it("navegador ausente exclusivo es skip, no pass", () => {
    const decision = expectStatus(1, reportFor([absent()]), "skip");
    expect(decision.reason).toContain("synthetic-project-0");
  });

  it("mezcla aprobados, omitidos y navegador ausente exclusivo es skip parcial", () => {
    const decision = expectStatus(1, reportFor([passed(), skipped(), absent()]), "skip");
    expect(decision.reason).toContain("synthetic-project-2");
  });

  it("conserva múltiples intentos fallidos sólo por lanzamiento ausente", () => {
    const report = reportFor([absent()]);
    firstTest(report).results.push(result("failed", [missingMessage]));
    expectStatus(1, report, "skip");
  });

  it("acepta el formato error además de errors del JSONReporter", () => {
    const report = reportFor([absent()]);
    firstTest(report).results[0] = { status: "failed", error: { message: missingMessage }, errors: [] };
    expectStatus(1, report, "skip");
  });

  it("errores globales prevalecen sobre navegador ausente", () => {
    const report = reportFor([absent()]);
    report.errors = [{ message: "Synthetic global teardown failure" }];
    expectStatus(1, report, "fail");
  });

  it("afterAll real dentro del mismo resultado impide skip", () => {
    const report = reportFor([absent()]);
    firstTest(report).results[0].errors.push({ message: "Synthetic afterAll assertion failed" });
    expectStatus(1, report, "fail");
  });

  it("un error real en error no se oculta por un mensaje de lanzamiento en errors", () => {
    const report = reportFor([absent()]);
    firstTest(report).results[0].error = { message: "Synthetic teardown database failure" };
    expectStatus(1, report, "fail");
  });

  it("un retry con error real impide skip aunque otro sólo reporte navegador ausente", () => {
    const report = reportFor([absent()]);
    firstTest(report).results.push(result("failed", ["Synthetic actual assertion failed"]));
    expectStatus(1, report, "fail");
  });

  it("un test real fallido impide skip aunque otro sólo reporte navegador ausente", () => {
    expectStatus(1, reportFor([absent(), failed()]), "fail");
  });

  it("un resultado interrumpido impide skip aunque cite el ejecutable ausente", () => {
    const report = reportFor([absent()]);
    firstTest(report).results[0].status = "interrupted";
    expectStatus(1, report, "fail");
  });

  it.each([[], [{ message: "" }], [{}], [null], "invalid"].map((value) => [value]))("errores vacíos o malformados no justifican skip: %j", (errors) => {
    const report = reportFor([absent()]);
    firstTest(report).results[0].errors = errors;
    expectStatus(1, report, "fail");
  });

  it("el texto Executable doesn't exist dentro de una aserción no es lanzamiento ausente", () => {
    const report = reportFor([absent()]);
    firstTest(report).results[0].errors = [{ message: "expect(text).toContain(Executable doesn't exist) failed" }];
    expectStatus(1, report, "fail");
  });

  it("counter unexpected no concordante impide absolver navegador ausente", () => {
    const report = reportFor([absent()]);
    report.stats.unexpected = 2;
    expectStatus(1, report, "fail");
  });
});

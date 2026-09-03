// @vitest-environment node
/** SDD-0378: ejecuta el bucle real; ningún transporte sale de esta VM. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { classifyE2EReport, candidatosDePuerto, PUERTO_BASE, PUERTO_RANGO } from "../verify-e2e.mjs";

const verifySource = fs.readFileSync(new URL("../verify.mjs", import.meta.url), "utf8")
  // Sólo se sustituyen imports por dependencias de la VM; funciones, STEPS,
  // beforeRun, clasificación, retries, resumen y process.exit son los reales.
  .replace(/^import[\s\S]*?;\r?\n/gm, "");

const missingMessage = "browserType.launch: Executable doesn't exist at C:/synthetic/browser.exe";
function goodReport() {
  return {
    errors: [], stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    suites: [{ specs: [{ tests: [{ projectName: "synthetic-chromium", expectedStatus: "passed",
      status: "expected", results: [{ status: "passed", errors: [] }] }] }] }],
  };
}

function missingReport() {
  const report = goodReport();
  report.stats.unexpected = 1;
  report.suites[0].specs[0].tests.push({
    projectName: "synthetic-mobile", expectedStatus: "passed", status: "unexpected",
    results: [{ status: "failed", errors: [{ message: missingMessage }] }],
  });
  return report;
}

function runSyntheticGate({
  e2eStatus = 0, report = goodReport(), buildStatus = 0,
  stale = "synthetic stale report", removeError = false,
  writeReport = true, rawReport, environment = {}, stepStatuses = {},
} = {}) {
  const output = [];
  const events = [];
  const jsonPath = path.join("synthetic-tmp", "dtd-e2e-424242.json");
  const exitSignal = {};
  let stored = stale;
  let exitCode;
  const context = {
    classifyE2EReport, candidatosDePuerto, PUERTO_BASE, PUERTO_RANGO,
    primerPuertoLibre: () => { throw new Error("No se permite sondear puertos en esta prueba"); },
    path, os: { tmpdir: () => "synthetic-tmp", homedir: () => "synthetic-home" },
    podarTiposDeRuta: () => [], notaDePoda: () => null,
    fs: {
      readdirSync: () => ["chromium-synthetic"],
      readFileSync: (filename) => {
        if (filename !== jsonPath || stored === undefined) throw new Error("ENOENT synthetic fixture");
        events.push({ type: "read-report", stored });
        return stored;
      },
      rmSync: (filename, options) => {
        if (filename !== jsonPath) throw new Error("No se permite borrar otra ruta");
        events.push({ type: "remove-report", filename, options, stored });
        if (removeError) throw new Error("EPERM synthetic fixture");
        stored = undefined;
      },
    },
    console: { log: (...values) => output.push(values.join(" ")) },
    process: {
      pid: 424242, execPath: "synthetic-node", cwd: () => "synthetic-worktree",
      env: { E2E_PORT: "3199", ...environment },
      exit: (code) => { exitCode = code; throw exitSignal; },
    },
    spawnSync: (executable, argv, options) => {
      if (executable !== "synthetic-node") throw new Error("No se permite lanzar un proceso real");
      events.push({ type: "spawn", entry: argv[0], argv, env: options.env, stored });
      if (argv[0] === "scripts/check-e2e.mjs") {
        if (writeReport) stored = rawReport === undefined ? JSON.stringify(report) : rawReport;
        return { status: e2eStatus, signal: e2eStatus === null ? "SIGTERM" : null };
      }
      return { status: argv[0] === "scripts/check-build.mjs" ? buildStatus : (stepStatuses[argv[0]] ?? 0) };
    },
  };
  try {
    vm.runInNewContext(verifySource, context, { timeout: 2000 });
  } catch (error) {
    if (error !== exitSignal) throw error;
  }
  const text = output.join("\n").replace(/\u001b\[[0-9;]*m/g, "");
  const e2eRuns = events.filter((event) => event.type === "spawn" && event.entry === "scripts/check-e2e.mjs");
  return { exitCode, text, events, stored, jsonPath, e2eRuns };
}

describe("verify · integración real del reporte E2E", () => {
  it.each([0, 1])("error global hace fallar el gate incluso con exit %s", (e2eStatus) => {
    const report = goodReport();
    report.errors = [{ message: "Synthetic entire-run timeout" }];
    const result = runSyntheticGate({ e2eStatus, report });
    expect(result.exitCode).toBe(1);
    expect(result.text).toContain("[FAIL] e2e");
    expect(result.text).not.toMatch(/\[OK\]\s+e2e/);
    expect(result.text).not.toContain("TODO VERDE");
    expect(result.e2eRuns).toHaveLength(1);
  });

  it("navegador ausente es cobertura omitida, no aprobación medida", () => {
    const result = runSyntheticGate({ e2eStatus: 1, report: missingReport() });
    expect(result.exitCode).toBe(0);
    expect(result.text).toContain("[SKIP] e2e");
    expect(result.text).toContain("synthetic-mobile");
    expect(result.text).toContain("NO es un cierre verde completo");
    expect(result.text).not.toMatch(/\[OK\]\s+e2e/);
    expect(result.text).not.toContain("TODO VERDE");
    expect(result.e2eRuns).toHaveLength(1);
  });

  it.each([0, 1])("conserva el reporte fresco cuando el build siguiente sale %s", (buildStatus) => {
    const report = goodReport();
    const result = runSyntheticGate({ report, buildStatus });
    expect(result.exitCode).toBe(buildStatus);
    expect(result.stored).toBe(JSON.stringify(report));
    const build = result.events.find((event) => event.type === "spawn" && event.entry === "scripts/check-build.mjs");
    expect(build.stored).toBe(JSON.stringify(report));
    expect(result.events.filter((event) => event.type === "remove-report")).toHaveLength(1);
  });

  it("sólo retira el JSON viejo inmediatamente antes de iniciar E2E", () => {
    const result = runSyntheticGate();
    const removalIndex = result.events.findIndex((event) => event.type === "remove-report");
    const removal = result.events[removalIndex];
    expect(removal.stored).toBe("synthetic stale report");
    expect(removal.filename).toBe(result.jsonPath);
    expect(removal.options).toEqual({ force: true });
    expect(result.events[removalIndex + 1]).toMatchObject({
      type: "spawn", entry: "scripts/check-e2e.mjs", stored: undefined,
    });
    expect(result.events.slice(0, removalIndex).filter((event) => event.type === "spawn").length).toBeGreaterThan(0);
    expect(result.events.slice(0, removalIndex).every((event) => event.stored === "synthetic stale report")).toBe(true);
    expect(result.e2eRuns[0].env.PLAYWRIGHT_JSON_OUTPUT_NAME).toBe(result.jsonPath);
  });

  it("si no puede retirar el JSON viejo falla sin iniciar E2E ni aceptar sus datos", () => {
    const stale = JSON.stringify(goodReport());
    const result = runSyntheticGate({ stale, removeError: true });
    expect(result.exitCode).toBe(1);
    expect(result.e2eRuns).toHaveLength(0);
    expect(result.stored).toBe(stale);
    expect(result.events.some((event) => event.type === "read-report")).toBe(false);
    expect(result.text).toContain("[FAIL] e2e");
    expect(result.text).not.toContain("TODO VERDE");
  });

  it("un E2E que no escribe reporte fresco no puede usar el éxito de una corrida vieja", () => {
    const result = runSyntheticGate({ stale: JSON.stringify(goodReport()), writeReport: false });
    expect(result.exitCode).toBe(1);
    expect(result.stored).toBeUndefined();
    expect(result.e2eRuns).toHaveLength(1);
    expect(result.text).not.toMatch(/\[OK\]\s+e2e/);
  });

  it("JSON truncado falla y conserva los bytes para diagnóstico", () => {
    const result = runSyntheticGate({ rawReport: '{"stats":' });
    expect(result.exitCode).toBe(1);
    expect(result.stored).toBe('{"stats":');
    expect(result.text).not.toContain("TODO VERDE");
  });

  it.each([2, null])("salida de arnés/señal %s falla aunque el JSON diga aprobado", (e2eStatus) => {
    const result = runSyntheticGate({ e2eStatus });
    expect(result.exitCode).toBe(1);
    expect(result.e2eRuns).toHaveLength(1);
    expect(result.text).not.toMatch(/\[OK\]\s+e2e/);
  });

  it("exit3 de Playwright no puede saltarse el clasificador y ocultar errores globales", () => {
    const report = goodReport();
    report.errors = [{ message: "Synthetic global failure with exit3" }];
    const result = runSyntheticGate({ e2eStatus: 3, report });
    expect(result.exitCode).toBe(1);
    expect(result.text).toContain("[FAIL] e2e");
    expect(result.text).not.toContain("e2e: OMITIDO");
    expect(result.e2eRuns).toHaveLength(1);
  });

  it("conserva exit3 como omisión legítima en otro paso sin clasificador", () => {
    const entry = "scripts/check-edge-functions.mjs";
    const result = runSyntheticGate({ stepStatuses: { [entry]: 3 } });
    expect(result.exitCode).toBe(0);
    expect(result.text).toContain("edge-functions: OMITIDO");
    expect(result.text).toContain("NO es un cierre verde completo");
    expect(result.text).not.toContain("TODO VERDE");
    expect(result.text).toMatch(/\[OK\]\s+e2e/);
    expect(result.events.filter((event) => event.type === "spawn" && event.entry === entry)).toHaveLength(1);
  });

  it("fallo global no relanza suite entera ni inyecta override de retries individuales", () => {
    const report = goodReport();
    report.errors = [{ message: "Synthetic teardown timeout" }];
    const result = runSyntheticGate({ e2eStatus: 1, report });
    expect(result.e2eRuns).toHaveLength(1);
    expect(result.e2eRuns[0].argv).toEqual(["scripts/check-e2e.mjs", "--reporter=list,json"]);
    expect(result.text).not.toContain("reintento");
    expect(result.stored).toBe(JSON.stringify(report));
  });

  it("omisión explícita no inicia E2E ni borra la evidencia anterior", () => {
    const result = runSyntheticGate({ environment: { VERIFY_SKIP_E2E: "1" } });
    expect(result.exitCode).toBe(0);
    expect(result.e2eRuns).toHaveLength(0);
    expect(result.events.some((event) => event.type === "remove-report")).toBe(false);
    expect(result.stored).toBe("synthetic stale report");
    expect(result.text).toContain("NO es un cierre verde completo");
    expect(result.text).not.toContain("TODO VERDE");
  });

  it("reporte completo y salida0 conservan el verde legítimo", () => {
    const result = runSyntheticGate();
    expect(result.exitCode).toBe(0);
    expect(result.text).toMatch(/\[OK\]\s+e2e/);
    expect(result.text).toContain("TODO VERDE");
    expect(result.e2eRuns).toHaveLength(1);
  });
});

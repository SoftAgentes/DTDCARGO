// SDD-0470 · El e2e de verify sin Supabase público: detección, omisión con
// motivo, conteo desde el reporte, recolección de la cobertura parcial y
// veredicto crítico.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  ARCHIVOS_ENV_DEV,
  ARCHIVOS_ENV_TEST,
  MARCA_SIN_SUPABASE,
  SUPABASE_PUBLIC_VARS,
  archivosEnvNextDev,
  destinoEsLocal,
  detectarSupabasePublico,
  leerArchivoEnv,
  motivoSinSupabase,
  omisionSinSupabase,
  parsearEnv,
} from "../../e2e/_helpers/supabase-publico.cjs";
import {
  MARCA_SIN_SUPABASE as MARCA_DEL_GATE,
  coberturaParcialE2E,
  omisionesSinSupabase,
} from "../verify-e2e.mjs";
import { createReporter } from "../verify-runner.mjs";
import { buildVerifyVerdict } from "../verify-step-policy.mjs";
import { STEPS, evaluarPasos, recolectarParcial } from "../verify.mjs";

// Valores sintéticos: nunca credenciales reales.
const URL_FALSA = "http://127.0.0.1:54321";
const CLAVE_FALSA = "clave-anon-sintetica-no-secreta";
const [URL_VAR, KEY_VAR] = SUPABASE_PUBLIC_VARS;
const LOCAL = "http://localhost:3247";
const E2E_DIR = new URL("../../e2e/", import.meta.url);
const PROYECTOS = ["chromium", "mobile-chrome", "mobile-safari"];

function raizTemporal(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "dtd-sin-supabase-"));
  t.after(() => {
    // Único destino de borrado recursivo: el temporal de esta prueba.
    const destino = path.resolve(dir);
    const relativo = path.relative(path.resolve(tmpdir()), destino);
    assert.ok(relativo && !relativo.startsWith("..") && !path.isAbsolute(relativo));
    assert.ok(path.basename(destino).startsWith("dtd-sin-supabase-"));
    rmSync(destino, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  return dir;
}

function salida() {
  const lineas = [];
  return { lineas, out: createReporter((linea) => lineas.push(linea)), texto: () => lineas.join("\n") };
}

const ambas = { [URL_VAR]: URL_FALSA, [KEY_VAR]: CLAVE_FALSA };

/**
 * Inventario EXPLÍCITO de las pruebas que necesitan Supabase público, con la
 * evidencia de la corrida base del 2026-09-15 (SDD-0470): fallan en los tres
 * proyectos, en su intento y en su reintento, porque su ruta pasa por el
 * `matcher` de proxy.ts. Claves: ruta relativa a e2e/ con `/`.
 */
const REQUIEREN_SUPABASE = {
  "auth.spec.ts": [
    "Studio: form email+password, submit vacío no autentica",
    "Back: form email+password presente",
    "Portal: magic link (email, sin password)",
    "Portal: /entrar ofrece las dos puertas, y crear cuenta es un botón",
  ],
  "global-search.spec.ts": ["sin sesión, /studio rebota al login (⌘K no expuesto)"],
};

/** Reporte JSON de Playwright con las 15 omisiones del inventario (5 casos × 3 proyectos). */
function reporteQuince(motivo) {
  return {
    suites: Object.entries(REQUIEREN_SUPABASE).map(([archivo, titulos]) => ({
      title: archivo,
      specs: titulos.map((title, i) => ({
        title,
        file: archivo,
        line: 20 + i * 10,
        tests: PROYECTOS.map((projectName) => ({
          projectName,
          status: "skipped",
          annotations: [{ type: "skip", description: motivo }],
          results: [{ status: "skipped", annotations: [] }],
        })),
      })),
    })),
  };
}

test("variables presentes en el entorno: configurado y ninguna prueba se omite", (t) => {
  const raiz = raizTemporal(t);
  const d = detectarSupabasePublico({ env: ambas, raiz });
  assert.equal(d.configurado, true);
  assert.deepEqual(d.faltan, []);
  assert.deepEqual(d.fuentes, { [URL_VAR]: "entorno", [KEY_VAR]: "entorno" });
  assert.equal(motivoSinSupabase(d), null);
  assert.equal(omisionSinSupabase({ env: ambas, raiz, baseURL: LOCAL }), null);
});

test("variables ausentes: faltan las dos, el motivo lleva la marca y nunca un valor", (t) => {
  const raiz = raizTemporal(t);
  const d = detectarSupabasePublico({ env: {}, raiz });
  assert.equal(d.configurado, false);
  assert.deepEqual(d.faltan, [URL_VAR, KEY_VAR]);
  const motivo = motivoSinSupabase(d);
  assert.ok(motivo.startsWith(`${MARCA_SIN_SUPABASE}: `), motivo);
  assert.match(motivo, new RegExp(`falta ${URL_VAR}, ${KEY_VAR} en el entorno`));
  assert.match(motivo, /proxy\.ts no puede crear el cliente Supabase/);
  assert.equal(omisionSinSupabase({ env: {}, raiz, baseURL: LOCAL }), motivo);

  // Una sola presente sigue siendo ausencia: proxy.ts exige las dos.
  const soloUrl = detectarSupabasePublico({ env: { [URL_VAR]: URL_FALSA }, raiz });
  assert.equal(soloUrl.configurado, false);
  assert.deepEqual(soloUrl.faltan, [KEY_VAR]);
  const motivoParcial = motivoSinSupabase(soloUrl);
  assert.match(motivoParcial, new RegExp(`falta ${KEY_VAR} en`));
  assert.ok(!motivoParcial.includes(URL_FALSA), "el motivo no puede imprimir valores");

  // Un blanco no cuenta como valor.
  assert.deepEqual(detectarSupabasePublico({ env: { [URL_VAR]: "  ", [KEY_VAR]: CLAVE_FALSA }, raiz }).faltan, [URL_VAR]);
});

test(".env.local como directorio cuenta como ausente, como en next dev, y el motivo lo dice", (t) => {
  const raiz = raizTemporal(t);
  const dir = path.join(raiz, ".env.local");
  mkdirSync(dir);
  // Aunque adentro haya algo con las variables, Next no lo carga.
  writeFileSync(path.join(dir, ".env.local"), `${URL_VAR}=${URL_FALSA}\n${KEY_VAR}=${CLAVE_FALSA}\n`);

  assert.deepEqual(leerArchivoEnv(dir), { estado: "no-es-archivo", vars: {} });
  const d = detectarSupabasePublico({ env: {}, raiz });
  assert.equal(d.configurado, false);
  assert.deepEqual(d.faltan, [URL_VAR, KEY_VAR]);
  assert.deepEqual(d.ignorados, [{ nombre: ".env.local", estado: "no-es-archivo" }]);
  assert.match(motivoSinSupabase(d), /se ignora \.env\.local \(no es un archivo\)/);

  // El directorio no tapa lo que sí trae el entorno.
  assert.equal(detectarSupabasePublico({ env: ambas, raiz }).configurado, true);
});

test(".env.local válido: configurado desde el archivo, con la precedencia de next dev", (t) => {
  const raiz = raizTemporal(t);
  assert.deepEqual(ARCHIVOS_ENV_DEV, [".env.development.local", ".env.local", ".env.development", ".env"]);
  writeFileSync(
    path.join(raiz, ".env.local"),
    `﻿# comentario\r\nexport ${URL_VAR}="${URL_FALSA}"\r\n${KEY_VAR}='${CLAVE_FALSA}' # al final\r\nOTRA=1\r\n`,
  );
  const d = detectarSupabasePublico({ env: {}, raiz });
  assert.equal(d.configurado, true);
  assert.deepEqual(d.fuentes, { [URL_VAR]: ".env.local", [KEY_VAR]: ".env.local" });
  assert.equal(omisionSinSupabase({ env: {}, raiz, baseURL: LOCAL }), null);

  // Definida en el entorno gana aunque esté vacía (@next/env no la pisa).
  const vaciaEnEntorno = detectarSupabasePublico({ env: { [URL_VAR]: "" }, raiz });
  assert.deepEqual(vaciaEnEntorno.faltan, [URL_VAR]);
  assert.deepEqual(vaciaEnEntorno.vacias, { [URL_VAR]: "entorno" });
  assert.match(motivoSinSupabase(vaciaEnEntorno), new RegExp(`${URL_VAR} \\(vacía en entorno\\)`));

  // El primer archivo que define la clave gana; .env también se carga.
  writeFileSync(path.join(raiz, ".env"), `${URL_VAR}=${URL_FALSA}\n${KEY_VAR}=${CLAVE_FALSA}\n`);
  writeFileSync(path.join(raiz, ".env.local"), `${URL_VAR}=\n`);
  const pisada = detectarSupabasePublico({ env: {}, raiz });
  assert.deepEqual(pisada.faltan, [URL_VAR]);
  assert.deepEqual(pisada.vacias, { [URL_VAR]: ".env.local" });
  assert.deepEqual(pisada.fuentes, { [KEY_VAR]: ".env" });

  rmSync(path.join(raiz, ".env.local"));
  assert.equal(detectarSupabasePublico({ env: {}, raiz }).configurado, true);

  assert.deepEqual(parsearEnv('A="uno"\nB=dos # c\n# C=tres\nexport D=\'cuatro\'\n'), { A: "uno", B: "dos", D: "cuatro" });
});

test("con NODE_ENV=test replica el modo test de @next/env: .env.local queda fuera", (t) => {
  const raiz = raizTemporal(t);
  assert.deepEqual(ARCHIVOS_ENV_TEST, [".env.test.local", ".env.test", ".env"]);
  assert.deepEqual(archivosEnvNextDev({}), ARCHIVOS_ENV_DEV);
  assert.deepEqual(archivosEnvNextDev({ NODE_ENV: "development" }), ARCHIVOS_ENV_DEV);
  assert.deepEqual(archivosEnvNextDev({ NODE_ENV: "test" }), ARCHIVOS_ENV_TEST);

  writeFileSync(path.join(raiz, ".env.local"), `${URL_VAR}=${URL_FALSA}\n${KEY_VAR}=${CLAVE_FALSA}\n`);
  const enDev = detectarSupabasePublico({ env: {}, raiz });
  assert.equal(enDev.configurado, true);
  assert.deepEqual(enDev.archivos, ARCHIVOS_ENV_DEV);

  // En modo test, Next no carga .env.local: el mismo archivo ya no configura nada.
  const enTest = detectarSupabasePublico({ env: { NODE_ENV: "test" }, raiz });
  assert.equal(enTest.configurado, false);
  assert.deepEqual(enTest.archivos, ARCHIVOS_ENV_TEST);
  const motivo = motivoSinSupabase(enTest);
  assert.match(motivo, /en el entorno y en \.env\.test\.local, \.env\.test, \.env\. /);
  assert.doesNotMatch(motivo, /\.env\.local|\.env\.development/);

  writeFileSync(path.join(raiz, ".env.test.local"), `${URL_VAR}=${URL_FALSA}\n${KEY_VAR}=${CLAVE_FALSA}\n`);
  const conTestLocal = detectarSupabasePublico({ env: { NODE_ENV: "test" }, raiz });
  assert.equal(conTestLocal.configurado, true);
  assert.deepEqual(conTestLocal.fuentes, { [URL_VAR]: ".env.test.local", [KEY_VAR]: ".env.test.local" });
});

test("un destino que no es local conserva el comportamiento de siempre", (t) => {
  const raiz = raizTemporal(t);
  for (const local of [LOCAL, "http://127.0.0.1:3001", "http://[::1]:3001/", "http://app.localhost:3001"]) {
    assert.equal(destinoEsLocal(local), true, local);
  }
  for (const remoto of ["https://preview-dtdcargo.vercel.app", "http://10.0.0.5:3001", undefined, "", "no es url"]) {
    assert.equal(destinoEsLocal(remoto), false, String(remoto));
    assert.equal(omisionSinSupabase({ env: {}, raiz, baseURL: remoto }), null, String(remoto));
  }
});

function reporteDePrueba(motivo) {
  const test = (projectName, status, annotations = [], resultAnnotations = []) => ({
    projectName,
    status,
    annotations,
    results: [{ status: status === "skipped" ? "skipped" : "passed", annotations: resultAnnotations }],
  });
  const skip = (description) => ({ type: "skip", description });
  return {
    suites: [
      {
        title: "auth.spec.ts",
        specs: [],
        suites: [
          {
            title: "Tier 1 · logins",
            specs: [
              {
                title: "Studio: form",
                file: "auth.spec.ts",
                line: 21,
                tests: [
                  test("chromium", "skipped", [skip(motivo)]),
                  // Playwright 1.60 deja la anotación del skip en ejecución en el intento.
                  test("mobile-safari", "skipped", [], [skip(motivo)]),
                  // Pasó: aunque traiga la marca, no es una omisión.
                  test("mobile-chrome", "expected", [skip(motivo)]),
                ],
              },
              {
                title: "Operario VE",
                file: "auth.spec.ts",
                line: 130,
                tests: [test("chromium", "expected")],
              },
            ],
          },
        ],
      },
      {
        title: "gastos-expense-void.spec.ts",
        specs: [
          {
            title: "Tier 3",
            file: "gastos-expense-void.spec.ts",
            line: 99,
            tests: [
              // Omitido por falta de seed: otro motivo, no cuenta.
              test("mobile-safari", "skipped", [skip("Requiere accounting/admin E2E y un gasto vivo del fixture efímero.")]),
              test("chromium", "skipped", [{ type: "fixme", description: motivo }]),
            ],
          },
        ],
      },
    ],
  };
}

test("el reporte cuenta sólo las omisiones marcadas, y la cobertura parcial las nombra", (t) => {
  const raiz = raizTemporal(t);
  const ausente = detectarSupabasePublico({ env: {}, raiz });
  const presente = detectarSupabasePublico({ env: ambas, raiz });
  // Ida y vuelta: el motivo que ponen los specs es el que el gate reconoce.
  assert.equal(MARCA_DEL_GATE, MARCA_SIN_SUPABASE);
  const reporte = reporteDePrueba(omisionSinSupabase({ env: {}, raiz, baseURL: LOCAL }));

  assert.deepEqual(omisionesSinSupabase(reporte), [
    { archivo: "auth.spec.ts", linea: 21, titulo: "Studio: form", proyecto: "chromium" },
    { archivo: "auth.spec.ts", linea: 21, titulo: "Studio: form", proyecto: "mobile-safari" },
  ]);
  assert.deepEqual(omisionesSinSupabase(null), []);

  assert.deepEqual(coberturaParcialE2E({ deteccion: ausente, reporte }), {
    reason: `2 prueba(s) omitidas sin Supabase público (falta ${URL_VAR}, ${KEY_VAR})`,
    casos: ["auth.spec.ts:21 «Studio: form» [chromium, mobile-safari]"],
  });
  // Omitidas aunque verify ve Supabase: se reporta la inconsistencia, no se esconde.
  assert.match(coberturaParcialE2E({ deteccion: presente, reporte }).reason, /^2 prueba\(s\) omitidas .*aunque verify lo ve configurado/);
  // Sin reporte (un corte, por ejemplo) y sin Supabase: parcial igual.
  assert.match(coberturaParcialE2E({ deteccion: ausente, reporte: null }).reason, /sin reporte legible para contar/);

  const sinMarcas = reporteDePrueba("otro motivo");
  assert.equal(coberturaParcialE2E({ deteccion: presente, reporte: sinMarcas }), null);
  assert.equal(coberturaParcialE2E({ deteccion: presente, reporte: null }), null);
  // Sin Supabase pero nada omitido (destino remoto): no quedó nada sin medir.
  assert.equal(coberturaParcialE2E({ deteccion: ausente, reporte: sinMarcas }), null);
});

test("veredicto: el e2e con cobertura parcial es una omisión crítica, nunca un cierre completo", () => {
  const pasos = ["lint", "migrations-applied", "e2e", "build"];
  const reason = `15 prueba(s) omitidas sin Supabase público (falta ${URL_VAR}, ${KEY_VAR})`;
  const partial = [{ name: "e2e", reason }];

  const incompleto = buildVerifyVerdict({ stepNames: pasos, skipped: [], failures: [], partial });
  assert.equal(incompleto.kind, "critical-unmeasured");
  assert.equal(incompleto.tone, "warn");
  assert.equal(incompleto.exitCode, 0);
  assert.deepEqual(incompleto.criticalPartial, ["e2e"]);
  assert.deepEqual(incompleto.criticalMissing, []);
  assert.equal(
    incompleto.message,
    `verify: CIERRE INCOMPLETO — CRÍTICOS CON COBERTURA PARCIAL: e2e [${reason}]. ` +
      "No hubo fallos en lo medido (4/4, con cobertura parcial: e2e); exit 0 NO equivale a cierre verde completo.",
  );
  assert.doesNotMatch(incompleto.message, /TODO VERDE/);

  const conOmitido = buildVerifyVerdict({
    stepNames: pasos,
    skipped: [{ name: "migrations-applied", reason: "sin credenciales" }],
    failures: [],
    partial,
  });
  assert.match(
    conOmitido.message,
    /^verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied\. CRÍTICOS CON COBERTURA PARCIAL: e2e \[15 /,
  );
  assert.match(conOmitido.message, /\(3\/4, con cobertura parcial: e2e\)/);

  const rojo = buildVerifyVerdict({ stepNames: pasos, skipped: [], failures: ["lint"], partial });
  assert.equal(rojo.exitCode, 1);
  assert.equal(rojo.message, `verify: 1 fallo(s) → lint CIERRE ADEMÁS INCOMPLETO — CRÍTICOS CON COBERTURA PARCIAL: e2e [${reason}].`);

  const noCritico = buildVerifyVerdict({
    stepNames: ["lint", "docs:check"],
    skipped: [],
    failures: [],
    partial: [{ name: "docs:check", reason: "fixture" }],
  });
  assert.equal(noCritico.kind, "noncritical-unmeasured");
  assert.equal(noCritico.message, "verify: SIN FALLOS, COBERTURA PARCIAL — no críticos con cobertura parcial: docs:check [fixture] (2/2 pasos medidos).");

  // Sin parciales, la línea es la de siempre, pasen o no el argumento.
  assert.equal(buildVerifyVerdict({ stepNames: pasos, skipped: [], failures: [] }).message, "verify: TODO VERDE ✓ (4/4 pasos medidos)");
  assert.equal(buildVerifyVerdict({ stepNames: pasos, skipped: [], failures: [], partial: [] }).kind, "complete");

  assert.throws(() => buildVerifyVerdict({ stepNames: pasos, skipped: [], failures: [], partial: [{ name: "otro", reason }] }), /pasos desconocidos: otro/);
  assert.throws(() => buildVerifyVerdict({ stepNames: pasos, skipped: [], failures: [], partial: [...partial, ...partial] }), /cobertura parcial duplicados: e2e/);
  assert.throws(
    () => buildVerifyVerdict({ stepNames: pasos, skipped: [{ name: "e2e", reason: "x" }], failures: [], partial }),
    /a la vez omitidos y con cobertura parcial: e2e/,
  );
  assert.throws(() => buildVerifyVerdict({ stepNames: pasos, skipped: [], failures: [], partial: [{ name: "e2e", reason: " " }] }), /parciales sin motivo: e2e/);
});

/** Paso e2e falso: cuenta cuántas veces se le pregunta por la cobertura parcial. */
function e2eFalso(parcial) {
  const paso = {
    name: "e2e",
    llamadas: 0,
    partialCoverage: () => {
      paso.llamadas += 1;
      return parcial;
    },
  };
  return paso;
}

const PARCIAL_FALSO = { reason: "15 prueba(s) omitidas sin Supabase público (fixture)", casos: ["a.spec.ts:1 «uno» [chromium]", "b.spec.ts:2 «dos» [chromium]"] };

test("recolectarParcial: un omitido no se consulta; un fallido y un ok sí dejan cobertura parcial", () => {
  const { out, texto } = salida();
  const paso = e2eFalso(PARCIAL_FALSO);

  const omitido = { outcome: "skipped", attempts: 0, skipped: { name: "e2e", reason: "sin navegadores" } };
  assert.equal(recolectarParcial(paso, omitido, out), null);
  assert.equal(paso.llamadas, 0, "a un paso omitido no se le pregunta");

  const fallido = { outcome: "failed", attempts: 2, failure: { name: "e2e", reason: null } };
  assert.deepEqual(recolectarParcial(paso, fallido, out), { name: "e2e", reason: PARCIAL_FALSO.reason });
  const ok = { outcome: "ok", attempts: 1 };
  assert.deepEqual(recolectarParcial(paso, ok, out), { name: "e2e", reason: PARCIAL_FALSO.reason });
  assert.equal(paso.llamadas, 2);

  // Sin declaración o sin parcial no hay nada que recoger.
  assert.equal(recolectarParcial({ name: "lint" }, ok, out), null);
  assert.equal(recolectarParcial(e2eFalso(null), ok, out), null);

  assert.equal(texto().match(/\[AVISO\].* e2e: COBERTURA PARCIAL — 15 prueba\(s\) omitidas/g)?.length, 2);
  assert.equal(texto().match(/^ {3}omitida: /gm)?.length, 4);
});

test("evaluarPasos con pasos falsos: omitido, fallido y ok llegan al veredicto", async () => {
  const pasos = (e2e) => [{ name: "migrations-applied" }, e2e, { name: "build" }];
  const correrCon = (resultadoE2E) => async (step) => (step.name === "e2e" ? resultadoE2E : { outcome: "ok", attempts: 1 });

  const pasoOmitido = e2eFalso(PARCIAL_FALSO);
  const omitido = await evaluarPasos(pasos(pasoOmitido), {
    out: salida().out,
    correr: correrCon({ outcome: "skipped", attempts: 0, skipped: { name: "e2e", reason: "sin navegadores" } }),
  });
  assert.equal(pasoOmitido.llamadas, 0);
  assert.deepEqual(omitido.partial, []);
  assert.deepEqual(omitido.skipped, [{ name: "e2e", reason: "sin navegadores" }]);
  assert.deepEqual(omitido.verdict.criticalMissing, ["e2e"]);
  assert.deepEqual(omitido.verdict.criticalPartial, []);

  const fallido = await evaluarPasos(pasos(e2eFalso(PARCIAL_FALSO)), {
    out: salida().out,
    correr: correrCon({ outcome: "failed", attempts: 2, failure: { name: "e2e", reason: null } }),
  });
  assert.deepEqual(fallido.failures, [{ name: "e2e", reason: null }]);
  assert.deepEqual(fallido.partial, [{ name: "e2e", reason: PARCIAL_FALSO.reason }]);
  assert.equal(fallido.verdict.exitCode, 1);
  assert.equal(
    fallido.verdict.message,
    `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS CON COBERTURA PARCIAL: e2e [${PARCIAL_FALSO.reason}].`,
  );

  const ok = await evaluarPasos(pasos(e2eFalso(PARCIAL_FALSO)), { out: salida().out, correr: correrCon({ outcome: "ok", attempts: 1 }) });
  assert.deepEqual(ok.skipped, []);
  assert.deepEqual(ok.failures, []);
  assert.deepEqual(ok.partial, [{ name: "e2e", reason: PARCIAL_FALSO.reason }]);
  assert.equal(ok.verdict.kind, "critical-unmeasured");
  assert.equal(ok.verdict.exitCode, 0);
  assert.doesNotMatch(ok.verdict.message, /TODO VERDE/);
});

test("con migrations-applied medido y las 15 omisiones, verify NO cierra TODO VERDE", async (t) => {
  const raiz = raizTemporal(t);
  const deteccion = detectarSupabasePublico({ env: {}, raiz });
  const motivo = omisionSinSupabase({ env: {}, raiz, baseURL: LOCAL });
  // Los 17 pasos reales del gate, sin correrlos: todos salen ok y el e2e trae
  // las 15 omisiones del inventario contadas con el código real.
  const conReporte = (reporte) =>
    STEPS.map((step) =>
      step.name === "e2e"
        ? { name: "e2e", partialCoverage: () => coberturaParcialE2E({ deteccion, reporte }) }
        : { name: step.name },
    );
  const correr = async () => ({ outcome: "ok", attempts: 1 });
  const { out, texto } = salida();

  const r = await evaluarPasos(conReporte(reporteQuince(motivo)), { out, correr });
  const reason = `15 prueba(s) omitidas sin Supabase público (falta ${URL_VAR}, ${KEY_VAR})`;
  assert.ok(STEPS.some((step) => step.name === "migrations-applied"));
  assert.deepEqual(r.skipped, [], "migrations-applied quedó medido");
  assert.deepEqual(r.failures, []);
  assert.deepEqual(r.partial, [{ name: "e2e", reason }]);
  assert.equal(r.verdict.kind, "critical-unmeasured");
  assert.equal(r.verdict.exitCode, 0);
  assert.deepEqual(r.verdict.criticalMissing, []);
  assert.deepEqual(r.verdict.criticalPartial, ["e2e"]);
  assert.equal(
    r.verdict.message,
    `verify: CIERRE INCOMPLETO — CRÍTICOS CON COBERTURA PARCIAL: e2e [${reason}]. ` +
      `No hubo fallos en lo medido (${STEPS.length}/${STEPS.length}, con cobertura parcial: e2e); exit 0 NO equivale a cierre verde completo.`,
  );
  assert.doesNotMatch(r.verdict.message, /TODO VERDE/);
  assert.equal(texto().match(/^ {3}omitida: /gm)?.length, 5);

  // Control: el mismo gate sin esas omisiones sí cierra completo. La diferencia
  // son las 15 pruebas, no otra cosa.
  const completo = await evaluarPasos(conReporte(reporteDePrueba("otro motivo")), { out: salida().out, correr });
  assert.equal(completo.verdict.kind, "complete");
  assert.equal(completo.verdict.message, `verify: TODO VERDE ✓ (${STEPS.length}/${STEPS.length} pasos medidos)`);
});

test("el paso e2e real de STEPS lee el reporte de su corrida y declara la cobertura parcial", (t) => {
  const e2e = STEPS.find((step) => step.name === "e2e");
  assert.equal(typeof e2e.partialCoverage, "function");
  const destino = e2e.env.PLAYWRIGHT_JSON_OUTPUT_NAME;
  assert.equal(path.dirname(path.resolve(destino)), path.resolve(tmpdir()));
  assert.match(path.basename(destino), /^dtd-e2e-\d+\.json$/);
  t.after(() => rmSync(destino, { force: true }));

  const motivo = omisionSinSupabase({ env: {}, raiz: raizTemporal(t), baseURL: LOCAL });
  writeFileSync(destino, JSON.stringify(reporteQuince(motivo)));
  const parcial = e2e.partialCoverage();
  // Con o sin Supabase en quien corre la prueba, las 15 marcadas cuentan.
  assert.match(parcial.reason, /^15 prueba\(s\) omitidas /);
  assert.equal(parcial.casos.length, 5);
});

test("verify cablea la recolección y usa la misma raíz de detección que los specs", async () => {
  const source = await readFile(new URL("../verify.mjs", import.meta.url), "utf8");
  assert.match(source, /const \{ skipped, partial, verdict \} = await evaluarPasos\(STEPS, \{ out \}\);/);
  // SDD-0479: la detección del paso es la efectiva del plan (con el Supabase
  // sintético, las dos variables existen para el next dev).
  assert.match(source, /e2eSupabase = deteccionEfectiva\(plan\);/);
  assert.match(source, /e2eSupabase \?\? detectarSupabasePublico\(\);/);
  // Sin raíz propia: el default es RAIZ_REPO, igual que en e2e/_helpers/supabase.ts.
  assert.doesNotMatch(source, /detectarSupabasePublico\(\{[^}]*raiz/);
  assert.doesNotMatch(source, /planSupabaseE2E\(\{[^}]*raiz/);
  const e2e = source.match(/\{\s*name: "e2e",[\s\S]*?\n {2}\},\n/);
  assert.ok(e2e, "no se encontró el paso e2e en STEPS");
  assert.match(e2e[0], /partialCoverage: e2eCoberturaParcial,/);

  const helper = await readFile(new URL("_helpers/supabase.ts", E2E_DIR), "utf8");
  assert.match(helper, /omisionSinSupabase\(\{ baseURL: test\.info\(\)\.project\.use\.baseURL \}\)/);
  assert.match(helper, /test\.skip\(motivo !== null, motivo \?\? undefined\)/);
});

// ── Inventario de requiereSupabase() ─────────────────────────────────────────

const DEFINICION = "_helpers/supabase.ts";

/** Fuentes JS/TS bajo `dir`, recursivo, como rutas relativas con `/`. */
function archivosFuente(dir, prefijo = "") {
  const salidaArchivos = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === "node_modules") continue;
    const rel = prefijo + entrada.name;
    if (entrada.isDirectory()) salidaArchivos.push(...archivosFuente(path.join(dir, entrada.name), `${rel}/`));
    else if (/\.(?:[cm]?ts|[cm]?js)$/.test(entrada.name) && !/\.d\.[cm]?ts$/.test(entrada.name)) salidaArchivos.push(rel);
  }
  return salidaArchivos.sort();
}

/**
 * Dos vistas del mismo largo que `fuente`: `sinComentarios` borra comentarios y
 * `codigo` además borra el contenido de strings, templates y regex. Así una
 * mención en un comentario o en un string no cuenta como llamada.
 */
function enmascarar(fuente) {
  const sinComentarios = [...fuente];
  const codigo = [...fuente];
  const borrar = (i, ambas) => {
    if (fuente[i] === "\n") return;
    codigo[i] = " ";
    if (ambas) sinComentarios[i] = " ";
  };
  const plantillas = []; // profundidad de llaves dentro de cada `${`
  let i = 0;
  let previo = ""; // último carácter significativo de código
  while (i < fuente.length) {
    const c = fuente[i];
    const d = fuente[i + 1];
    if (c === "/" && d === "/") {
      while (i < fuente.length && fuente[i] !== "\n") borrar(i++, true);
      continue;
    }
    if (c === "/" && d === "*") {
      const fin = fuente.indexOf("*/", i + 2);
      const hasta = fin === -1 ? fuente.length : fin + 2;
      while (i < hasta) borrar(i++, true);
      continue;
    }
    if (c === '"' || c === "'") {
      i += 1;
      while (i < fuente.length && fuente[i] !== c && fuente[i] !== "\n") {
        if (fuente[i] === "\\") borrar(i++, false);
        borrar(i++, false);
      }
      i += 1;
      previo = c;
      continue;
    }
    if (c === "`" || (c === "}" && plantillas.length > 0 && plantillas.at(-1) === 0)) {
      if (c === "}") plantillas.pop();
      i += 1;
      while (i < fuente.length && fuente[i] !== "`" && !(fuente[i] === "$" && fuente[i + 1] === "{")) {
        if (fuente[i] === "\\") borrar(i++, false);
        borrar(i++, false);
      }
      if (fuente[i] === "$") {
        plantillas.push(0);
        i += 2;
      } else {
        i += 1;
        previo = "`";
      }
      continue;
    }
    if (c === "/" && (previo === "" || "(,=:[!&|?{};".includes(previo))) {
      i += 1;
      let clase = false;
      while (i < fuente.length && fuente[i] !== "\n" && (clase || fuente[i] !== "/")) {
        if (fuente[i] === "\\") borrar(i++, false);
        else if (fuente[i] === "[") clase = true;
        else if (fuente[i] === "]") clase = false;
        borrar(i++, false);
      }
      i += 1;
      previo = "/";
      continue;
    }
    if (plantillas.length > 0) {
      if (c === "{") plantillas[plantillas.length - 1] += 1;
      else if (c === "}") plantillas[plantillas.length - 1] -= 1;
    }
    if (!/\s/.test(c)) previo = c;
    i += 1;
  }
  return { sinComentarios: sinComentarios.join(""), codigo: codigo.join("") };
}

// `test("título", async (params) => {` seguido de la llamada como primera sentencia.
const DECLARACION =
  /\btest\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*async\s*(?:\([^)]*\)|[\w$]+)\s*=>\s*\{\s*(requiereSupabase)\s*\(\s*\)/dg;
const IMPORTA_HELPER =
  /import\s*\{[^}]*\brequiereSupabase\b[^}]*\}\s*from\s*["'](?:\.{1,2}\/)+(?:[\w.-]+\/)*_helpers\/supabase["']/;

/**
 * Qué pruebas declaran `requiereSupabase()` bajo `dir` y qué llamadas quedan
 * fuera de la primera sentencia de un `test(...)`. Falla cerrado: una llamada
 * en `beforeEach`, a mitad de cuerpo, en otro helper o con alias es un error, no
 * una declaración.
 */
function inventarioRequiereSupabase(dir) {
  const declaradas = {};
  const fueraDeLugar = [];
  const alias = [];
  const sinImport = [];
  for (const rel of archivosFuente(dir)) {
    if (rel === DEFINICION) continue;
    const fuente = readFileSync(path.join(dir, rel), "utf8");
    const { sinComentarios, codigo } = enmascarar(fuente);
    const primeras = new Map();
    for (const m of sinComentarios.matchAll(DECLARACION)) {
      const inicio = m.indices[3][0];
      if (codigo.startsWith("requiereSupabase", inicio)) primeras.set(inicio, m[2]);
    }
    const titulos = [];
    for (const m of codigo.matchAll(/\brequiereSupabase\s*\(/g)) {
      if (primeras.has(m.index)) titulos.push(primeras.get(m.index));
      else fueraDeLugar.push(`${rel}:${fuente.slice(0, m.index).split("\n").length}`);
    }
    if (/\brequiereSupabase\s+as\b/.test(codigo)) alias.push(rel);
    if (titulos.length > 0) {
      declaradas[rel] = titulos;
      if (!IMPORTA_HELPER.test(sinComentarios)) sinImport.push(rel);
    }
  }
  return { declaradas, fueraDeLugar, alias, sinImport };
}

test("el inventario ve subdirectorios, llamadas sin punto y coma y rechaza beforeEach, alias y menciones", (t) => {
  const raiz = raizTemporal(t);
  const escribir = (rel, lineas) => {
    mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true });
    writeFileSync(path.join(raiz, rel), lineas.join("\n"));
  };
  escribir("_helpers/supabase.ts", ["export function requiereSupabase(): void {}"]);
  escribir("a.spec.ts", [
    'import { test } from "@playwright/test";',
    'import { requiereSupabase } from "./_helpers/supabase";',
    "// requiereSupabase(); en un comentario no cuenta",
    "/* requiereSupabase() tampoco */",
    'test("con punto y coma", async ({ page }) => {',
    "  requiereSupabase();",
    '  await page.goto("http://localhost:3001/entrar");',
    "});",
    "test('sin punto y coma', async () => {",
    "  requiereSupabase()",
    '  const s = "requiereSupabase() dentro de un string";',
    "});",
    'test("mención en template y regex", async () => {',
    "  const x = `requiereSupabase() ${1 + 1}`;",
    "  const r = /requiereSupabase\\(\\)/;",
    "});",
  ]);
  escribir("sub/b.spec.ts", [
    'import { requiereSupabase } from "../_helpers/supabase";',
    'test("en subdirectorio", async ({',
    "  page,",
    "}) => {",
    "  requiereSupabase();",
    "});",
  ]);
  escribir("c.spec.ts", [
    'import { requiereSupabase } from "./_helpers/supabase";',
    "test.beforeEach(async () => {",
    "  requiereSupabase();",
    "});",
    'test("a mitad del cuerpo", async () => {',
    "  await Promise.resolve();",
    "  requiereSupabase();",
    "});",
  ]);
  escribir("d.spec.ts", ['import { requiereSupabase as rs } from "./_helpers/supabase";', 'test("alias", async () => {', "  rs();", "});"]);
  escribir("e.spec.ts", ['test("sin import", async () => {', "  requiereSupabase();", "});"]);

  assert.deepEqual(inventarioRequiereSupabase(raiz), {
    declaradas: {
      "a.spec.ts": ["con punto y coma", "sin punto y coma"],
      "e.spec.ts": ["sin import"],
      "sub/b.spec.ts": ["en subdirectorio"],
    },
    fueraDeLugar: ["c.spec.ts:3", "c.spec.ts:7"],
    alias: ["d.spec.ts"],
    sinImport: ["e.spec.ts"],
  });
});

test("los specs que necesitan Supabase lo declaran en su primera línea, y sólo esos (e2e/ entero)", () => {
  const e2eDir = fileURLToPath(E2E_DIR);
  assert.ok(archivosFuente(e2eDir).includes(DEFINICION));
  assert.deepEqual(inventarioRequiereSupabase(e2eDir), {
    declaradas: REQUIEREN_SUPABASE,
    fueraDeLugar: [],
    alias: [],
    sinImport: [],
  });
});

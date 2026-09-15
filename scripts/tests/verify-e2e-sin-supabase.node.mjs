// SDD-0470 · El e2e de verify sin Supabase público: detección, omisión con
// motivo, conteo desde el reporte y veredicto de cobertura parcial crítica.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ARCHIVOS_ENV_DEV,
  MARCA_SIN_SUPABASE,
  SUPABASE_PUBLIC_VARS,
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
import { buildVerifyVerdict } from "../verify-step-policy.mjs";

// Valores sintéticos: nunca credenciales reales.
const URL_FALSA = "http://127.0.0.1:54321";
const CLAVE_FALSA = "clave-anon-sintetica-no-secreta";
const [URL_VAR, KEY_VAR] = SUPABASE_PUBLIC_VARS;
const LOCAL = "http://localhost:3247";
const E2E_DIR = new URL("../../e2e/", import.meta.url);

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

const ambas = { [URL_VAR]: URL_FALSA, [KEY_VAR]: CLAVE_FALSA };

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

test("verify cablea la detección y la cobertura parcial del e2e al veredicto", async () => {
  const source = await readFile(new URL("../verify.mjs", import.meta.url), "utf8");
  assert.match(source, /detectarSupabasePublico\(\{ raiz: process\.cwd\(\) \}\)/);
  assert.match(source, /buildVerifyVerdict\(\{[\s\S]*?\bpartial,[\s\S]*?\}\)/);
  const e2e = source.match(/\{\s*name: "e2e",[\s\S]*?\n {2}\},\n/);
  assert.ok(e2e, "no se encontró el paso e2e en STEPS");
  assert.match(e2e[0], /partialCoverage: e2eCoberturaParcial,/);

  const helper = await readFile(new URL("_helpers/supabase.ts", E2E_DIR), "utf8");
  assert.match(helper, /omisionSinSupabase\(\{ baseURL: test\.info\(\)\.project\.use\.baseURL \}\)/);
  assert.match(helper, /test\.skip\(motivo !== null, motivo \?\? undefined\)/);
});

/**
 * Inventario EXPLÍCITO de las pruebas que necesitan Supabase público, con la
 * evidencia de la corrida base del 2026-09-15 (SDD-0470): fallan en los tres
 * proyectos, en su intento y en su reintento, porque su ruta pasa por el
 * `matcher` de proxy.ts. Una prueba nueva que lo necesite se agrega acá y en
 * su spec; quitar la llamada de un spec rompe esta prueba.
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

test("los specs que necesitan Supabase lo declaran en su primera línea, y sólo esos", async () => {
  const specs = readdirSync(E2E_DIR).filter((nombre) => nombre.endsWith(".spec.ts")).sort();
  for (const nombre of Object.keys(REQUIEREN_SUPABASE)) assert.ok(specs.includes(nombre), `falta ${nombre}`);
  for (const nombre of specs) {
    const fuente = await readFile(new URL(nombre, E2E_DIR), "utf8");
    const declaradas = [
      ...fuente.matchAll(/\btest\(\s*"([^"]+)",\s*async \(\{[^}]*\}\)\s*=>\s*\{\s*requiereSupabase\(\);/g),
    ].map((m) => m[1]);
    // Cuenta sentencias de llamada, no menciones en comentarios.
    const llamadas = fuente.match(/^\s*requiereSupabase\(\);/gm)?.length ?? 0;
    assert.deepEqual(declaradas, REQUIEREN_SUPABASE[nombre] ?? [], nombre);
    assert.equal(llamadas, declaradas.length, `${nombre}: requiereSupabase() fuera de la primera línea de un test`);
    if (declaradas.length > 0) {
      assert.match(fuente, /import \{ requiereSupabase \} from "\.\/_helpers\/supabase";/, nombre);
    }
  }
});

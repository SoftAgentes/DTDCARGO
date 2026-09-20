// SDD-0479 · Supabase sintético deny-only para el e2e local: el plan único de
// Supabase, el servidor que rechaza todo, el cableado de verify, de
// playwright.config.ts y de requiereSupabase(), y la cobertura con el plan.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ANON_KEY_SINTETICA,
  RUTA_SALUD_SINTETICO,
  SUPABASE_PUBLIC_VARS,
  deteccionEfectiva,
  planSupabaseE2E,
  puertoSupabaseSintetico,
} from "../../e2e/_helpers/supabase-publico.cjs";
import { RESPUESTA_DENEGADA, crearServidorDenyOnly, parsearPuerto } from "../e2e/supabase-deny-server.mjs";
import {
  PUERTO_BASE,
  PUERTO_RANGO,
  candidatosSupabaseSintetico,
  coberturaParcialE2E,
  destinoE2E,
  MARCA_SIN_SUPABASE,
} from "../verify-e2e.mjs";

// Valores sintéticos: nunca credenciales reales.
const URL_FALSA = "http://127.0.0.1:54321";
const CLAVE_FALSA = "clave-anon-sintetica-no-secreta";
const [URL_VAR, KEY_VAR] = SUPABASE_PUBLIC_VARS;
const LOCAL = "http://localhost:3247";
const PUERTO_APP = 3247;

function raizTemporal(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "dtd-supabase-sintetico-"));
  t.after(() => {
    // Único destino de borrado recursivo: el temporal de esta prueba.
    const destino = path.resolve(dir);
    const relativo = path.relative(path.resolve(tmpdir()), destino);
    assert.ok(relativo && !relativo.startsWith("..") && !path.isAbsolute(relativo));
    assert.ok(path.basename(destino).startsWith("dtd-supabase-sintetico-"));
    rmSync(destino, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  return dir;
}

function plan(t, { env = {}, archivos = {}, baseURL = LOCAL, levantaServidor = true, puertoApp = PUERTO_APP } = {}) {
  const raiz = raizTemporal(t);
  for (const [nombre, contenido] of Object.entries(archivos)) writeFileSync(path.join(raiz, nombre), contenido);
  return planSupabaseE2E({ env, raiz, baseURL, levantaServidor, puertoApp });
}

// ── El plan ──────────────────────────────────────────────────────────────────

test("sin las dos variables, destino local y webServer propio: sintético con URL local y anon key visible", (t) => {
  const p = plan(t);
  assert.equal(p.modo, "sintetico");
  assert.equal(p.puerto, PUERTO_APP + 10_000);
  assert.equal(p.url, `http://127.0.0.1:${PUERTO_APP + 10_000}`);
  assert.deepEqual(p.entorno, { [URL_VAR]: p.url, [KEY_VAR]: ANON_KEY_SINTETICA });
  assert.match(ANON_KEY_SINTETICA, /no-es-un-secreto/);
  assert.deepEqual(p.deteccion.faltan, [URL_VAR, KEY_VAR]);
});

test("con las dos en el entorno o en un .env que carga Next: configurado, y lo real nunca se pisa", (t) => {
  const enEntorno = plan(t, { env: { [URL_VAR]: URL_FALSA, [KEY_VAR]: CLAVE_FALSA } });
  assert.equal(enEntorno.modo, "configurado");
  assert.equal(enEntorno.entorno, undefined);
  const enArchivo = plan(t, { archivos: { ".env.local": `${URL_VAR}=${URL_FALSA}\n${KEY_VAR}=${CLAVE_FALSA}\n` } });
  assert.equal(enArchivo.modo, "configurado");
  assert.equal(enArchivo.entorno, undefined);
  assert.doesNotMatch(JSON.stringify(enArchivo), new RegExp(CLAVE_FALSA));
});

test("con una sola: parcial, nunca se mezcla un valor real con uno sintético", (t) => {
  assert.equal(plan(t, { env: { [URL_VAR]: URL_FALSA } }).modo, "parcial");
  assert.equal(plan(t, { archivos: { ".env": `${KEY_VAR}=${CLAVE_FALSA}\n` } }).modo, "parcial");
});

test("vacías en un .env cuentan como ausentes: el entorno del next dev gana, como en @next/env", (t) => {
  assert.equal(plan(t, { archivos: { ".env.local": `${URL_VAR}=\n${KEY_VAR}=\n` } }).modo, "sintetico");
});

test("destino remoto, servidor reusado o branch efímero: nada de sintético", (t) => {
  assert.equal(plan(t, { baseURL: "https://preview.dtdcargo.example" }).modo, "remoto");
  assert.equal(plan(t, { levantaServidor: false }).modo, "ausente");
  assert.equal(plan(t, { env: { E2E_ENVIRONMENT_KIND: "ephemeral" } }).modo, "ausente");
  assert.equal(plan(t, { env: { E2E_ENVIRONMENT_KIND: " ephemeral " } }).modo, "ausente");
});

test("el puerto: el fijado gana; sin él, el de la app ± 10000; inválido o igual al de la app es un error", () => {
  assert.equal(puertoSupabaseSintetico({ env: { E2E_SUPABASE_SINTETICO_PORT: "13555" }, puertoApp: 3100 }), 13555);
  assert.equal(puertoSupabaseSintetico({ env: {}, puertoApp: 3100 }), 13100);
  assert.equal(puertoSupabaseSintetico({ env: {}, puertoApp: 60_000 }), 50_000);
  for (const malo of ["abc", "80", "70000", "3100.5"]) {
    assert.throws(() => puertoSupabaseSintetico({ env: { E2E_SUPABASE_SINTETICO_PORT: malo }, puertoApp: 3100 }), /entre 1024 y 65535/);
  }
  assert.throws(() => puertoSupabaseSintetico({ env: { E2E_SUPABASE_SINTETICO_PORT: "3100" }, puertoApp: 3100 }), /distinto del puerto de la app/);
});

test("la detección efectiva: con sintético las dos existen; en los demás modos es la detección tal cual", (t) => {
  const sintetico = plan(t);
  const efectiva = deteccionEfectiva(sintetico);
  assert.equal(efectiva.configurado, true);
  assert.deepEqual(efectiva.faltan, []);
  assert.deepEqual(efectiva.fuentes, { [URL_VAR]: "sintético", [KEY_VAR]: "sintético" });
  const parcial = plan(t, { env: { [URL_VAR]: URL_FALSA } });
  assert.equal(deteccionEfectiva(parcial), parcial.deteccion);
});

// ── El servidor deny-only ────────────────────────────────────────────────────

function pedir(puerto, { method = "GET", ruta = "/", cuerpo } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: puerto, method, path: ruta }, (res) => {
      let texto = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (texto += c));
      res.on("end", () => resolve({ status: res.statusCode, texto, headers: res.headers }));
    });
    req.on("error", reject);
    if (cuerpo) req.write(cuerpo);
    req.end();
  });
}

test("el deny-only: salud 200, OPTIONS 204 y todo lo demás 503 sin eco del pedido", async (t) => {
  const servidor = crearServidorDenyOnly();
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => servidor.close(r)));
  const { port } = servidor.address();

  const salud = await pedir(port, { ruta: RUTA_SALUD_SINTETICO });
  assert.equal(salud.status, 200);
  assert.deepEqual(JSON.parse(salud.texto), { mode: "deny-only", ok: true });
  assert.equal((await pedir(port, { ruta: `${RUTA_SALUD_SINTETICO}?x=1` })).status, 200);
  assert.equal((await pedir(port, { method: "OPTIONS", ruta: "/rest/v1/clients" })).status, 204);

  const secreto = "persona@example.invalid";
  for (const [method, ruta] of [
    ["GET", "/auth/v1/user"],
    ["POST", "/auth/v1/token?grant_type=password"],
    ["GET", "/rest/v1/clients?select=*"],
    ["PATCH", "/rest/v1/clients?id=eq.1"],
    ["DELETE", "/storage/v1/object/x"],
    ["POST", RUTA_SALUD_SINTETICO],
  ]) {
    const r = await pedir(port, { method, ruta, cuerpo: method === "GET" || method === "DELETE" ? undefined : JSON.stringify({ email: secreto }) });
    assert.equal(r.status, 503, `${method} ${ruta}`);
    assert.deepEqual(JSON.parse(r.texto), RESPUESTA_DENEGADA);
    assert.doesNotMatch(r.texto, /persona@|clients|token/);
    assert.equal(r.headers["cache-control"], "no-store");
  }
});

test("el deny-only valida su puerto y no lee cabeceras ni cuerpos", async () => {
  assert.equal(parsearPuerto("13100"), 13100);
  for (const malo of ["", "80", "65536", "x"]) assert.throws(() => parsearPuerto(malo), /entre 1024 y 65535/);
  const fuente = await readFile(new URL("../e2e/supabase-deny-server.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(fuente, /pedido\.headers|on\("data"|console\./);
  assert.match(fuente, /listen\(puerto, "127\.0\.0\.1"/);
});

// ── verify ───────────────────────────────────────────────────────────────────

test("destinoE2E replica resolvePlaywrightRuntime: BASE_URL y la decisión de levantar el next dev", () => {
  assert.deepEqual(destinoE2E({}, 3150), { baseURL: "http://localhost:3150", levantaServidor: true, puertoApp: 3150 });
  assert.deepEqual(destinoE2E({ BASE_URL: "http://localhost:3150", E2E_START_WEB_SERVER: "0" }, 3150).levantaServidor, false);
  assert.equal(destinoE2E({ BASE_URL: "https://x.example" }, 3150).levantaServidor, false);
  assert.equal(destinoE2E({ BASE_URL: "http://localhost:3150", E2E_START_WEB_SERVER: "1" }, 3150).levantaServidor, true);
});

test("candidatos del sintético: primero app + 10000, después 13100–13799, sin repetir ni chocar con la app", () => {
  const c = candidatosSupabaseSintetico(3207, "C:/worktrees/uno");
  assert.equal(c[0], 13207);
  assert.equal(new Set(c).size, c.length);
  assert.ok(!c.includes(3207));
  for (const p of c.slice(1)) assert.ok(p >= PUERTO_BASE + 10_000 && p < PUERTO_BASE + PUERTO_RANGO + 10_000, String(p));
  assert.notDeepEqual(c.slice(1), candidatosSupabaseSintetico(3207, "C:/worktrees/dos").slice(1));
});

test("cobertura con el plan: sintético sin omisiones no es parcial; con omisiones marcadas lo es y dice la inconsistencia", (t) => {
  const efectiva = deteccionEfectiva(plan(t));
  assert.equal(coberturaParcialE2E({ deteccion: efectiva, reporte: null }), null);
  assert.equal(coberturaParcialE2E({ deteccion: efectiva, reporte: { suites: [] } }), null);
  const reporte = {
    suites: [{
      specs: [{
        file: "auth.spec.ts", line: 21, title: "caso",
        tests: [{ projectName: "chromium", status: "skipped", annotations: [{ type: "skip", description: `${MARCA_SIN_SUPABASE}: falta` }] }],
      }],
    }],
  };
  const parcial = coberturaParcialE2E({ deteccion: efectiva, reporte });
  assert.ok(parcial);
  assert.match(parcial.reason, /aunque verify lo ve configurado/);
});

test("el cableado: verify, playwright.config.ts y requiereSupabase() usan el mismo plan", async () => {
  const verify = await readFile(new URL("../verify.mjs", import.meta.url), "utf8");
  assert.match(verify, /let plan = planSupabaseE2E\(\{ env, \.\.\.destinoE2E\(env, puerto\) \}\);/);
  assert.equal((verify.match(/const supabase = planSupabaseDelPaso\(pasoEnv, /g) ?? []).length, 2, "los dos caminos del preflight");
  assert.match(verify, /extra\.E2E_SUPABASE_SINTETICO_PORT = String\(libre\);/);

  const config = await readFile(new URL("../../playwright.config.ts", import.meta.url), "utf8");
  assert.match(config, /const SUPABASE_E2E = resolveSupabaseE2E\(process\.env, RUNTIME\);/);
  assert.match(config, /metadata: \{ supabaseE2E: \{ modo: SUPABASE_E2E\.modo \} \},/);
  assert.match(config, /webServer: buildWebServers\(RUNTIME, SUPABASE_E2E\),/);
  assert.doesNotMatch(config, /process\.env\.NEXT_PUBLIC_SUPABASE_[A-Z_]+ =/, "el runner no se muta");

  const helper = await readFile(new URL("../../e2e/_helpers/supabase.ts", import.meta.url), "utf8");
  const cuerpo = helper.match(/export function requiereSupabase\(\): void \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const iSintetico = cuerpo.indexOf('if (modoSupabaseE2E() === "sintetico") return;');
  const iOmision = cuerpo.indexOf("omisionSinSupabase(");
  assert.ok(iSintetico >= 0 && iOmision > iSintetico, "el modo sintético se mira antes de decidir la omisión");
});

#!/usr/bin/env node
/**
 * Corre las pruebas contractuales de SQL (`supabase/tests/*.test.sql`) contra un
 * PostgreSQL desechable en Docker.
 *
 * POR QUÉ EXISTE: los tests SQL del repo estaban escritos pero no los corría
 * nadie — se ejecutaban a mano, una vez, cuando se escribió la migración. Eso es
 * exactamente lo que el runbook de migraciones llama "una nota en un handoff no
 * es un mecanismo". Un contrato de seguridad que nadie verifica se degrada en
 * silencio: basta un GRANT futuro para reabrir una escalada de privilegios que
 * ya se había cerrado.
 *
 * Cada test es autocontenido: crea su propio fixture (roles, schema auth, stubs),
 * aplica las migraciones reales con `\ir` y termina en ROLLBACK. Cero datos
 * persistidos, y NUNCA toca prod — corre contra un contenedor local y efímero.
 *
 * DEGRADA CON GRACIA, igual que los pasos `e2e` y `migrations-applied`: sin
 * Docker (o con `VERIFY_SKIP_SQL=1`) imprime SKIP y sale 0. No rompe el gate de
 * una ventana que no tenga Docker levantado.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";

const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  nc: "\x1b[0m",
};

const TESTS_DIR = resolve(process.cwd(), "supabase/tests");
const SUPABASE_DIR = resolve(process.cwd(), "supabase");
const IMAGE = process.env.SQL_TEST_PG_IMAGE || "postgres:17";

// Nombre de contenedor propio por worktree: dos ventanas corriendo el gate a la
// vez no se pisan (mismo criterio que e2ePort en verify.mjs).
const containerName = `dtd_sqltest_${crypto
  .createHash("sha1")
  .update(process.cwd())
  .digest("hex")
  .slice(0, 8)}`;

function docker(args, opts = {}) {
  return spawnSync("docker", args, { encoding: "utf8", ...opts });
}

// Un contrato puede imprimir más de 1 MiB, el máximo por omisión de spawnSync. Pasado
// ese máximo, Node mata a psql con ENOBUFS y un contrato verde sale en rojo (SDD-0573).
const PSQL_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Codigo de salida del SALTO — no es 0 a proposito.
 *
 * Antes este `skip` salia 0, asi que `verify.mjs` lo veia identico a un verde e
 * imprimia `[OK]`. Un cierre podia declarar "TODO VERDE" con este paso apagado,
 * y paso: cinco cierres publicaron con `migrations-applied` omitido, y el
 * 2026-08-15 el gate salio "verde" con `sql-tests` y `schema-rebuild` apagados
 * por no tener Docker levantado.
 *
 * Un paso que se omite en silencio es peor que uno que falla: el que falla se
 * arregla, el que se omite se cree.
 */
const EXIT_SKIPPED = 3;

function skip(reason) {
  console.log(`${C.yellow}[SKIP]${C.nc} sql-tests: ${reason}`);
  process.exit(EXIT_SKIPPED);
}

if (process.env.VERIFY_SKIP_SQL === "1") skip("VERIFY_SKIP_SQL=1 (omitido a pedido)");
if (!existsSync(TESTS_DIR)) skip("no hay supabase/tests/");

const files = readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith(".test.sql"))
  .sort();
if (files.length === 0) skip("no hay *.test.sql");

// ¿Docker vivo? `docker info` falla rápido si el daemon no está corriendo.
const info = docker(["info", "--format", "{{.ServerVersion}}"]);
if (info.error || info.status !== 0) {
  skip("Docker no disponible → las pruebas contractuales de SQL no corren (no bloquea el gate)");
}

console.log(`${C.dim}   ${files.length} prueba(s) · ${IMAGE} · contenedor efímero${C.nc}`);

let failed = [];
try {
  docker(["rm", "-f", containerName], { stdio: "ignore" });

  const up = docker([
    "run", "--rm", "-d",
    "--name", containerName,
    "-e", "POSTGRES_PASSWORD=postgres",
    // Más rápido y sin durabilidad: la base entera es descartable.
    "-e", "POSTGRES_INITDB_ARGS=--nosync",
    "-v", `${SUPABASE_DIR}:/sb:ro`,
    IMAGE,
    "-c", "fsync=off",
    "-c", "full_page_writes=off",
  ]);
  if (up.status !== 0) {
    skip(`no se pudo levantar ${IMAGE}: ${(up.stderr || "").trim().split("\n")[0]}`);
  }

  // Esperar a que acepte conexiones (el initdb tarda unos segundos). Por TCP y no por el socket: la imagen oficial
  // levanta primero un servidor temporal solo en el socket (`listen_addresses=''`) para el initdb, y después lo apaga
  // y arranca el definitivo. `pg_isready` por el socket daba por listo al temporal, y los primeros psql caían en el
  // cambio sin ningún ERROR de SQL: el rojo intermitente del control en el tren #427 (run 42415565680). El temporal no
  // escucha en 127.0.0.1; el definitivo sí.
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const r = docker(["exec", containerName, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
    if (r.status === 0) {
      ready = true;
      break;
    }
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},500)"]); // ~0.5s
  }
  if (!ready) skip("el contenedor de Postgres no aceptó conexiones a tiempo");

  for (const f of files) {
    const res = docker([
      "exec", containerName,
      "psql", "-U", "postgres", "-q",
      "-v", "ON_ERROR_STOP=1",
      "-f", `/sb/tests/${f}`,
    ], { maxBuffer: PSQL_MAX_BUFFER });
    if (res.status === 0) {
      console.log(`${C.green}   ✓${C.nc} ${C.dim}${f}${C.nc}`);
    } else {
      failed.push(f);
      // Un error del spawn (ENOBUFS, timeout) no es un ERROR de psql: se dice cuál. Y si psql cayó sin ningún ERROR
      // de SQL (no pudo conectarse, el servidor se cerró a mitad), se muestra su primera línea y su código: sin esto,
      // un fallo de conexión salía como un ✗ mudo.
      const salida = `${res.stdout || ""}${res.stderr || ""}`.split("\n");
      const errores = salida.filter((l) => l.includes("ERROR:"));
      const primera = salida.find((l) => l.trim());
      const err = (res.error
        ? [`el runner cortó a psql: ${res.error.code ?? res.error.message}`]
        : errores.length > 0 ? errores : [`psql salió con ${res.status} sin ERROR de SQL: ${(primera || "(sin salida)").trim()}`])
        .slice(0, 2)
        .join("\n      ");
      console.log(`${C.red}   ✗ ${f}${C.nc}`);
      if (err) console.log(`${C.dim}      ${err}${C.nc}`);
    }
  }
} finally {
  docker(["rm", "-f", containerName], { stdio: "ignore" });
}

if (failed.length > 0) {
  console.log(
    `${C.red}[FAIL]${C.nc} ${failed.length} contrato(s) de SQL roto(s): ${failed.join(", ")}`,
  );
  console.log(
    `${C.dim}   Una prueba de estas en rojo = una propiedad de seguridad que dejó de valer.${C.nc}`,
  );
  process.exit(1);
}

console.log(`${C.dim}   ${files.length} contrato(s) de SQL verificado(s) · rollback total${C.nc}`);
process.exit(0);

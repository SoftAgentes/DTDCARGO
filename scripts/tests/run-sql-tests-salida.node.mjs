/**
 * SDD-0573 · run-sql-tests no confunde una salida larga con un contrato roto.
 *
 * Con el máximo por omisión de spawnSync (1 MiB), Node mataba a psql con ENOBUFS y
 * los dos contratos de la 0497, que imprimen más que eso, salían en rojo estando
 * verdes y sin decir por qué.
 *
 * docker es un doble de sh en el PATH: acá no se levanta ningún contenedor ni se
 * toca una base. Por eso estas pruebas no corren en Windows.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(RAIZ, "scripts", "run-sql-tests.mjs");
const MIB = 1024 * 1024;
const SOLO_POSIX = { skip: process.platform === "win32" && "el doble de docker es un script de sh" };

function correr({ bytes, salida, listo = "exit 0" }) {
  const { PATH: rutas = "" } = process.env;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sql-tests-salida-"));
  try {
    fs.mkdirSync(path.join(dir, "supabase", "tests"), { recursive: true });
    fs.writeFileSync(path.join(dir, "supabase", "tests", "a.test.sql"), "select 1;\n");
    fs.mkdirSync(path.join(dir, "bin"));
    fs.writeFileSync(path.join(dir, "bin", "docker"), `#!/bin/sh
case "$1" in
  exec)
    case "$3" in
      pg_isready) ${listo} ;;
      *) head -c ${bytes} /dev/zero | tr '\\0' 'x' >&2; exit ${salida} ;;
    esac ;;
  *) exit 0 ;;
esac
`, { mode: 0o755 });
    return spawnSync(process.execPath, [SCRIPT], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, VERIFY_SKIP_SQL: "", PATH: `${path.join(dir, "bin")}${path.delimiter}${rutas}` },
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("un contrato verde que imprime más de 1 MiB sale verde", SOLO_POSIX, () => {
  const r = correr({ bytes: 2 * MIB, salida: 0 });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /✓.*a\.test\.sql/);
});

test("un contrato roto sigue en rojo aunque imprima mucho", SOLO_POSIX, () => {
  const r = correr({ bytes: 2 * MIB, salida: 3 });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /\[FAIL\].*a\.test\.sql/);
});

// La #426: un psql que cae sin ERROR de SQL dice su primera línea, pero recortada. La primera versión la imprimía
// entera, y con los 2 MiB de arriba tapaba el [FAIL] (run 42416468624, «Harness Director Worker»).
test("un psql que cae sin ERROR de SQL dice su primera línea, recortada", SOLO_POSIX, () => {
  const r = correr({ bytes: 2 * MIB, salida: 3 });
  assert.equal(r.status, 1, r.stdout.slice(0, 2000));
  assert.match(r.stdout, /psql salió con 3 sin ERROR de SQL: x{300}… \(2097152 caracteres\)/);
  assert.ok(r.stdout.length < 10_000, `la salida tiene ${r.stdout.length} caracteres`);
});

// La #426, tren #427: la espera va por TCP (-h 127.0.0.1), que el servidor temporal del initdb no escucha. Este
// doble solo responde que sí por TCP: con la espera por el socket, run-sql-tests nunca lo da por listo y sale con SKIP.
test("la espera de Postgres va por TCP, no por el socket del servidor temporal", SOLO_POSIX, () => {
  const r = correr({ bytes: 0, salida: 0, listo: 'case " $* " in *" -h 127.0.0.1 "*) exit 0 ;; *) exit 2 ;; esac' });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /✓.*a\.test\.sql/);
});

test("si el runner corta a psql, lo dice en vez de un rojo mudo", SOLO_POSIX, () => {
  const r = correr({ bytes: 65 * MIB, salida: 0 });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /el runner cortó a psql: ENOBUFS/);
});

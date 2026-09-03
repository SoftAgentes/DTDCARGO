#!/usr/bin/env node
/**
 * SDD-0375: PostgreSQL real, local y desechable; no depende de pg ni de red.
 * node scripts/check-public-verify-concurrency.mjs --legacy => RED esperado: 41.
 * Sin flags aplica 0169 + 0426 y verifica contrato SQL y concurrencia real.
 * Barreras por respuestas psql y pg_stat_activity, no carreras basadas en sleep.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const legacy = process.argv.includes("--legacy");
assert(process.argv.slice(2).every((arg) => arg === "--legacy"), "Único flag admitido: --legacy");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owner = randomUUID();
const name = `dtd-verify-0426-${owner}`;
const label = "dtd.public-verify-test-owner";
const image = process.env.SQL_TEST_PG_IMAGE || "postgres:17-alpine";
let containerId;
const sessions = [];

function docker(args, input) {
  const result = spawnSync("docker", args, {
    encoding: "utf8", input, windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`docker ${args[0]} falló: ${result.error?.message || result.stderr}`);
  }
  return result.stdout.trim();
}

function sqlFile(path) {
  return docker(["exec", containerId, "psql", "-X", "-qAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", path]);
}

class Psql {
  constructor(tag) {
    this.tag = `dtd_0426_${tag}`;
    this.output = "";
    this.stderr = "";
    this.sequence = 0;
    this.pending = null;
    this.child = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=${this.tag}`, containerId,
      "psql", "-X", "-qAt", "-U", "postgres", "-v", "ON_ERROR_STOP=0"],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => { this.output += chunk; this.consume(); });
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code) => this.fail(new Error(`psql ${tag} terminó (${code})`)));
    sessions.push(this);
  }

  fail(error) {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
  }

  consume() {
    if (!this.pending) return;
    const { marker, resolve: done, timer } = this.pending;
    const match = this.output.match(new RegExp(`(?:^|\\n)${marker} (true|false) ([0-9A-Z]{5})\\r?\\n`));
    if (!match) return;
    const rows = this.output.slice(0, match.index).trim();
    this.output = this.output.slice(match.index + match[0].length);
    clearTimeout(timer);
    this.pending = null;
    done({ rows, error: match[1] === "true", state: match[2] });
  }

  query(sql) {
    assert.equal(this.pending, null, `No solapar comandos en ${this.tag}`);
    const marker = `__DTD_END_${++this.sequence}__`;
    return new Promise((resolveQuery, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`Timeout del harness: ${this.tag}`)), 15000);
      this.pending = { marker, resolve: resolveQuery, reject, timer };
      this.child.stdin.write(`${sql}\n\\echo ${marker} :ERROR :SQLSTATE\n`);
    });
  }

  async ok(sql) {
    const result = await this.query(sql);
    assert.equal(result.error, false, `${this.tag}: SQLSTATE ${result.state}; ${this.stderr}`);
    return result.rows;
  }

  close() {
    this.child.stdin.end("\\quit\n");
  }
}

async function waitForLock(observer, waiter) {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    const waiting = await observer.ok(`select exists(select from pg_stat_activity
      where application_name='${waiter.tag}' and wait_event_type='Lock' and wait_event='advisory');`);
    if (waiting === "t") return;
    await delay(20);
  }
  throw new Error("No se observó la espera advisory real antes del timeout de la RPC");
}

async function seed(observer, ip, count = 39, age = "0 seconds") {
  await observer.ok(`insert into public.public_verify_throttle(ip,created_at)
    select '${ip}',clock_timestamp()-interval '${age}' from generate_series(1,${count});`);
}
const reserve = (ip) => `select public.reserve_public_verify_attempt('${ip}');`;
const countRows = (ip) => `select count(*) from public.public_verify_throttle where ip='${ip}';`;

async function runLegacy(observer, a, b) {
  const ip = "198.51.100.41";
  await seed(observer, ip);
  await Promise.all([a.ok("set role service_role;"), b.ok("set role service_role;")]);
  const reads = await Promise.all([a.ok(countRows(ip)), b.ok(countRows(ip))]);
  assert.deepEqual(reads, ["39", "39"], "Barrera: ambos lectores deben observar39 antes de INSERT");
  console.log("[RED legacy] Barrera confirmada: dos conexiones observaron39; se liberan ambos INSERT.");
  await Promise.all([a.ok(`insert into public.public_verify_throttle(ip) values('${ip}');`),
    b.ok(`insert into public.public_verify_throttle(ip) values('${ip}');`)]);
  const count = Number(await observer.ok(countRows(ip)));
  console.log(`[RED legacy] Filas confirmadas=${count}; máximo esperado=40.`);
  assert.equal(count, 40, "COUNT+INSERT permite41: reserva no atómica reproducida con PostgreSQL real");
}

async function runAtomic(observer, a, b) {
  for (const commit of [true, false]) {
    const ip = commit ? "198.51.100.42" : "198.51.100.43";
    await seed(observer, ip);
    await a.ok("begin; set local role service_role;");
    assert.equal(await a.ok(reserve(ip)), "t");
    await b.ok("begin; set local role service_role;");
    const pending = b.query(reserve(ip));
    await waitForLock(observer, b);
    // La clave distinta debe terminar mientras B sigue esperando a A.
    assert.equal(await observer.ok(`set role service_role; ${reserve(commit ? "198.51.100.52" : "198.51.100.53")}`), "t");
    await observer.ok("reset role;");
    await a.ok(commit ? "commit;" : "rollback;");
    const reservation = await pending;
    assert.equal(reservation.error, false);
    assert.equal(reservation.rows, commit ? "f" : "t");
    await b.ok("commit;");
    assert.equal(await observer.ok(countRows(ip)), "40");
    console.log(`[OK] Último cupo serializado con ${commit ? "COMMIT" : "ROLLBACK"}; otra clave independiente.`);
  }

  // El cupo vence mientras B está bloqueado: su reloj debe tomarse DESPUÉS
  // de adquirir el lock, no al iniciar la transacción ni al entrar a la RPC.
  const clockIp = "198.51.100.46";
  await seed(observer, clockIp, 40, "29 minutes 59 seconds");
  await a.ok("begin; set local role service_role;");
  assert.equal(await a.ok(reserve(clockIp)), "f", "La ventana aún debe estar llena al adquirir A");
  await b.ok("begin; set local role service_role;");
  const clockPending = b.query(reserve(clockIp));
  await waitForLock(observer, b);
  const expiryDeadline = Date.now() + 1500;
  let expired = false;
  while (Date.now() < expiryDeadline) {
    expired = await observer.ok(`select bool_and(created_at < clock_timestamp()-interval '30 minutes')
      from public.public_verify_throttle where ip='${clockIp}';`) === "t";
    if (expired) break;
    await delay(20);
  }
  assert(expired, "La barrera debe observar en el servidor el vencimiento de la ventana");
  const releasedAfter = await observer.ok("select clock_timestamp();");
  await a.ok("commit;");
  const clockResult = await clockPending;
  assert.equal(clockResult.error, false);
  assert.equal(clockResult.rows, "t", "El conteo debe usar el reloj posterior a esperar el lock");
  await b.ok("commit;");
  assert.equal(await observer.ok(`select count(*)=41 and max(created_at)>='${releasedAfter}'::timestamptz
    from public.public_verify_throttle where ip='${clockIp}';`), "t");
  console.log("[OK] Ventana y created_at usan reloj servidor posterior a adquirir el lock.");

  const ip = "198.51.100.44";
  await seed(observer, ip);
  await a.ok("begin; set local role service_role;");
  assert.equal(await a.ok(reserve(ip)), "t");
  await b.ok("begin; set local role service_role;");
  const timeout = b.query(reserve(ip));
  await waitForLock(observer, b);
  const result = await timeout;
  assert.equal(result.error, true);
  assert.equal(result.state, "55P03", "lock_timeout debe propagarse, no devolver reserva ni cupo falso");
  await b.ok("rollback;");
  await a.ok("rollback;");
  assert.equal(await observer.ok(countRows(ip)), "39");
  assert.equal(await b.ok(`set role service_role; ${reserve(ip)}`), "t");
  await b.ok("reset role;");
  console.log("[OK] Timeout de lock propagado; cero INSERT fallidos; rollback libera y permite reintentar.");

  for (const level of ["repeatable read", "serializable", "read uncommitted"]) {
    await b.ok(`begin isolation level ${level}; set local role service_role;`);
    const denied = await b.query(reserve("198.51.100.45"));
    assert.equal(denied.error, true);
    assert.equal(denied.state, "25000");
    await b.ok("rollback;");
  }
  assert.equal(await observer.ok(countRows("198.51.100.45")), "0");
  console.log("[OK] Sólo READ COMMITTED; otros tres niveles rechazados sin filas.");
}

function skip(reason) {
  console.log(`[SKIP] public-verify-concurrency: ${reason}`);
  process.exit(3); // Sólo se llama ANTES de crear cualquier contenedor.
}
if (process.env.VERIFY_SKIP_SQL === "1") skip("VERIFY_SKIP_SQL=1");
try { docker(["info", "--format", "{{.ServerVersion}}"]); }
catch { skip("Docker local no disponible"); }
try { docker(["image", "inspect", image]); }
catch { skip(`Imagen local ${image} no disponible; no se descarga`); }

try {
  containerId = docker(["run", "--pull", "never", "--rm", "-d", "--name", name,
    "--label", `${label}=${owner}`, "--network", "none",
    "--mount", `type=bind,source=${resolve(root, "supabase")},target=/sb,readonly`,
    "--tmpfs", "/var/lib/postgresql/data:rw", "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
    "-e", "POSTGRES_INITDB_ARGS=--nosync", image, "-c", "fsync=off", "-c", "full_page_writes=off"]);
  assert.match(containerId, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { docker(["exec", containerId, "pg_isready", "-U", "postgres"]); ready = true; break; }
    catch { await delay(250); }
  }
  assert(ready, "PostgreSQL local no disponible");
  const observer = new Psql("observer");
  const version = await observer.ok("show server_version;");
  assert.match(version, /^17\./, "Este contrato se valida en PostgreSQL17");
  console.log(`[LOCAL] PostgreSQL ${version} · ${name} · network=none`);
  if (!legacy) {
    const assertions = sqlFile("/sb/tests/0426_public_verify_atomic_reservation.test.sql");
    assert.match(assertions, /^\d+$/, "El contrato debe informar su recuento de aserciones");
    console.log(`[OK] Contrato SQL: ${assertions} aserciones y controles de savepoint; rollback total.`);
    assert.equal(await observer.ok("select to_regclass('public.public_verify_throttle') is null;"), "t",
      "El contrato SQL debe revertir toda su fixture");
  }
  await observer.ok("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  sqlFile("/sb/migrations/0169_public_verify_throttle.sql");
  await observer.ok("grant usage on schema public to service_role; grant select,insert on public.public_verify_throttle to service_role;");
  if (!legacy) sqlFile("/sb/migrations/0426_public_verify_atomic_reservation.sql");
  const a = new Psql("a");
  const b = new Psql("b");
  if (legacy) await runLegacy(observer, a, b);
  else await runAtomic(observer, a, b);
  console.log("[OK] Reserva atómica: contrato SQL y concurrencia PostgreSQL verificados.");
} catch (error) {
  console.error(`[FAIL] ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const session of sessions) session.close();
  if (containerId) {
    const [container] = JSON.parse(docker(["inspect", containerId]));
    assert.equal(container.Id, containerId);
    assert.equal(container.Name, `/${name}`);
    assert.equal(container.Config.Labels[label], owner, "No eliminar un contenedor sin ownership verificado");
    docker(["stop", "--time", "1", containerId]);
    const remaining = docker(["ps", "-aq", "--no-trunc", "--filter", `id=${containerId}`]);
    assert.equal(remaining, "", "El contenedor propio debe estar ausente antes de afirmar su eliminación");
    console.log(`[CLEANUP] Eliminado únicamente ${name} (--rm, datos en tmpfs).`);
  }
}

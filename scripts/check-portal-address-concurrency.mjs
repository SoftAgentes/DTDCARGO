#!/usr/bin/env node
// SDD0377: PostgreSQL17 desechable sin red; barreras por pg_stat_activity real.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owner = randomUUID();
const name = `dtd-address-0427-${owner}`;
const label = "dtd.portal-address-test-owner";
const image = process.env.SQL_TEST_PG_IMAGE || "postgres:17-alpine";
let containerId;
const sessions = [];
function docker(args) {
  const r = spawnSync("docker", args, { encoding: "utf8", windowsHide: true,
    timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`docker ${args[0]}: ${r.error?.message || r.stderr}`);
  return r.stdout.trim();
}
class Psql {
  constructor(tag) {
    this.tag = `dtd_0427_${tag}`;
    this.output = ""; this.stderr = ""; this.sequence = 0; this.pending = null;
    this.child = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=${this.tag}`,
      containerId, "psql", "-X", "-qAt", "-U", "postgres", "-v", "ON_ERROR_STOP=0"],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.setEncoding("utf8"); this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => { this.output += chunk; this.consume(); });
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code) => this.fail(new Error(`psql ${tag} terminó (${code})`)));
    sessions.push(this);
  }
  fail(error) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null;
  }
  consume() {
    if (!this.pending) return;
    const { marker, resolve: done, timer } = this.pending;
    const m = this.output.match(new RegExp(`(?:^|\\n)${marker} (true|false) ([0-9A-Z]{5})\\r?\\n`));
    if (!m) return;
    const rows = this.output.slice(0, m.index).trim();
    this.output = this.output.slice(m.index + m[0].length);
    clearTimeout(timer); this.pending = null;
    done({ rows, error: m[1] === "true", state: m[2] });
  }
  query(sql) {
    assert.equal(this.pending, null, "No solapar comandos de una conexión");
    const marker = `__DTD_END_${++this.sequence}__`;
    return new Promise((resolveQuery, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`Timeout harness ${this.tag}`)), 15000);
      this.pending = { marker, resolve: resolveQuery, reject, timer };
      this.child.stdin.write(`${sql}\n\\echo ${marker} :ERROR :SQLSTATE\n`);
    });
  }
  async ok(sql) {
    const r = await this.query(sql);
    assert.equal(r.error, false, `${this.tag}: ${r.state}; ${this.stderr}`);
    return r.rows;
  }
}
const id = (value) => `md5('0427-synthetic-${value}')::uuid`;
const call = (address) => `select public.delete_portal_delivery_address(${id(address)}, '${randomUUID()}'::uuid);`;
const begin = (actor = "portal-A") => `begin; set local role authenticated; select set_config('request.jwt.claim.sub', ${id(actor)}::text, true);`;
const events = (address) => `select count(*) from public.entity_audit_log where entity_type='client_delivery_address' and entity_id=${id(address)};`;
const active = (address) => `select deleted_at is null from public.client_delivery_addresses where id=${id(address)};`;
async function barrier(observer, waiter) {
  const end = Date.now() + 1500;
  while (Date.now() < end) {
    if (await observer.ok(`select exists(select from pg_stat_activity where application_name='${waiter.tag}' and wait_event_type='Lock');`) === "t") return;
    await delay(20);
  }
  throw new Error(`No se observó lock real en ${waiter.tag}`);
}
function skip(reason) { console.log(`[SKIP] portal-address-concurrency: ${reason}`); process.exit(3); }
if (process.env.VERIFY_SKIP_SQL === "1") skip("VERIFY_SKIP_SQL=1");
try { docker(["info", "--format", "{{.ServerVersion}}"]); } catch { skip("Docker no disponible"); }
try { docker(["image", "inspect", image]); } catch { skip("Imagen local no disponible; no descargar"); }
try {
  containerId = docker(["run", "--pull", "never", "--rm", "-d", "--name", name,
    "--label", `${label}=${owner}`, "--network", "none",
    "--mount", `type=bind,source=${resolve(root, "supabase")},target=/sb,readonly`,
    "--tmpfs", "/var/lib/postgresql/data:rw", "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
    "-e", "POSTGRES_INITDB_ARGS=--nosync", image, "-c", "fsync=off"]);
  assert.match(containerId, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { docker(["exec", containerId, "pg_isready", "-U", "postgres"]); ready = true; break; }
    catch { await delay(250); }
  }
  assert(ready, "PostgreSQL no disponible");
  const contract = docker(["exec", containerId, "psql", "-X", "-qAt", "-U", "postgres",
    "-v", "ON_ERROR_STOP=1", "-f", "/sb/tests/0427_portal_delete_delivery_address_command.test.sql"]);
  assert.match(contract, /\d+\s*$/, "Contrato SQL debe informar aserciones antes del rollback");
  console.log(`[OK] Contrato SQL: ${contract.trim().split(/\s+/).at(-1)} aserciones + rollback íntegro.`);
  const fixture = docker(["exec", containerId, "psql", "-X", "-qAt", "-U", "postgres",
    "-v", "ON_ERROR_STOP=1", "-v", "keep_fixture=true", "-f",
    "/sb/tests/0427_portal_delete_delivery_address_command.test.sql"]);
  assert.match(fixture, /FIXTURE_0427_READY/);
  const observer = new Psql("observer"), a = new Psql("a"), b = new Psql("b");
  assert.match(await observer.ok("show server_version;"), /^17\./);

  for (const commit of [true, false]) {
    const address = commit ? "address-A" : "address-rollback";
    await a.ok(begin());
    assert.equal(await a.ok(call(address)), "t");
    await b.ok(begin());
    const pending = b.query(call(address));
    await barrier(observer, b);
    await a.ok(commit ? "commit;" : "rollback;");
    const result = await pending;
    assert.equal(result.error, false); assert.equal(result.rows, "t");
    await b.ok("commit;");
    assert.equal(await observer.ok(events(address)), "1");
    assert.equal(await observer.ok(active(address)), "f");
    console.log(`[OK] Dos borrados, primero ${commit ? "commit" : "rollback"}: un evento durable.`);
  }
  // Revocación anterior: el comando espera y vuelve a comprobar el vínculo.
  await a.ok(`begin; update public.client_users set status='revoked' where auth_user_id=${id("portal-A")};`);
  await b.ok(begin());
  const revoked = b.query(call("address-audit-error"));
  await barrier(observer, b);
  await a.ok("commit;");
  assert.deepEqual(await revoked, { rows: "f", error: false, state: "00000" });
  await b.ok("commit;");
  assert.equal(await observer.ok(active("address-audit-error")), "t");
  assert.equal(await observer.ok(events("address-audit-error")), "0");
  await observer.ok(`update public.client_users set status='active' where auth_user_id=${id("portal-A")};`);
  console.log("[OK] Revocación concurrente revalidada tras esperar; cero borrado.");

  // Borrado anterior: la revocación no puede adelantarse a su commit/rollback.
  await a.ok(begin());
  assert.equal(await a.ok(call("address-audit-error")), "t");
  const revokeAfter = b.query(`begin; update public.client_users set status='revoked' where auth_user_id=${id("portal-A")};`);
  await barrier(observer, b);
  // Otro tenant se mantiene operativo mientras el vínculo de A está bloqueado.
  await observer.ok(begin("portal-B"));
  assert.equal(await observer.ok(call("address-B")), "t");
  await observer.ok("rollback;");
  await a.ok("rollback;");
  assert.equal((await revokeAfter).error, false);
  await b.ok("commit;");
  assert.equal(await observer.ok(active("address-audit-error")), "t");
  assert.equal(await observer.ok(events("address-audit-error")), "0");
  await observer.ok(`update public.client_users set status='active' where auth_user_id=${id("portal-A")};`);
  console.log("[OK] SHARE protege vínculo hasta rollback; tenant distinto independiente.");

  // Traslado de dirección: FOR UPDATE reevalúa la propiedad después del lock.
  await a.ok(`begin; update public.client_delivery_addresses set client_id=${id("client-other")} where id=${id("address-rename")};`);
  await b.ok(begin());
  const moved = b.query(call("address-rename"));
  await barrier(observer, b); await a.ok("commit;");
  assert.deepEqual(await moved, { rows: "f", error: false, state: "00000" });
  await b.ok("commit;");
  assert.equal(await observer.ok(active("address-rename")), "t");
  assert.equal(await observer.ok(events("address-rename")), "0");
  console.log("[OK] Transferencia concurrente no borra una dirección que dejó de ser propia.");

  // Cliente dado de baja mientras se espera: no basta validar sólo client_users.
  await a.ok(`begin; update public.clients set deleted_at=clock_timestamp() where id=${id("client-A")};`);
  await b.ok(begin());
  const retired = b.query(call("address-audit-error"));
  await barrier(observer, b); await a.ok("commit;");
  assert.deepEqual(await retired, { rows: "f", error: false, state: "00000" });
  await b.ok("commit;");
  assert.equal(await observer.ok(active("address-audit-error")), "t");
  await observer.ok(`update public.clients set deleted_at=null where id=${id("client-A")};`);
  console.log("[OK] Baja de cliente concurrente revalidada sin tocar la dirección.");

  await a.ok(`begin; select id from public.client_delivery_addresses where id=${id("address-audit-null")} for update;`);
  await b.ok(begin());
  const timeout = b.query(call("address-audit-null"));
  await barrier(observer, b);
  const denied = await timeout;
  assert.equal(denied.error, true); assert.equal(denied.state, "55P03");
  await b.ok("rollback;"); await a.ok("rollback;");
  assert.equal(await observer.ok(active("address-audit-null")), "t");
  assert.equal(await observer.ok(events("address-audit-null")), "0");
  console.log("[OK] lock_timeout2s propaga55P03, rollback sin evento ni borrado.");

  // Snapshot viejo tampoco conserva autoridad revocada.
  await b.ok(`begin isolation level repeatable read; select count(*) from public.client_users;`);
  await a.ok(`update public.client_users set status='revoked' where auth_user_id=${id("portal-A")};`);
  await b.ok(`set local role authenticated; select set_config('request.jwt.claim.sub',${id("portal-A")}::text,true);`);
  const stale = await b.query(call("address-audit-error"));
  assert.equal(stale.error, true); assert.equal(stale.state, "40001");
  await b.ok("rollback;");
  assert.equal(await observer.ok(active("address-audit-error")), "t");
  assert.equal(await observer.ok(events("address-audit-error")), "0");
  console.log("[OK] Snapshot REPEATABLE READ obsoleto falla40001; no autoridad residual.");
  console.log("[OK] Concurrencia Portal: 8 escenarios reales, sin servicios externos.");
} catch (error) {
  console.error(`[FAIL] ${error.message}`); process.exitCode = 1;
} finally {
  for (const session of sessions) session.child.stdin.end("\\quit\n");
  if (containerId) {
    const [container] = JSON.parse(docker(["inspect", containerId]));
    assert.equal(container.Id, containerId); assert.equal(container.Name, `/${name}`);
    assert.equal(container.Config.Labels[label], owner);
    docker(["stop", "--time", "1", containerId]);
    assert.equal(docker(["ps", "-aq", "--no-trunc", "--filter", `id=${containerId}`]), "");
    console.log(`[CLEANUP] Sólo contenedor propio ${name}, datos sintéticos tmpfs.`);
  }
}

#!/usr/bin/env node
/**
 * 0572-b: PostgreSQL 17 + PostgREST 14.17, datos/JWT sintéticos, solo loopback.
 * Uso: node scripts/tests/annual-billing-fx-v2-postgrest.mjs --evidence C:/tmp/...
 * Requiere Docker activo. No arranca Desktop, no env/productivo ni recursos ajenos.
 * Ejecuta contrato SQL con rollback; fixture HTTP confirmado antes de arrancar
 * PostgREST -> 0498 real/COMMIT -> NOTIFY en caliente -> HTTP posterior.
 * auth.uid es adaptador sintético; get_user_tenant_id procede de 0453 REAL.
 * current_studio_role/otras dependencias de catálogo son fixtures declaradas.
 * No demuestra Auth de Supabase ni conexiones/sesiones productivas.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const option = process.argv.indexOf("--evidence");
assert(option >= 0 && process.argv[option + 1], "Falta --evidence con directorio externo");
const evidence = resolve(process.argv[option + 1]);
assert(isAbsolute(evidence) && !evidence.startsWith(root), "La evidencia debe quedar fuera del worktree");
await mkdir(evidence, { recursive: true });
const suffix = process.pid + "-" + Date.now().toString(36);
const network = "dtd-0572b-" + suffix;
const pg = network + "-pg";
const rest = network + "-rest";
const imagePg = "postgres:17";
const imageRest = "postgrest/postgrest:v14.17";
const syntheticPassword = randomBytes(24).toString("hex");
const syntheticJwtSecret = randomBytes(32).toString("hex");
const receipt = { startedAt: new Date().toISOString(), root, head: null, migrationSha256: null, images: {}, checks: [], resources: { network, pg, rest }, cleanup: [], result: "RUNNING" };
const httpOnly = process.argv.includes("--http-only");
receipt.httpNegatives = [];
const negative = (name, response) => receipt.httpNegatives.push({ name, ...response });
const created = [];
let hasNetwork = false;

function run(command, args, { input, timeout = 120000, allowFailure = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: false });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if ((code !== 0 || signal) && !allowFailure) reject(new Error(command + " terminó " + code + "/" + signal + "\n" + stderr + "\n" + stdout));
      else resolveRun({ code, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}
const docker = (args, options) => run("docker", args, options);
const save = (name, data) => writeFile(resolve(evidence, name), typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, details = {}) => { receipt.checks.push({ name, at: new Date().toISOString(), ...details }); console.log("PASÓ: " + name); };
const id = (label) => {
  const hex = createHash("md5").update("0498-synthetic-" + label).digest("hex");
  return hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
};
const token = (actor, role = "authenticated") => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role, sub: id(actor), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const unsigned = header + "." + payload;
  return unsigned + "." + createHmac("sha256", syntheticJwtSecret).update(unsigned).digest("base64url");
};
async function port() {
  const server = createServer();
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListen); });
  const value = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return value;
}
const httpPort = await port();
const base = "http://127.0.0.1:" + httpPort;
receipt.resources.httpPort = httpPort;
const psql = (sql) => docker(["exec", "-i", pg, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-At"], { input: sql });
async function rpc(name, actor, body = {}, options = {}) {
  const headers = { "Content-Type": "application/json", ...(actor ? { Authorization: "Bearer " + token(actor, options.role) } : {}), ...(options.headers ?? {}) };
  const query = new URLSearchParams(options.query ?? {}).toString();
  const response = await fetch(base + "/rpc/" + name + (query ? "?" + query : ""), { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, range: response.headers.get("content-range") };
}
async function eventually(operation, predicate, ms = 30000) {
  const until = Date.now() + ms;
  let last;
  do { try { last = await operation(); if (predicate(last)) return last; } catch (error) { last = String(error); } await delay(300); } while (Date.now() < until);
  throw new Error("Espera local agotada: " + JSON.stringify(last));
}
try {
  receipt.head = (await run("git", ["rev-parse", "HEAD"])).stdout.trim();
  receipt.migrationSha256 = createHash("sha256").update(await readFile(resolve(root, "supabase/migrations/0498_annual_billing_fx_v2.sql"))).digest("hex");
  receipt.dockerVersion = (await docker(["version", "--format", "{{.Server.Version}}"])).stdout.trim();
  await docker(["network", "create", "--label", "dtd.task=0572b", network]); hasNetwork = true;
  await docker(["run", "-d", "--name", pg, "--label", "dtd.task=0572b", "--network", network, "--network-alias", "db", "--mount", "type=bind,source=" + resolve(root, "supabase") + ",target=/sb,readonly", "-e", "POSTGRES_PASSWORD=" + syntheticPassword, imagePg], { timeout: 300000 });
  created.push(pg);
  await eventually(() => docker(["exec", pg, "pg_isready", "-U", "postgres"], { allowFailure: true }), (r) => r.code === 0, 60000);
  receipt.images.postgres = (await docker(["inspect", "--format", "{{.Image}}", pg])).stdout.trim();
  receipt.postgresVersion = (await psql("select version();")).stdout.trim();
  assert.match(receipt.postgresVersion, /PostgreSQL 17\./);
  if (!httpOnly) {
  const sql = await docker(["exec", pg, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", "/sb/tests/0498_annual_billing_fx_v2.test.sql"]);
  await save("postgres-contract.log", sql.stdout + "\n" + sql.stderr);
  assert.match(sql.stdout, /TEST 0498 GREEN: \d+ aserciones/);
  check("contrato SQL real y rollback", { marker: sql.stdout.match(/TEST 0498 GREEN: \d+ aserciones/)[0] });
  } else receipt.sqlContract = "NO EJECUTADO en esta corrida --http-only";

  const fixture = await docker(["exec", pg, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "fixture_only=true", "-U", "postgres", "-d", "postgres", "-f", "/sb/tests/0498_annual_billing_fx_v2.test.sql"]);
  await save("http-fixture.log", fixture.stdout + "\n" + fixture.stderr);
  await psql("create role authenticator login noinherit password '" + syntheticPassword + "'; grant anon,authenticated,service_role to authenticator;");
  const asOf = (await psql("select current_date::text;")).stdout.trim();
  await docker(["run", "-d", "--name", rest, "--label", "dtd.task=0572b", "--network", network, "-p", "127.0.0.1:" + httpPort + ":3000",
    "-e", "PGRST_DB_URI=postgres://authenticator:" + syntheticPassword + "@db:5432/postgres",
    "-e", "PGRST_DB_SCHEMAS=public", "-e", "PGRST_DB_ANON_ROLE=anon",
    "-e", "PGRST_DB_MAX_ROWS=500", "-e", "PGRST_JWT_SECRET=" + syntheticJwtSecret,
    imageRest], { timeout: 300000 });
  created.push(rest);
  receipt.images.postgrest = (await docker(["inspect", "--format", "{{.Image}}", rest])).stdout.trim();
  receipt.postgrestVersion = (await docker(["exec", rest, "/bin/postgrest", "--version"])).stdout.trim();
  assert.match(receipt.postgrestVersion, /14\.17/);
  const oldPortal = await eventually(() => rpc("get_portal_referral_program", "portal"), (r) => r.status === 200);
  assert(!("billing_v2" in oldPortal.data));
  const before = await rpc("studio_client_annual_billing_v2", "commercial", { p_as_of: asOf });
  assert.equal(before.status, 404); assert.equal(before.data.code, "PGRST202");
  const oldV1 = await rpc("studio_client_annual_billing", "commercial", { p_as_of: asOf });
  assert.equal(oldV1.status, 200);
  await save("http-before.json", { before, oldPortal, oldV1 });
  check("HTTP antes del DDL: v2 ausente y v1/Portal legado operables");

  const restStarted = (await docker(["inspect", "--format", "{{.State.StartedAt}}", rest])).stdout.trim();
  receipt.postgrestStartedAtBeforeDdl = restStarted;
  receipt.ddlStartedAt = new Date().toISOString();
  const ddl = await docker(["exec", pg, "psql", "-X", "-1", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", "/sb/migrations/0498_annual_billing_fx_v2.sql"]);
  await save("http-migration-0498.log", ddl.stdout + "\n" + ddl.stderr);
  receipt.ddlCommittedAt = new Date().toISOString();
  const after = await eventually(() => rpc("studio_client_annual_billing_v2", "commercial", { p_as_of: asOf }), (r) => r.status === 200);
  receipt.postgrestStartedAtAfterDdl = (await docker(["inspect", "--format", "{{.State.StartedAt}}", rest])).stdout.trim();
  assert.equal(receipt.postgrestStartedAtAfterDdl, restStarted);
  check("DDL0498 confirmado y recarga en caliente en el mismo PostgREST");
  assert.deepEqual(after.data.find((r) => r.client_markbox === "DTD-BASE"), { client_markbox: "DTD-BASE", subtotal_usd: "210.00", sin_tasa_count: 1, conversion_state: "sin_tasa" });
  const portal = await rpc("get_portal_referral_program", "portal");
  const { billing_v2, ...legacy } = portal.data;
  assert.deepEqual(legacy, oldPortal.data);
  assert.deepEqual(billing_v2, { version: 2, subtotal_usd: "215.00", sin_tasa_count: 1, conversion_state: "sin_tasa" });
  assert.deepEqual((await rpc("studio_client_annual_billing", "commercial", { p_as_of: asOf })).data, oldV1.data);
  await save("http-after.json", { after, portal });
  check("HTTP v2 decimal string/contador real y compatibilidad legado", { decimalType: typeof billing_v2.subtotal_usd, counterType: typeof billing_v2.sin_tasa_count });

  const other = await rpc("studio_client_annual_billing_v2", "other", { p_as_of: asOf });
  assert.equal(other.data.length, 1); assert.equal(other.data[0].subtotal_usd, "999.00");
  for (const actor of ["disabled", "ambiguous", "operations", "portal"]) {
    const response = await rpc("studio_client_annual_billing_v2", actor, { p_as_of: asOf });
    negative(actor, response);
    assert.equal(response.status, 403, actor); assert.equal(response.data.code, "42501", actor);
  }
  for (const role of ["anon", "service_role"]) {
    const response = await rpc("studio_client_annual_billing_v2", "admin", { p_as_of: asOf }, { role });
    negative(role, response);
    assert([401,403,404].includes(response.status), role + " no ejecuta");
  }
  const noAuth = await rpc("studio_client_annual_billing_v2", null, { p_as_of: asOf });
  negative("sin JWT", noAuth);
  assert([401,403,404].includes(noAuth.status));
  for (const actor of ["revoked", "incoherent"]) {
    const response = await rpc("get_portal_referral_program", actor);
    negative("Portal " + actor, response); assert.equal(response.data, null);
  }
  const privateFn = await rpc("convertir", "admin", { p_amount: 1, p_currency: "USD", p_rate: null });
  negative("helper privado", privateFn);
  assert.equal(privateFn.status, 404);
  const invalidDate = await rpc("studio_client_annual_billing_v2", "admin", { p_as_of: null });
  negative("fecha nula", invalidDate); assert.equal(invalidDate.data.code, "22023");
  check("JWT sintético: aislamiento, ambigüedad0453, roles/ACL y fecha");
  await psql("insert into public.studio_role_module_overrides values ('" + id("A") + "','commercial','fidelizacion',false);");
  assert.equal((await rpc("studio_client_annual_billing_v2", "commercial", { p_as_of: asOf })).status, 200);
  await psql("insert into public.studio_role_module_overrides values ('" + id("A") + "','commercial','kommo',false);");
  const revokedModules = await rpc("studio_client_annual_billing_v2", "commercial", { p_as_of: asOf });
  negative("ambos módulos false", revokedModules); assert.equal(revokedModules.status, 403);
  await psql("delete from public.studio_role_module_overrides;");
  check("HTTP permisos OR y false explícito");

  await psql("insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,fx_rate,base_amount,total_amount,status,issued_at) select md5('0498-http-'||g)::uuid,'" + id("B") + "','http-'||g,'Z-'||lpad(g::text,5,'0'),'Sintético','CNY',case when g=1201 then null else 7 end,g,g,'emitida',current_date from generate_series(1,1201) g;");
  const rows = [], pages = []; let offset = 0;
  for (let page = 0; page < 10; page++) {
    // Como PostgrestTransformBuilder.range del SDK: offset/limit por query,
    // no Range header (PostgREST no lo aplica a POST RPC).
    const response = await rpc("studio_client_annual_billing_v2", "other", { p_as_of: asOf }, { query: { offset: String(offset), limit: "1000", order: "client_markbox.asc" } });
    assert([200,206].includes(response.status));
    assert(Array.isArray(response.data));
    pages.push({ offset, length: response.data.length, range: response.range });
    if (response.data.length === 0) break;
    assert(response.data.length <= 500);
    rows.push(...response.data); offset += response.data.length;
  }
  assert.deepEqual(pages.map((r) => r.length), [500,500,202,0]);
  assert.equal(rows.length, 1202); assert.equal(new Set(rows.map((r) => r.client_markbox)).size, 1202);
  assert.deepEqual(rows.at(-1), { client_markbox: "Z-01201", subtotal_usd: "0.00", sin_tasa_count: 1, conversion_state: "sin_tasa" });
  await save("http-pagination.json", { asOf, pages, count: rows.length, last: rows.at(-1) });
  check("HTTP >1000 grupos/cap500 hasta página vacía, último solo sin tasa", { pages });

  await psql("insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,fx_rate,base_amount,total_amount,status,issued_at) values(md5('0498-http-large')::uuid,'" + id("B") + "','http-large','ZZ-LARGE','Sintético','VES',0.00000001,999999999999.99,999999999999.99,'emitida',current_date);");
  const huge = await fetch(base + "/rpc/studio_client_annual_billing_v2?client_markbox=eq.ZZ-LARGE", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token("other") }, body: JSON.stringify({ p_as_of: asOf }), signal: AbortSignal.timeout(15000) });
  const hugeData = await huge.json(); assert.equal(huge.status,200); assert.equal(hugeData[0].subtotal_usd,"99999999999999000000.00");
  check("HTTP importe grande conserva decimal exacto");
  receipt.result = "PASÓ";
} catch (error) {
  receipt.result = "FALLÓ"; receipt.error = String(error);
  console.error(receipt.error); process.exitCode = 1;
} finally {
  for (const name of [...created].reverse()) {
    try {
      if (name === rest) { const logs = await docker(["logs", name], { allowFailure: true }); await save("postgrest.log", logs.stdout + logs.stderr); }
      const cleanup = await docker(["rm", "-f", "-v", name], { allowFailure: true });
      const remaining = await docker(["inspect", name], { allowFailure: true });
      receipt.cleanup.push({ name, exit: cleanup.code, absent: remaining.code !== 0 });
      if (cleanup.code !== 0 || remaining.code === 0) { receipt.result = "FALLÓ"; process.exitCode = 1; }
    } catch (error) { receipt.cleanup.push({ name, error: String(error) }); receipt.result = "FALLÓ"; process.exitCode = 1; }
  }
  if (hasNetwork) {
    const cleanup = await docker(["network", "rm", network], { allowFailure: true });
    receipt.cleanup.push({ name: network, exit: cleanup.code });
    if (cleanup.code !== 0) { receipt.result = "FALLÓ"; process.exitCode = 1; }
  }
  receipt.finishedAt = new Date().toISOString();
  await save("receipt.json", receipt);
  console.log("Recibo: " + resolve(evidence, "receipt.json"));
}

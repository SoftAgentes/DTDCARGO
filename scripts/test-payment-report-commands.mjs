#!/usr/bin/env node
/** SDD-0365. Conexiones reales, sólo fixtures; Docker propio, nunca --linked.
 * node scripts/test-payment-report-commands.mjs [--advisors]
 * No limpia por nombre ni reutiliza una DB existente. El contenedor se retira
 * sólo si su ID y etiqueta de esta ejecución coinciden.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const runId = randomUUID();
const image = process.env.SQL_TEST_PG_IMAGE || 'postgres:17';
let container;
const active = new Set();
const id = (label) => {
  const h = createHash('md5').update(`0421-synthetic-${label}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const literal = (s) => `'${String(s).replaceAll("'", "''")}'`;
const uuid = (s) => `${literal(id(s))}::uuid`;
const proof = (tenant, invoice, report) => `${id(tenant)}/${id(invoice)}/${id(report)}/${id('object')}.pdf`;
function sync(command, args) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`${command} falló: ${r.error?.message || r.stderr || r.stdout}`);
  return r.stdout.trim();
}
function pg(sql, app = 'dtd0421-check') {
  assert.match(container, /^[a-f0-9]{64}$/);
  const child = spawn('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-Atq',
    '-v', 'ON_ERROR_STOP=1', '-c', `set application_name=${literal(app)}; set statement_timeout='15s'; ${sql}`],
  { stdio: ['ignore', 'pipe', 'pipe'] });
  const promise = new Promise((resolveResult, reject) => {
    let stdout = '', stderr = '';
    child.stdout.on('data', (s) => { stdout += s; });
    child.stderr.on('data', (s) => { stderr += s; });
    child.once('error', reject);
    child.once('close', (code) => resolveResult({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
  active.add(promise);
  promise.then(() => active.delete(promise), () => active.delete(promise));
  return promise;
}
async function ok(sql) {
  const r = await pg(sql);
  assert.equal(r.code, 0, r.stderr);
  return r.stdout;
}
const session = (actor, sql) => `begin; set local role authenticated;
  select set_config('request.jwt.claim.sub', ${literal(id(actor))}, true); ${sql}; commit;`;
const create = (request, report, invoice, tenant = 'tenant-A', code = 'F-CMD-SHARED') =>
  `select public.create_portal_payment_report(${uuid(request)},${uuid(report)},${literal(code)},100,'otro',current_date-1,${literal(proof(tenant, invoice, report))},'Nota sintética')`;
const resolveReport = (request, report, action = 'confirmado') =>
  `select public.resolve_payment_report(${uuid(request)},${uuid(report)},${literal(action)},'Revisión sintética')`;
async function waitFor(sql, expected, description) {
  const until = Date.now() + 8_000;
  while (Date.now() < until) {
    if (await ok(sql) === String(expected)) return;
    await delay(50);
  }
  throw new Error(`No se observó la barrera: ${description}`);
}
// El bloqueador confirma después de 4s. Antes de liberarlo exigimos observar
// a los dos comandos realmente esperando un lock; no basta lanzar dos promesas.
async function race(label, blockerSql, calls) {
  const holder = `dtd0421-${label}-holder`;
  const jobs = [pg(`begin; ${blockerSql}; select pg_sleep(4); commit;`, holder)];
  try {
    await waitFor(`select count(*) from pg_stat_activity where application_name=${literal(holder)} and wait_event='PgSleep'`, 1, label);
    const names = calls.map((_, n) => `dtd0421-${label}-${n}`);
    jobs.push(...calls.map((sql, n) => pg(sql, names[n])));
    await waitFor(`select count(*) from pg_stat_activity where application_name in (${names.map(literal).join(',')}) and wait_event_type='Lock'`, calls.length, `${label}: solicitudes bloqueadas`);
    const [held, ...results] = await Promise.all(jobs);
    assert.equal(held.code, 0, held.stderr);
    return results;
  } finally {
    await Promise.allSettled(jobs);
  }
}
const lockInvoice = (invoice) => `select id from public.invoices where id=${uuid(invoice)} for update`;
function oneSuccess(results, failure) {
  assert.equal(results.filter((r) => r.code === 0).length, 1, JSON.stringify(results));
  assert.match(results.find((r) => r.code !== 0).stderr, new RegExp(failure));
}

try {
  const args = process.argv.slice(2);
  assert(args.every((v) => v === '--advisors'), 'Sólo se admite --advisors');
  container = sync('docker', ['run', '--rm', '-d', '--name', `dtd_paycmd_${runId.slice(0, 12)}`,
    '--label', `codex.payment-test-run=${runId}`, '--label', 'codex.purpose=payment-command-concurrency',
    '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=postgres',
    '--mount', `type=bind,src=${resolve('supabase')},dst=/sb,readonly`, image,
    '-c', 'fsync=off', '-c', 'full_page_writes=off']);
  assert.match(container, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let i = 0; i < 80; i++) {
    const r = await pg('select 1');
    if (r.code === 0) { ready = true; break; }
    await delay(250);
  }
  assert(ready, 'PostgreSQL no inició');
  sync('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1',
    '-v', 'fixture_only=true', '-f', '/sb/tests/0421_payment_report_commands.test.sql']);
  console.log('Fixture aislado instalado; comandos y auditoría reales.');

  for (let n = 1; n <= 4; n++) {
    await ok(session('portal-A', create(`cap-${n}`, `limit-${n}`, 'invoice-limit', 'tenant-A', 'F-LIMIT')));
  }
  oneSuccess(await race('pending-limit', lockInvoice('invoice-limit'), [5, 6].map((n) =>
    session('portal-A', create(`cap-${n}`, `limit-${n}`, 'invoice-limit', 'tenant-A', 'F-LIMIT')))), 'PAYMENT_PENDING_LIMIT');
  assert.equal(await ok(`select count(*) from public.payment_reports where invoice_id=${uuid('invoice-limit')} and status='reportado' and deleted_at is null and cancelled_at is null`), '5');
  assert.equal(await ok(`select count(*) from payment_private.report_commands where report_id in (select id from public.payment_reports where invoice_id=${uuid('invoice-limit')})`), '5');
  console.log('PASS: dos altas compiten por el quinto cupo; sólo una confirma.');

  const repeated = session('portal-A', create('repeat-request', 'new-A', 'invoice-A'));
  const repeats = await race('same-request', lockInvoice('invoice-A'), [repeated, repeated]);
  const receipts = repeats.map((r) => {
    assert.equal(r.code, 0, r.stderr);
    return JSON.parse(r.stdout.split('\n').findLast((line) => line.startsWith('{')));
  });
  assert.deepEqual(receipts.map((r) => r.replayed).sort(), [false, true]);
  assert.equal(receipts[0].audit_event_id, receipts[1].audit_event_id);
  assert.equal(await ok(`select count(*) from public.entity_audit_log where correlation_id=${literal(id('repeat-request'))}`), '1');
  console.log('PASS: reintentos simultáneos devuelven un único reporte/evento.');

  oneSuccess(await race('confirm-once', lockInvoice('invoice-A'), [1, 2].map((n) =>
    session('accounting-A', resolveReport(`confirm-race-${n}`, 'legacy-A')))), 'PAYMENT_STATE');
  assert.equal(await ok(`select paid_amount from public.invoices where id=${uuid('invoice-A')}`), '120.00');
  assert.equal(await ok(`select count(*) from public.entity_audit_log where entity_id=${uuid('legacy-A')} and event_type='payment_report_confirmed'`), '1');
  console.log('PASS: dos confirmaciones con claves distintas acreditan una sola vez.');

  const revokePortal = `update public.client_users set status='revoked' where auth_user_id=${uuid('portal-B')}`;
  const [revoked] = await race('portal-revocation', revokePortal, [session('portal-B', create('revoke-request', 'new-B', 'invoice-B', 'tenant-B'))]);
  assert.notEqual(revoked.code, 0);
  assert.match(revoked.stderr, /PAYMENT_FORBIDDEN/);
  assert.equal(await ok(`select count(*) from public.payment_reports where id=${uuid('new-B')}`), '0');
  console.log('PASS: una revocación concurrente impide el alta sin efectos.');

  const disableAccountant = `update public.user_tenants set disabled_at=now() where user_id=${uuid('admin-A')}`;
  const [disabled] = await race('financial-revocation', disableAccountant, [session('admin-A', resolveReport('disabled-request', 'new-A', 'rechazado'))]);
  assert.notEqual(disabled.code, 0);
  assert.match(disabled.stderr, /PAYMENT_FORBIDDEN/);
  assert.equal(await ok(`select status from public.payment_reports where id=${uuid('new-A')}`), 'reportado');
  console.log('PASS: revocación financiera concurrente impide la resolución.');

  if (args.includes('--advisors')) {
    const info = JSON.parse(sync('docker', ['inspect', container]))[0];
    const binding = info.NetworkSettings.Ports['5432/tcp'];
    assert.equal(binding.length, 1);
    assert.equal(binding[0].HostIp, '127.0.0.1');
    assert.match(binding[0].HostPort, /^\d+$/);
    const connection = `postgresql://postgres:postgres@127.0.0.1:${binding[0].HostPort}/postgres?sslmode=disable`;
    console.log('Advisors sólo sobre fixture local de esta ejecución:');
    console.log(sync('supabase', ['db', 'advisors', '--db-url', connection, '--type', 'security', '--level', 'warn', '--fail-on', 'error']));
  }
  console.log('PASS: 5 escenarios concurrentes, sin datos ni conexiones de producción.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...active]);
  if (container) {
    const info = JSON.parse(sync('docker', ['inspect', container]))[0];
    assert.equal(info.Id, container);
    assert.equal(info.Config.Labels['codex.payment-test-run'], runId);
    sync('docker', ['stop', '--timeout', '5', container]);
    console.log('Contenedor sintético propio retirado (--rm).');
  }
}

/** SDD-0438. Synthetic PostgreSQL17 regression; no Cloud, env files or npm deps.
 * node scripts/qa/profile-merge-chain.mjs --baseline-ref <full PR26 SHA> --privacy-ref <full PR27 SHA>
 * Real 0361/0445/0446 are read from this checkout; 0447 and RED baseline from explicit immutable refs.
 * Supporting tables come from test0358; this is not a complete schema rebuild.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
function ref(flag) {
  const value = args[args.indexOf(flag) + 1];
  assert(args.includes(flag) && /^[a-f0-9]{40}$/.test(value), `${flag} requires a full immutable commit SHA`);
  return value;
}
const baselineRef = ref('--baseline-ref'), privacyRef = ref('--privacy-ref');
const read = p => readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
function blob(sha, p) {
  try { return execFileSync('git', ['show', `${sha}:${p}`], { cwd: root, encoding: 'utf8' }); }
  catch { throw new Error(`Required immutable blob unavailable: ${sha}:${p}`); }
}
const migration = 'supabase/migrations/0446_portal_profile_functional_remediation.sql';
const current = read(migration), old = blob(baselineRef, migration);
const privacy = blob(privacyRef, 'supabase/migrations/0447_identity_photo_replacement_privacy_gate.sql');
function section(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a);
  assert(a >= 0 && b > a, `Fixture section missing: ${start} / ${end}`);
  return text.slice(a, b);
}
const f35 = read('supabase/tests/0358_merge_clients_exige_rol.test.sql').split('\\ir')[0].replace(/\bbegin;/, '');
const audit = section(read('supabase/tests/0446_portal_profile_functional_remediation.test.sql'), 'create table public.entity_audit_log', '\\ir');
const portal = read('supabase/migrations/0080_portal_cliente.sql').match(/create or replace function public.get_portal_client_id\(\)[\s\S]*?\$\$;/)?.[0];
assert(portal, 'Real portal helper missing');
const role = section(read('supabase/migrations/0351_operario_rpc_exige_rol.sql'), '--', '-- ── 1/4');
const setup = f35 + `
create table auth.users(id uuid primary key);
create schema storage; create table storage.objects(bucket_id text,name text);
alter table clients add column merged_into_client_id uuid references clients(id),add column kommo_contact_id bigint;
alter table client_change_requests add column source text default 'client',add column submitted_at timestamptz default now(),add column reviewed_at timestamptz,add column reviewed_by uuid,add column updated_at timestamptz default now();
` + audit + portal + role + read('supabase/migrations/0361_merge_clients_conserva_kommo_contact.sql') + read('supabase/migrations/0445_portal_profile_edit_limit.sql');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const tenant = id(1), actor = id(9), A = id(101), B = id(102), C = id(103), D = id(104);
const seed = `insert into tenants values('${tenant}'),('${id(2)}');
insert into auth.users values('${actor}');
insert into user_tenants(user_id,tenant_id,role) values('${actor}','${tenant}','admin');
insert into clients(id,tenant_id,markbox,name) values('${A}','${tenant}','TEST-A','SYNTHETIC A'),('${B}','${tenant}','TEST-B','SYNTHETIC B'),('${C}','${tenant}','TEST-C','SYNTHETIC C'),('${D}','${id(2)}','TEST-D','SYNTHETIC D');
insert into client_users(tenant_id,client_id,auth_user_id,status) values('${tenant}','${A}','${actor}','active');`;
const login = `set local role authenticated; select set_config('request.jwt.claim.sub','${actor}',true);`;
const merge = (target, source) => `select merge_clients('${target}','${source}');`;
const photo = (client, edit = id(501)) => `insert into client_profile_edits(id,tenant_id,client_id,edit_kind,status,previous_storage_path,new_storage_path,applied_at) values('${edit}','${tenant}','${client}','identity_photo','applied','SYNTHETIC-old','SYNTHETIC-new',now());`;
const snapshot = "select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]'::jsonb) from client_profile_edits e;";
const conserved = "select coalesce(jsonb_agg(to_jsonb(e)-'client_id' order by id),'[]'::jsonb) from client_profile_edits e;";
const name = `dtd_profile_chain_${process.pid}_${Date.now()}`;
let started = false;
const results = [];
function docker(argv, input) {
  return spawnSync('docker', argv, { input, encoding: 'utf8', maxBuffer: 10e6, timeout: 60000 });
}
function sql(db, text, fail = false) {
  const result = docker(['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db, '--single-transaction', '-f', '-'], `set local statement_timeout='15s';\n${text}`);
  assert.equal(result.error, undefined, result.error?.message);
  if (fail) assert.notEqual(result.status, 0, 'Expected transaction rejection');
  else assert.equal(result.status, 0, result.stderr);
  return { output: result.stdout.trim(), error: result.stderr };
}
function create(db) {
  const result = docker(['exec', name, 'createdb', '-U', 'postgres', db]);
  assert.equal(result.status, 0, result.stderr);
  sql(db, setup + seed);
}
function historical(db) {
  create(db); sql(db, photo(A)); sql(db, login + merge(B, A) + merge(C, B));
}
function checkTerminal(db, target, before) {
  assert.equal(sql(db, conserved).output, before, 'IDs/tenant/status/quota history changed');
  assert.equal(sql(db, `select bool_and(client_id='${target}') from client_profile_edits;`).output, 't');
}
try {
  const result = docker(['run', '--rm', '-d', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
  assert.equal(result.status, 0, result.stderr); started = true;
  let ready = false;
  for (let n = 0; n < 60; n++) { if (docker(['exec', name, 'pg_isready', '-U', 'postgres']).status === 0) { ready = true; break; } Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500); }
  assert(ready, 'PostgreSQL not ready');
  historical('baseline');
  const original = sql('baseline', snapshot).output;
  assert.match(sql('baseline', old, true).error, /merge histórico inválido/);
  assert.equal(sql('baseline', snapshot).output, original);
  results.push('RED: original rejects valid A→B→C atomically');

  historical('fixed');
  const before = sql('fixed', conserved).output;
  sql('fixed', current); checkTerminal('fixed', C, before);
  const backfill = current.match(/do \$backfill_guard\$[\s\S]*?\$backfill_guard\$;/)?.[0];
  assert(backfill, 'Backfill block missing');
  const once = sql('fixed', snapshot).output;
  sql('fixed', backfill); assert.equal(sql('fixed', snapshot).output, once);
  results.push('GREEN: real A→B→C; complete ledger conservation; backfill idempotence');

  create('long_chain'); sql('long_chain', photo(A));
  let previous = A;
  for (let n = 110; n < 126; n++) {
    sql('long_chain', `insert into clients(id,tenant_id,markbox,name) values('${id(n)}','${tenant}','TEST-${n}','SYNTHETIC');`);
    sql('long_chain', login + merge(id(n), previous)); previous = id(n);
  }
  const longBefore = sql('long_chain', conserved).output;
  sql('long_chain', current); checkTerminal('long_chain', previous, longBefore);
  results.push('GREEN: 16-hop real chain');

  create('fan_in'); sql('fan_in', photo(A) + photo(B, id(502)) + photo(C, id(503)));
  sql('fan_in', login + merge(B, A) + merge(B, C));
  const fanBefore = sql('fan_in', conserved).output;
  sql('fan_in', current); checkTerminal('fan_in', B, fanBefore);
  results.push('GREEN: fan-in preserves every ledger row');

  const invalid = {
    self_loop: `update clients set deleted_at=now(),merged_into_client_id=id where id='${A}';`,
    cycle: `update clients set deleted_at=now(),merged_into_client_id=case when id='${A}' then '${B}'::uuid else '${A}'::uuid end where id in ('${A}','${B}');`,
    retired_terminal: `update clients set deleted_at=now(),merged_into_client_id='${B}' where id='${A}'; update clients set deleted_at=now() where id='${B}';`,
    missing_target: `alter table clients drop constraint clients_merged_into_client_id_fkey; update clients set deleted_at=now(),merged_into_client_id='${id(999)}' where id='${A}';`,
    foreign_terminal: `update clients set deleted_at=now(),merged_into_client_id='${D}' where id='${A}';`,
    foreign_middle: `update clients set deleted_at=now(),merged_into_client_id='${D}' where id='${A}'; update clients set deleted_at=now(),merged_into_client_id='${C}' where id='${D}';`,
    foreign_ledger: `update client_profile_edits set tenant_id='${id(2)}'; update clients set deleted_at=now(),merged_into_client_id='${B}' where id='${A}';`,
    active_middle: `update clients set merged_into_client_id='${B}' where id='${A}';`,
    null_tenant: `alter table clients alter column tenant_id drop not null; alter table client_profile_edits alter column tenant_id drop not null; update clients set tenant_id=null where id in ('${A}','${B}'); update client_profile_edits set tenant_id=null; update clients set deleted_at=now(),merged_into_client_id='${B}' where id='${A}';`,
  };
  for (const [db, corrupt] of Object.entries(invalid)) {
    create(db); sql(db, photo(A) + corrupt);
    // Sorted before A: a valid branch is repaired FIRST, then the invalid one
    // aborts. The transaction must undo that successful earlier UPDATE too.
    sql(db, `insert into clients(id,tenant_id,markbox,name,deleted_at,merged_into_client_id) values('${id(100)}','${tenant}','TEST-F','SYNTHETIC',now(),'${C}');` + photo(id(100), id(502)));
    const state = sql(db, snapshot).output;
    const clientState = sql(db, "select jsonb_agg(to_jsonb(c) order by id) from clients c;").output;
    const rpcBefore = sql(db, "select pg_get_functiondef('public.portal_set_identity_photo(text)'::regprocedure);").output;
    const failure = sql(db, current, true);
    assert.match(failure.error, /merge histórico inválido/);
    assert.equal(sql(db, snapshot).output, state, `${db}: partial ledger update`);
    assert.equal(sql(db, "select jsonb_agg(to_jsonb(c) order by id) from clients c;").output, clientState, `${db}: client history changed`);
    assert.equal(sql(db, "select pg_get_functiondef('public.portal_set_identity_photo(text)'::regprocedure);").output, rpcBefore, `${db}: partial RPC replacement`);
    assert.equal(sql(db, "select to_regprocedure('public.portal_profile_edits_follow_client_merge()') is null;").output, 't', `${db}: partial migration DDL`);
    results.push(`GREEN: ${db} rejected; entire transaction rolled back`);
  }

  create('combined'); sql('combined', current);
  sql('combined', `insert into client_change_requests(tenant_id,client_id,status) values('${tenant}','${A}','approved'),('${tenant}','${A}','pending'),('${tenant}','${B}','approved'),('${tenant}','${B}','pending');`);
  const combinationBefore = sql('combined', conserved).output;
  sql('combined', privacy); sql('combined', login + merge(B, A));
  checkTerminal('combined', B, combinationBefore);
  assert.match(sql('combined', login + 'select * from get_my_portal_profile_edit_quota();').output, /\|0$/);
  const snap = sql('combined', snapshot).output;
  sql('combined', login + merge(D, B), true); assert.equal(sql('combined', snapshot).output, snap);
  sql('combined', login + merge(C, B)); checkTerminal('combined', C, combinationBefore);
  sql('combined', 'set local role authenticated; select * from client_profile_edits;', true);
  results.push('GREEN: 0445→0446→0447, real repeated merge, exhausted quota, cross-tenant rollback, ledger ACL');
  console.log(JSON.stringify({ baselineRef, privacyRef, results }, null, 2));
} finally {
  if (started) {
    const stopped = docker(['stop', name]);
    assert.equal(stopped.status, 0, `Could not stop own container ${name}: ${stopped.stderr}`);
  }
}

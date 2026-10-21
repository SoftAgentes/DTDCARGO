#!/usr/bin/env node
/** SDD0578 P1 AUTHORSHIP. Not executed. Run only in Director's local resource turn.
 * A labelled disposable local container is supplied; this runner owns a NEW DB.
 * No Docker creation/download, database URL, network connection, real data or
 * fuse removal. Real psql sessions + observed blocking, never sleep-only races.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
assert.equal(args.length, 2, "Only --container dtd_sdd0578_* is accepted");
assert.equal(args[0], "--container");
const container = args[1];
assert.match(container, /^dtd_sdd0578_[a-zA-Z0-9_-]+$/);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const database = `sdd0578_${randomUUID().replaceAll("-", "")}`;
const sessions = [];
let created = false;
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", windowsHide: true, timeout: 30_000, maxBuffer: 12 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Owned Docker command failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}
function sql(query) {
  return docker(["exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], query);
}
function inline(path) {
  assert(path.startsWith(resolve(root, "supabase") + sep), "Fixture include outside supabase sources");
  return readFileSync(path, "utf8").split(/\r?\n/).map((line) => {
    const match = line.match(/^\\ir\s+([^\s]+)\s*$/);
    if (match) return inline(resolve(dirname(path), match[1]));
    if (/^\\set ON_ERROR_STOP on\s*$/.test(line)) return "";
    assert(!/^\\/.test(line), "Unsupported psql metaorder"); return line;
  }).join("\n");
}
class Session {
  constructor(tag) {
    this.label = tag;
    // PostgreSQL truncates application_name at63 bytes. A long human label+DB
    // would make the observed barrier compare a name the backend cannot hold.
    this.tag = `sdd0578_${sessions.length.toString(36)}_${createHash("sha256").update(tag).digest("hex").slice(0, 12)}`;
    this.output = ""; this.stderr = ""; this.pending = null; this.sequence = 0;
    this.child = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=${this.tag}`, container,
      "psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=0"],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.setEncoding("utf8"); this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => { this.output += chunk; this.consume(); });
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; this.consume(); });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code) => this.fail(new Error(`Owned session exited: ${tag}/${code}`)));
    sessions.push(this);
  }
  fail(error) {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
  }
  consume() {
    if (!this.pending) return;
    const { marker, resolve: finish, timer, stderrOffset } = this.pending;
    const match = this.output.match(new RegExp(`(?:^|\\n)${marker} (true|false) ([A-Z0-9]{5})\\r?\\n`));
    if (!match) return;
    const commandStderr = this.stderr.slice(stderrOffset);
    // stdout/stderr pipes can arrive in either order. A SQLSTATE marker is not
    // evidence that the complete error line is available on the other pipe.
    if (match[1] === "true" && !/ERROR:[^\r\n]*\r?\n/.test(commandStderr)) return;
    const rows = this.output.slice(0, match.index).trim();
    this.output = this.output.slice(match.index + match[0].length);
    clearTimeout(timer); this.pending = null;
    finish({ rows, error: match[1] === "true", state: match[2], stderr: commandStderr });
  }
  query(command) {
    assert.equal(this.pending, null, "Do not overlap commands inside one session");
    const marker = `__SDD578_${++this.sequence}__`;
    return new Promise((resolveQuery, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`Session barrier timeout: ${this.tag}`)), 20_000);
      this.pending = { marker, resolve: resolveQuery, reject, timer, stderrOffset: this.stderr.length };
      this.child.stdin.write(`${command}\n\\echo ${marker} :ERROR :SQLSTATE\n`);
    });
  }
  async ok(command) {
    const result = await this.query(command);
    assert.equal(result.error, false, `${this.tag}: ${result.state}; ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /ERROR:/, "An earlier statement error cannot be hidden by a later successful marker");
    return result.rows;
  }
  async begin(isolation = "read committed") {
    assert(["read committed", "repeatable read"].includes(isolation));
    await this.ok(`begin isolation level ${isolation}; set local lock_timeout='12s'; set local statement_timeout='18s';`);
  }
  async close() {
    if (this.child.exitCode !== null) return;
    this.child.stdin.end("rollback;\n\\quit\n");
    await Promise.race([new Promise((done) => this.child.once("exit", done)), delay(2_000)]);
    if (this.child.exitCode === null) this.child.kill();
  }
}
async function blocked(waiter, blocker) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const result = sql(`select exists(select 1 from pg_stat_activity w join pg_stat_activity b
      on b.pid=any(pg_blocking_pids(w.pid)) where w.datname=current_database() and w.application_name=${literal(waiter.tag)}
      and b.application_name=${literal(blocker.tag)} and w.wait_event_type='Lock');`);
    if (result === "t") return;
    await delay(40); // Polling actual lock evidence, never used as the assertion.
  }
  throw new Error("Expected blocking relation was not observed; race not certified");
}
const id = (label) => sql(`select sdd0578_fixture.id(${literal(label)});`);
const stateSql = (label) => sql(`select value#>>'{}' from sdd0578_fixture.state where label=${literal(label)};`);
const run = (command, actor = "operations-A", role = "authenticated") =>
  `select sdd0578_fixture.run_as(${actor === null ? "null" : literal(actor)},${literal(command)},${literal(role)});`;
// Observe rejection immediately while the other session is at its barrier.
// Return the ORIGINAL promise: its later await still fails and finally cleans up.
const held = (promise) => { void promise.catch(() => {}); return promise; };
const confirm = (containerLabel, revision, ref, receipt, code, extend = false) => sql(`select sdd0578_fixture.confirm_sql(
  ${literal(containerLabel)},${revision},${literal(ref)},jsonb_build_array(sdd0578_fixture.selection(${literal(containerLabel)},'client-A',array[${literal(receipt)}],
  ${code === null ? "null" : literal(code)},${extend})),${literal(extend ? "extend" : "form")});`);

const businessVector = `select jsonb_build_array(
  (select count(*) from public.shipments),(select count(*) from public.consolidation_items),
  (select count(*) from dtd_client_normal.containers),(select count(*) from dtd_client_normal.groups),
  (select count(*) from dtd_client_normal.members),(select count(*) from dtd_client_normal.member_boxes),
  (select count(*) from dtd_client_normal.intentions),(select count(*) from public.expense_alerts),
  (select count(*) from public.shipment_events),(select count(*) from public.warehouse_receipt_events),
  (select count(*) from public.entity_audit_log),(select count(*) from dtd_client_normal.code_reservations),
  (select count(*) from public.dispatch_pods),(select count(*) from dtd_client_normal.pod_intentions),
  (select count(*) from public.consolidation_box_positions),(select count(*) from public.consolidation_plans),
  (select count(*) from public.warehouse_receipts_cn),(select count(*) from public.warehouse_boxes),
  (select count(*) from public.warehouse_receipt_items),(select count(*) from public.shipment_rate_snapshots),
  (select count(*) from dtd_client_normal.contexts),(select count(*) from dtd_client_normal.intakes))::text;`;
function isolatedCase(label) {
  sql(`select sdd0578_fixture.new_container(${literal(label)});`);
  sql(`select sdd0578_fixture.receipt(${literal(`${label}-r1`)});`);
}
function rejected(result, code, allowSerialization = false) {
  assert.equal(result.error, true, `Expected atomic denial ${code}; received ${result.rows}`);
  assert.notEqual(result.state, "40P01", "Deadlock is not the expected controlled outcome");
  assert(!["55P03", "57014", "25P02"].includes(result.state), `Timeout/aborted-command is not proof: ${result.state}`);
  if (allowSerialization && result.state === "40001") return; // Must still rollback/retry and assert final state.
  assert.equal(result.state, "P0001", result.stderr); assert(result.stderr.includes(code), result.stderr);
}
function freshDenial(command, code, actor = "operations-A", role = "authenticated") {
  const result = JSON.parse(sql(`select sdd0578_fixture.attempt(${actor === null ? "null" : literal(actor)},${literal(command)},${literal(role)});`));
  assert.equal(result.state, "P0001"); assert.equal(result.message, code); assert.equal(result.hint, "dtd-client-normal");
}
let authoredCases = 0;
function observed(label) { authoredCases += 1; console.log(`Observed case ${authoredCases}: ${label}`); }

// Every pairing owns independent synthetic rows. Both API roles and service_role
// must cross the code mutex; a fresh retry must return unavailability after a
// stale RR loser is completely rolled back. It is not success merely to get40001.
async function codeRace(mode, cohortFirst, isolation, serial) {
  const label = `code_${mode}_${cohortFirst ? "cohort" : "legacy"}_${serial}`;
  const code = `S-2026-${7100 + serial * 3}`, other = `S-2026-${7101 + serial * 3}`, previous = `S-2026-${7102 + serial * 3}`;
  isolatedCase(label);
  const legacyId = id(`${label}-legacy`), otherId = id(`${label}-other`);
  if (mode === "rename" || mode === "reactivate") sql(`insert into public.shipments(id,tenant_id,code,shipment_service,deleted_at)
    values('${legacyId}','${id("tenant-B")}',${literal(mode === "rename" ? previous : code.toLowerCase())},'consolidado_lcl',
      ${mode === "reactivate" ? "clock_timestamp()" : "null"});`);
  let legacy;
  if (mode === "rename" || mode === "reactivate") legacy = `with changed as(update public.shipments set
    ${mode === "rename" ? `code=${literal(code.toLowerCase())}` : "deleted_at=null"} where id='${legacyId}' returning id) select to_jsonb(count(*)) from changed`;
  else if (mode === "bulk") legacy = `with changed as(insert into public.shipments(id,tenant_id,code,shipment_service)
    select x.id,'${id("tenant-B")}',x.code,'consolidado_lcl'::public.shipment_service from(values
      (0,'${otherId}'::uuid,${literal(other)}),(1,'${legacyId}'::uuid,${literal(code.toLowerCase())})) x(ordinal,id,code)
    order by x.ordinal returning id) select to_jsonb(count(*)) from changed`;
  else legacy = `with changed as(insert into public.shipments(id,tenant_id,code,shipment_service)
    values('${legacyId}','${id("tenant-B")}',${literal(code.toLowerCase())},'consolidado_lcl') returning id) select to_jsonb(count(*)) from changed`;
  // Reactivation must reach its real guard under the existing service API role:
  // the normal authenticated SELECT policy intentionally hides deleted rows.
  const legacyRole = mode === "reactivate" ? "service_role" : "authenticated";
  const form = confirm(label, 0, `${label}-intent`, `${label}-r1`, code);
  const cohort = new Session(`${label}_A`), old = new Session(`${label}_B`);
  try {
    await cohort.begin(isolation); await old.begin(isolation);
    const winner = cohortFirst ? cohort : old, loser = cohortFirst ? old : cohort;
    await loser.ok("select txid_current_snapshot();"); // Explicitly pin RR BEFORE the winner writes.
    await winner.ok(cohortFirst ? run(form) : run(legacy, "operations-B", legacyRole));
    const expectedWinner = await winner.ok(businessVector);
    const pending = held(loser.query(cohortFirst ? run(legacy, "operations-B", legacyRole) : run(form)));
    await blocked(loser, winner); await winner.ok("commit;");
    rejected(await pending, "NORMAL_CODE_UNAVAILABLE", isolation === "repeatable read"); await loser.ok("rollback;");
    assert.equal(sql(businessVector), expectedWinner, "Loser cannot leave an item/member/alert/AUD or a first bulk row");
    freshDenial(cohortFirst ? legacy : form, "NORMAL_CODE_UNAVAILABLE", cohortFirst ? "operations-B" : "operations-A", cohortFirst ? legacyRole : "authenticated");
    assert.equal(sql(businessVector), expectedWinner, "Fresh retry also rolls back the entire failed command");
    assert.equal(sql(`select count(*) from public.shipments where deleted_at is null and upper(code)=${literal(code)};`), "1");
    assert.equal(sql(`select count(*) from dtd_client_normal.code_reservations where code=${literal(code)};`), cohortFirst ? "1" : "0");
    assert.equal(sql(`select count(*) from dtd_client_normal.groups where container_id='${id(label)}';`), cohortFirst ? "1" : "0");
    if (mode === "bulk") {
      assert.equal(sql(`select count(*) from public.shipments where id='${otherId}';`), cohortFirst ? "0" : "1");
      assert.equal(sql(`select count(*) from dtd_client_normal.code_reservations where code=${literal(other)};`), "0", "Legacy bulk never reserves unrelated codes");
    }
    if (cohortFirst && mode === "rename") assert.equal(sql(`select code from public.shipments where id='${legacyId}';`), previous);
    if (cohortFirst && mode === "reactivate") assert.equal(sql(`select deleted_at is not null from public.shipments where id='${legacyId}';`), "t");
    observed(`${mode}/${cohortFirst ? "cohort first" : "legacy first"}/${isolation}: observed wait, atomic denial, fresh retry, one live public code`);
  } finally { await Promise.allSettled([cohort.close(), old.close()]); }
}

async function rosterRace(formFirst, isolation, serial) {
  const label = `roster_${serial}`; isolatedCase(label);
  const receipt = sql(`select id from sdd0578_fixture.state where label=${literal(`${label}-r1`)};`);
  const form = confirm(label, 0, `${label}-intent`, `${label}-r1`, `S-2026-${7600 + serial}`);
  const edit = `with changed as(update public.warehouse_receipts_cn set boxes=2 where id='${receipt}' returning id) select to_jsonb(count(*)) from changed`;
  const forming = new Session(`${label}_form`), editing = new Session(`${label}_edit`);
  try {
    await forming.begin(isolation); await editing.begin(isolation);
    const winner = formFirst ? forming : editing, loser = formFirst ? editing : forming;
    await loser.ok("select txid_current_snapshot();"); await winner.ok(run(formFirst ? form : edit));
    const expectedWinner = await winner.ok(businessVector);
    const pending = held(loser.query(run(formFirst ? edit : form))); await blocked(loser, winner); await winner.ok("commit;");
    rejected(await pending, formFirst ? "NORMAL_GOVERNED" : "NORMAL_INCOMPATIBLE", isolation === "repeatable read"); await loser.ok("rollback;");
    assert.equal(sql(businessVector), expectedWinner);
    assert.equal(sql(`select boxes from public.warehouse_receipts_cn where id='${receipt}';`), formFirst ? "1" : "2");
    assert.equal(sql(`select count(*) from public.warehouse_boxes where receipt_id='${receipt}' and deleted_at is null;`), formFirst ? "1" : "2");
    assert.equal(sql(`select count(*) from dtd_client_normal.member_boxes where receipt_id='${receipt}';`), formFirst ? "1" : "0");
    if (formFirst) freshDenial(edit, "NORMAL_GOVERNED");
    else {
      freshDenial(form, "NORMAL_INCOMPATIBLE");
      // Re-reading the actual new source is required; changing the old intent
      // in place or silently accepting its prior box fingerprint is forbidden.
      const refreshed = confirm(label, 0, `${label}-new-intent`, `${label}-r1`, `S-2026-${7600 + serial}`);
      assert.equal(JSON.parse(sql(run(refreshed))).outcome, "confirmed");
      assert.equal(sql(`select count(*) from dtd_client_normal.member_boxes where receipt_id='${receipt}';`), "2");
    }
    observed(`roster ${formFirst ? "form first" : "edit first"}/${isolation}: receipt lock, exact physical set and explicit refresh`);
  } finally { await Promise.allSettled([forming.close(), editing.close()]); }
}

async function sameReceiptRace(isolation, serial) {
  const label = `same_receipt_${serial}`, other = `${label}_other`; isolatedCase(label);
  sql(`select sdd0578_fixture.new_container(${literal(other)});`);
  const formA = confirm(label, 0, `${label}-intent`, `${label}-r1`, `S-2026-${7700 + serial * 2}`);
  const formB = confirm(other, 0, `${other}-intent`, `${label}-r1`, `S-2026-${7701 + serial * 2}`);
  const a = new Session(`${label}_A`), b = new Session(`${label}_B`);
  try {
    await a.begin(isolation); await b.begin(isolation); await b.ok("select txid_current_snapshot();");
    await a.ok(run(formA)); const expectedWinner = await a.ok(businessVector);
    const pending = held(b.query(run(formB))); await blocked(b, a); await a.ok("commit;");
    rejected(await pending, "NORMAL_INCOMPATIBLE", isolation === "repeatable read"); await b.ok("rollback;");
    assert.equal(sql(businessVector), expectedWinner); freshDenial(formB, "NORMAL_INCOMPATIBLE");
    assert.equal(sql(`select count(*) from dtd_client_normal.members where receipt_id=(select id from sdd0578_fixture.state where label=${literal(`${label}-r1`)});`), "1");
    assert.equal(sql(`select count(*) from dtd_client_normal.groups where container_id='${id(other)}';`), "0");
    observed(`same receipt/two containers/${isolation}: exactly one fixed membership, no loser group`);
  } finally { await Promise.allSettled([a.close(), b.close()]); }
}

async function twoExtensionsRace(isolation, serial) {
  const label = `two_extensions_${serial}`; isolatedCase(label);
  for (const suffix of [2, 3]) sql(`select sdd0578_fixture.receipt(${literal(`${label}-r${suffix}`)});`);
  const initial = confirm(label, 0, `${label}-form`, `${label}-r1`, `S-2026-${7800 + serial}`);
  const historic = JSON.parse(sql(run(initial)));
  const first = confirm(label, 1, `${label}-first`, `${label}-r2`, null, true);
  const second = confirm(label, 1, `${label}-second`, `${label}-r3`, null, true);
  const a = new Session(`${label}_A`), b = new Session(`${label}_B`);
  try {
    await a.begin(isolation); await b.begin(isolation); await b.ok("select txid_current_snapshot();");
    const accepted = JSON.parse(await a.ok(run(first))); const expectedWinner = await a.ok(businessVector);
    const pending = held(b.query(run(second))); await blocked(b, a); await a.ok("commit;");
    rejected(await pending, "NORMAL_CONFLICT", isolation === "repeatable read"); await b.ok("rollback;");
    assert.equal(sql(businessVector), expectedWinner); freshDenial(second, "NORMAL_CONFLICT");
    assert.equal(sql(`select revision from dtd_client_normal.containers where container_id='${id(label)}';`), "2");
    assert.equal(sql(`select count(*) from dtd_client_normal.members m join dtd_client_normal.groups g on g.id=m.group_id where g.container_id='${id(label)}';`), "2");
    assert.equal(sql(`select shipment_id is null from public.warehouse_receipts_cn where id=(select id from sdd0578_fixture.state where label=${literal(`${label}-r3`)});`), "t");
    assert.deepEqual(JSON.parse(sql(run(initial))), { ...historic, outcome: "replay" });
    assert.deepEqual(JSON.parse(sql(run(first))), { ...accepted, outcome: "replay" });
    assert.equal(sql(businessVector), expectedWinner, "Historical replay must not add alert/event/AUD or adopt r3");
    observed(`two extensions at old revision/${isolation}: one delta only, earlier results immutable`);
  } finally { await Promise.allSettled([a.close(), b.close()]); }
}

async function freezeLinkRace(linkFirst, serial) {
  const label = `snapshot_link_${serial}`; isolatedCase(label);
  const form = confirm(label, 0, `${label}-form`, `${label}-r1`, `S-2026-${7900 + serial}`);
  const freeze = sql(`select sdd0578_fixture.freeze_sql(${literal(`${label}-r1`)});`);
  const linking = new Session(`${label}_form`), freezing = new Session(`${label}_freeze`);
  try {
    await linking.begin(); await freezing.begin();
    const winner = linkFirst ? linking : freezing, loser = linkFirst ? freezing : linking;
    const first = JSON.parse(await winner.ok(linkFirst ? run(form) : run(freeze, "admin-A")));
    const pending = held(loser.ok(linkFirst ? run(freeze, "admin-A") : run(form)));
    await blocked(loser, winner); await winner.ok("commit;"); const last = JSON.parse(await pending); await loser.ok("commit;");
    const confirmed = linkFirst ? first : last;
    assert.equal(confirmed.groups[0].rates.missingReceiptIds.length, linkFirst ? 1 : 0);
    assert.equal(sql(`select count(*) from public.shipment_rate_snapshots s join public.warehouse_receipts_cn r on r.id=s.receipt_id
      where r.id=(select id from sdd0578_fixture.state where label=${literal(`${label}-r1`)}) and s.superseded_at is null
      and s.shipment_id=r.shipment_id and s.shipment_id is not null;`), "1");
    assert.equal(sql(`select count(*) from public.shipment_rate_snapshots s where s.receipt_id=(select id from sdd0578_fixture.state
      where label=${literal(`${label}-r1`)}) and s.superseded_at is null and s.shipment_id is null;`), "0");
    const durable = sql(businessVector);
    assert.deepEqual(JSON.parse(sql(run(form))), { ...confirmed, outcome: "replay" }, "Prior observed tariff result remains historical after a later compatible first freeze");
    assert.equal(sql(businessVector), durable);
    observed(`0496 ${linkFirst ? "form first" : "freeze first"}: receipt->snapshot order, exactly one bound live rate, immutable replay`);
  } finally { await Promise.allSettled([linking.close(), freezing.close()]); }
}

async function lotExtensionRace(extensionFirst, serial) {
  const label = `mixed_lot_${serial}`;
  sql(`select sdd0578_fixture.mixed_lot(${literal(label)},${8000 + serial});`);
  const extension = confirm(label, 1, `${label}-extension`, `${label}-r2`, null, true);
  const lot = sql(`select sdd0578_fixture.lot_sql(${literal(label)},1,${literal(`${label}-box1`)},${extensionFirst ? 2 : 1});`);
  const a = new Session(`${label}_extension`), b = new Session(`${label}_lot`);
  const oldMember = sql(`select jsonb_agg(to_jsonb(b) order by b.box_id)::text from dtd_client_normal.member_boxes b
    where receipt_id=(select id from sdd0578_fixture.state where label=${literal(`${label}-r1`)});`);
  try {
    await a.begin(); await b.begin();
    const winner = extensionFirst ? a : b, loser = extensionFirst ? b : a;
    await winner.ok(extensionFirst ? run(extension) : run(lot, null, "service_role"));
    const pending = held(loser.query(extensionFirst ? run(lot, null, "service_role") : run(extension)));
    await blocked(loser, winner); await winner.ok("commit;"); const result = await pending;
    if (extensionFirst) { rejected(result, "NORMAL_CONFLICT"); await loser.ok("rollback;"); }
    else { assert.equal(result.error, false, result.stderr); assert.doesNotMatch(result.stderr, /ERROR:/); await loser.ok("commit;"); }
    assert.equal(sql(`select revision from dtd_client_normal.containers where container_id='${id(label)}';`), "2");
    assert.equal(sql(`select count(*) from dtd_client_normal.groups where container_id='${id(label)}';`), "1");
    assert.equal(sql(`select count(*) from public.consolidation_box_positions where consolidation_id='${id(label)}' and unstuffed_at is null;`), extensionFirst ? "0" : "1");
    assert.equal(sql(`select jsonb_agg(to_jsonb(b) order by b.box_id)::text from dtd_client_normal.member_boxes b
      where receipt_id=(select id from sdd0578_fixture.state where label=${literal(`${label}-r1`)});`), oldMember);
    assert.equal(sql(`select count(*) from public.consolidation_box_positions p where p.box_id=(select id from sdd0578_fixture.state where label=${literal(`${label}-box2`)});`), "0", "Extension never silently stows the new receipt");
    if (extensionFirst) {
      const refreshed = sql(`select sdd0578_fixture.lot_sql(${literal(label)},2,${literal(`${label}-box1`)},2);`);
      assert.equal(JSON.parse(sql(run(refreshed, null, "service_role"))).stuffed, 2);
    }
    observed(`lot/${extensionFirst ? "extension first: old revision rejected then explicit refresh" : "member box first: extension preserves physical history"}`);
  } finally { await Promise.allSettled([a.close(), b.close()]); }
}

async function distinctPodRace(reverse, serial) {
  const label = `distinct_pod_${serial}`, firstOd = `${label}_od${reverse ? 2 : 1}`, lastOd = `${label}_od${reverse ? 1 : 2}`;
  sql(`select sdd0578_fixture.new_container(${literal(label)});`);
  sql(`select sdd0578_fixture.ready(${literal(label)},array['client-A','client-A'],${8200 + serial});`);
  for (const n of [1, 2]) {
    sql(`select sdd0578_fixture.od(${literal(`${label}_od${n}`)},array[${literal(`${label}-r${n}`)}]);`);
    sql(`select sdd0578_fixture.mark('${id(`${label}_od${n}`)}',(select id from sdd0578_fixture.state where label=${literal(`${label}-r${n}`)}));`);
  }
  const firstRef = `${label}-first-pod`, lastRef = `${label}-last-pod`;
  const firstCommand = sql(`select sdd0578_fixture.pod_sql(${literal(firstOd)},${literal(firstRef)});`);
  const lastCommand = sql(`select sdd0578_fixture.pod_sql(${literal(lastOd)},${literal(lastRef)});`);
  const a = new Session(`${label}_first`), b = new Session(`${label}_last`);
  try {
    await a.begin(); await b.begin();
    const first = JSON.parse(await a.ok(run(firstCommand, null, "service_role")));
    assert.equal(first.closed_count, 0); assert.equal(first.normal_pending.length, 1);
    const pending = held(b.ok(run(lastCommand, null, "service_role"))); await blocked(b, a); await a.ok("commit;");
    const last = JSON.parse(await pending); await b.ok("commit;"); assert.equal(last.closed_count, 1);
    const durableVector = sql(businessVector);
    assert.equal(sql(`select count(*) from public.dispatch_pods where od_id in('${id(firstOd)}','${id(lastOd)}');`), "2");
    assert.equal(sql(`select count(*) from public.dispatch_pods where od_id in('${id(firstOd)}','${id(lastOd)}') and public.dispatch_pod_hash_valid(id);`), "2");
    assert.equal(sql(`select count(*) from public.entity_audit_log where event_type='shipment_delivery_manually_confirmed'
      and entity_id=(select shipment_id from dtd_client_normal.groups where container_id='${id(label)}') and payload->>'pod_request_ref'=${literal(lastRef)};`), "1");
    assert.equal(sql(`select count(*) from public.shipment_events where shipment_id=(select shipment_id from dtd_client_normal.groups where container_id='${id(label)}') and status='delivered' and deleted_at is null;`), "1");
    assert.equal(sql(`select status from public.shipments where id=(select shipment_id from dtd_client_normal.groups where container_id='${id(label)}');`), "delivered");
    const replayFirst = JSON.parse(sql(run(firstCommand, null, "service_role")));
    const replayLast = JSON.parse(sql(run(lastCommand, null, "service_role")));
    assert.deepEqual(replayFirst, { ...first, outcome: "replay" }); assert.deepEqual(replayLast, { ...last, outcome: "replay" });
    assert.equal(replayFirst.closed_count, 0, "Historical partial replay never closes a now-complete group");
    assert.equal(sql(businessVector), durableVector, "Distinct POD replays add no capture, shipment event or AUD");
    observed(`two distinct PODs/${reverse ? "OD2 then OD1" : "OD1 then OD2"}: parent wait, both valid captures, last closes once, historical replay`);
  } finally { await Promise.allSettled([a.close(), b.close()]); }
}

function scopeCase(label, { absent = false, enabled = false, warehouseOverride = null } = {}) {
  const warehouseId = warehouseOverride ?? id(`${label}-warehouse`), receiptId = id(`${label}-receipt`), scopeId = id(`${label}-scope`);
  sql(`insert into public.warehouses_cn(id,code,hub_code,hub_name_es,hub_name_cn)
    values('${warehouseId}',${literal(`S578${label}`)},'S578','Hub sintético OFF/ON','合成');`);
  if (!absent) sql(`insert into dtd_client_normal.scopes(id,tenant_id,warehouse_id,enabled,starts_at)
    values('${scopeId}','${id("tenant-A")}','${warehouseId}',${enabled},clock_timestamp());`);
  const input = JSON.stringify({ warehouse_id: warehouseId, client_markbox: "DTD-0001", client_name: "Cliente sintético",
    is_orphan: false, supplier_name: "Proveedor sintético", boxes: 1, total_cbm: 1, total_weight_kg: 100,
    received_at: "2026-10-21", items: [{ description: "Mercancía sintética", quantity: 1 }] });
  const intake = `select public.client_consolidation_intake(${literal(input)}::jsonb)`;
  const legacyBirth = `with created as(insert into public.warehouse_receipts_cn(id,tenant_id,warehouse_id,
    client_markbox,client_name,supplier_name,boxes,total_cbm,total_weight_kg,received_at)
    values('${receiptId}','${id("tenant-A")}','${warehouseId}','DTD-0001','Cliente sintético','Proveedor sintético',1,1,100,'2026-10-21') returning id)
    select to_jsonb(count(*)) from created`;
  return { warehouseId, receiptId, scopeId, intake, legacyBirth };
}
async function offToOnSnapshot(isolation, serial, absent = false) {
  // Future nominal-scope fixture ONLY, not permission to activate a real scope.
  // A successful stale legacy INSERT fails this oracle and is rolled back, never
  // skipped or labelled legacy. a6 remains the immutable prior source cut.
  const label = `off_on_${serial}`, { warehouseId, receiptId, scopeId, intake, legacyBirth } = scopeCase(label, { absent });
  if (absent) {
    assert.equal(sql(`select count(*) from dtd_client_normal.scopes where id='${scopeId}';`), "0");
    assert.equal(sql(`select count(*) from dtd_client_normal.scope_fences where tenant_id='${id("tenant-A")}' and warehouse_id='${warehouseId}';`), "0");
    // An old direct writer need not have called the new preview RPC. This does
    // NOT interpret a missing RPC as OFF; it tests the mandatory DB birth gate.
  } else assert.deepEqual(JSON.parse(sql(run(intake))), { availability: "off" }, "Actual OFF preview, no legacy/header write yet");
  const old = new Session(`${label}_old`), enabling = new Session(`${label}_enable`);
  try {
    await old.begin(isolation); await old.ok("select txid_current_snapshot();");
    await enabling.begin();
    await enabling.ok(absent ? `insert into dtd_client_normal.scopes(id,tenant_id,warehouse_id,enabled,starts_at)
      values('${scopeId}','${id("tenant-A")}','${warehouseId}',true,clock_timestamp());`
      : `update dtd_client_normal.scopes set enabled=true where id='${scopeId}';`);
    await enabling.ok("commit;"); // ON is COMMITTED before the legacy INSERT starts.
    const result = await old.query(run(legacyBirth));
    rejected(result, "NORMAL_GOVERNED", isolation === "repeatable read"); await old.ok("rollback;");
    assert.equal(sql(`select count(*) from public.warehouse_receipts_cn where id='${receiptId}';`), "0");
    assert.equal(sql(`select count(*) from public.warehouse_boxes where receipt_id='${receiptId}';`), "0");
    assert.equal(sql(`select count(*) from dtd_client_normal.receipts where receipt_id='${receiptId}';`), "0");
    const actual = JSON.parse(sql(run(intake))); assert.equal(actual.availability, "ready");
    // Fresh authorized retry uses the real intake; a bare40001 was not enough.
    sql(`update dtd_client_normal.scopes set enabled=false where id='${scopeId}';`);
    assert.deepEqual(JSON.parse(sql(run(intake))), { availability: "off" });
    assert.equal(sql(`select count(*) from dtd_client_normal.receipts where receipt_id='${actual.receiptId}';`), "1", "OFF births never erase prior cohort membership");
    observed(`${absent ? "absent scope/key" : "real OFF preview"} -> committed ON -> old birth/${isolation}: reject/no orphan; fresh intake and later OFF retain cohort`);
  } finally { await Promise.allSettled([old.close(), enabling.close()]); }
}

async function birthBeforeConfig(intakeFirst, isolation, serial) {
  const label = `birth_config_${serial}`, { receiptId, scopeId, intake, legacyBirth } = scopeCase(label, { enabled: intakeFirst });
  const birth = new Session(`${label}_birth`), config = new Session(`${label}_config`);
  const change = `update dtd_client_normal.scopes set enabled=${!intakeFirst} where id='${scopeId}';`;
  try {
    await birth.begin(isolation); await config.begin(isolation); await config.ok("select txid_current_snapshot();");
    const result = JSON.parse(await birth.ok(run(intakeFirst ? intake : legacyBirth)));
    const persistedId = intakeFirst ? result.receiptId : receiptId;
    const before = await birth.ok(`select to_jsonb(r)::text from public.warehouse_receipts_cn r where id='${persistedId}';`);
    const pending = held(config.query(change)); await blocked(config, birth); await birth.ok("commit;");
    const changed = await pending;
    if (isolation === "repeatable read") {
      assert.equal(changed.error, true); assert.equal(changed.state, "40001", changed.stderr); await config.ok("rollback;");
      assert.equal(sql(`select enabled from dtd_client_normal.scopes where id='${scopeId}';`), intakeFirst ? "t" : "f");
      sql(change); // Whole config command retried with a fresh snapshot by fixture owner.
    } else { assert.equal(changed.error, false, changed.stderr); await config.ok("commit;"); }
    assert.equal(sql(`select to_jsonb(r)::text from public.warehouse_receipts_cn r where id='${persistedId}';`), before, "Later toggle cannot renew a birth clock or change its classification");
    assert.equal(sql(`select count(*) from public.warehouse_boxes where receipt_id='${persistedId}' and deleted_at is null;`), "1");
    assert.equal(sql(`select count(*) from dtd_client_normal.receipts where receipt_id='${persistedId}';`), intakeFirst ? "1" : "0");
    const after = JSON.parse(sql(run(intake)));
    if (intakeFirst) assert.deepEqual(after, { availability: "off" });
    else { assert.equal(after.availability, "ready"); assert.equal(sql(`select count(*) from dtd_client_normal.receipts where receipt_id='${after.receiptId}';`), "1"); }
    observed(`${intakeFirst ? "ON intake before OFF" : "OFF legacy birth before ON"}/${isolation}: config waits, whole retry, prior clock/classification fixed`);
  } finally { await Promise.allSettled([birth.close(), config.close()]); }
}

async function startsAfterWait(isolation, serial) {
  const label = `starts_wait_${serial}`, { receiptId, scopeId, intake, legacyBirth } = scopeCase(label);
  const config = new Session(`${label}_config`), old = new Session(`${label}_birth`);
  try {
    await config.begin();
    const startsAt = await config.ok(`update dtd_client_normal.scopes set enabled=true,starts_at=clock_timestamp()+interval '5 seconds'
      where id='${scopeId}' returning starts_at;`);
    await old.begin(isolation);
    if (isolation === "repeatable read") await old.ok("select txid_current_snapshot();");
    const pending = held(old.query(run(legacyBirth))); await blocked(old, config);
    assert.equal(sql(`select clock_timestamp()<${literal(startsAt)}::timestamptz;`), "t", "Fixture must observe the actual fence wait BEFORE eligibility starts");
    const deadline = Date.now() + 8_000;
    while (sql(`select clock_timestamp()>=${literal(startsAt)}::timestamptz;`) !== "t") {
      assert(Date.now() < deadline, "Owned eligibility-clock barrier timed out"); await delay(40);
    }
    await config.ok("commit;");
    rejected(await pending, "NORMAL_GOVERNED", isolation === "repeatable read"); await old.ok("rollback;");
    assert.equal(sql(`select count(*) from public.warehouse_receipts_cn where id='${receiptId}';`), "0");
    const current = JSON.parse(sql(run(intake))); assert.equal(current.availability, "ready");
    assert.equal(sql(`select enrolled_at>=${literal(startsAt)}::timestamptz from dtd_client_normal.receipts where receipt_id='${current.receiptId}';`), "t");
    observed(`starts_at crosses actual observed wait/${isolation}: post-wait eligibility clock, atomic rejection then fresh intake`);
  } finally { await Promise.allSettled([config.close(), old.close()]); }
}

async function receiptTableQueue() {
  // Observe the queued STRONG0449 table lock as well as the scope key. A key
  // taken first by the third intake could otherwise close a three-way cycle
  // with an old INSERT that already owns ROW EXCLUSIVE before its birthtrigger.
  const label = "receipt_table_queue", { warehouseId, intake, legacyBirth, receiptId } = scopeCase(label);
  const operator = id(`${label}-operator`), prealert = id(`${label}-prealert`);
  sql(`insert into public.operario_pins(id,tenant_id,region,role,roles,warehouse_id,display_name)
    values('${operator}','${id("tenant-A")}','cn','bodeguero',array['bodeguero'],'${warehouseId}','Operario sintético de cola');
    insert into public.prealertas(id,tenant_id,code,client_markbox,boxes)
    values('${prealert}','${id("tenant-A")}','CMP-S578-QUEUE','DTD-0001',1);`);
  const boxCode = sql(`select code from public.warehouse_boxes where prealerta_id='${prealert}' and status='esperada';`);
  const receive = `select public.receive_prealerta_boxes_as_operario('${operator}',${literal(boxCode)},array[${literal(boxCode)}])`;
  const old = new Session("table_old"), mobile = new Session("table_mobile0449"), studio = new Session("table_intake");
  try {
    await old.begin(); await mobile.begin(); await studio.begin();
    await old.ok("lock table public.warehouse_receipts_cn in row exclusive mode;");
    const receiving = held(mobile.ok(run(receive, null, "service_role"))); await blocked(mobile, old);
    const preview = held(studio.ok(run(intake))); await blocked(studio, mobile);
    assert.equal(JSON.parse(await old.ok(run(legacyBirth))), 1); await old.ok("commit;");
    const received = JSON.parse(await receiving); await mobile.ok("commit;");
    assert.equal(received.received, 1); assert.deepEqual(JSON.parse(await preview), { availability: "off" }); await studio.ok("commit;");
    assert.equal(sql(`select count(*) from public.warehouse_receipts_cn where warehouse_id='${warehouseId}';`), "2");
    assert.equal(sql(`select count(*) from public.warehouse_boxes where receipt_id='${receiptId}';`), "1");
    assert.equal(sql(`select count(*) from dtd_client_normal.receipts r join public.warehouse_receipts_cn w on w.id=r.receipt_id where w.warehouse_id='${warehouseId}';`), "0");
    observed("old ROW EXCLUSIVE -> queued real0449 SHARE ROW EXCLUSIVE -> Studio intake: table-before-key, no cycle or orphan at OFF");
  } finally { await Promise.allSettled([old.close(), mobile.close(), studio.close()]); }
}

async function scopeForeignKeyInversion(rekey, isolation, serial) {
  const label = `scope_fk_${serial}`, { warehouseId, scopeId, intake } = scopeCase(label, { enabled: true });
  const target = scopeCase(`${label}_target`, { absent: true,
    // Force NEW before OLD in the real UUID ordering: the rejection on the
    // second key must undo the first durable UPSERT as well as the rekey.
    warehouseOverride: rekey ? `00000000-0000-4000-8000-${String(serial).padStart(12, "0")}` : null }).warehouseId;
  if (rekey) assert(target < warehouseId, "Fixture must exercise a second-key rejection after a first-key write");
  const change = rekey ? `update dtd_client_normal.scopes set warehouse_id='${target}' where id='${scopeId}'`
    : `delete from dtd_client_normal.scopes where id='${scopeId}'`;
  const config = new Session(`${label}_config`), birth = new Session(`${label}_birth`);
  try {
    await config.begin(isolation); await birth.begin(isolation);
    // Model the tuple lock already owned by DELETE/unique-key UPDATE before its
    // BEFORE trigger. The real birth then owns the gate/fence and waits for the
    // implicit FK KEY SHARE on precisely this scope, not an invented row lock.
    await config.ok(`select id from dtd_client_normal.scopes where id='${scopeId}' for update;`);
    const pending = held(birth.ok(run(intake))); await blocked(birth, config);
    // Capture the REAL exception's state/message/hint as one stdout JSON value,
    // avoiding an assertion on a HINT line still in the separate stderr pipe.
    const conflict = JSON.parse(await config.ok(`select sdd0578_fixture.attempt(null,${literal(change)},'postgres');`));
    assert.equal(conflict.state, "P0001"); assert.equal(conflict.message, "NORMAL_CONFLICT"); assert.equal(conflict.hint, "dtd-client-normal");
    assert.equal(await config.ok(`select count(*) from dtd_client_normal.scope_fences where tenant_id='${id("tenant-A")}' and warehouse_id='${target}';`), "0",
      "Caught second-key rejection must leave no first-key durable write, even inside the configuring transaction");
    await config.ok("rollback;"); // Releases incompatible tuple lock and ALL partially acquired keys.
    const created = JSON.parse(await pending); await birth.ok("commit;"); assert.equal(created.availability, "ready");
    assert.equal(sql(`select warehouse_id from dtd_client_normal.scopes where id='${scopeId}';`), warehouseId);
    assert.equal(sql(`select count(*) from dtd_client_normal.scope_fences where tenant_id='${id("tenant-A")}' and warehouse_id='${target}';`), "0");
    assert.equal(sql(`select count(*) from dtd_client_normal.receipts where receipt_id='${created.receiptId}' and scope_id='${scopeId}';`), "1");
    if (rekey) freshDenial(`with changed as(${change} returning id) select to_jsonb(count(*)) from changed`, "NORMAL_GOVERNED", null, "postgres");
    else {
      const retried = JSON.parse(sql(`select sdd0578_fixture.attempt(null,${literal(`with changed as(${change} returning id) select to_jsonb(count(*)) from changed`)},'postgres');`));
      assert.equal(retried.state, "23503", "Actual FK RESTRICT preserves a used scope on fresh DELETE retry");
    }
    assert.equal(sql(`select count(*) from dtd_client_normal.receipts where receipt_id='${created.receiptId}' and scope_id='${scopeId}';`), "1");
    observed(`scope ${rekey ? "rekey" : "DELETE"}/${isolation}: actual FK wait, config try-gate rejects atomically, birth proceeds, used identity/FK preserved`);
  } finally { await Promise.allSettled([config.close(), birth.close()]); }
}

async function originalRejectionsBeforeFence() {
  const warehouse = id("warehouse"), scope = id("scope"), operator = id("operario-cn");
  const zeroBoxes = sql(`select sdd0578_fixture.operario_create_sql('operario-cn','${warehouse}',0);`);
  const receivedCode = stateSql("lot-mixed-box1");
  sql(`insert into public.operario_pins(id,tenant_id,region,role,roles,warehouse_id,display_name,active) values
    ('${id("invalid-inactive-cn")}','${id("tenant-A")}','cn','bodeguero',array['bodeguero'],'${warehouse}','Inactivo sintético',false),
    ('${id("invalid-no-warehouse-cn")}','${id("tenant-A")}','cn','bodeguero',array['bodeguero'],null,'Sin almacén sintético',true);`);
  const cases = [
    { name: "0045 invalid boxes", command: zeroBoxes, state: "P0003" },
    { name: "0045 NULL warehouse", command: sql("select sdd0578_fixture.operario_create_sql('operario-cn',null,1);"), state: "23502" },
    { name: "0449 unknown box", command: `select public.receive_prealerta_boxes_as_operario('${operator}','DTD-B-NO-SYNTHETIC-BOX',array['DTD-B-NO-SYNTHETIC-BOX'])`, state: "P0130" },
    { name: "0449 already received retry", command: `select public.receive_prealerta_boxes_as_operario('${operator}',${literal(receivedCode)},array[${literal(receivedCode)}])`, state: "P0137" },
    { name: "0449 NULL/unknown operator", command: "select public.receive_prealerta_boxes_as_operario(null,'DTD-B-NO-SYNTHETIC-BOX',null)", state: "P0001" },
    { name: "0449 inactive operator", command: `select public.receive_prealerta_boxes_as_operario('${id("invalid-inactive-cn")}','DTD-B-NO-SYNTHETIC-BOX',null)`, state: "P0002" },
    { name: "0449 VE operator", command: `select public.receive_prealerta_boxes_as_operario('${id("operario-ve")}','DTD-B-NO-SYNTHETIC-BOX',null)`, state: "P0003" },
    { name: "0449 NULL warehouse", command: `select public.receive_prealerta_boxes_as_operario('${id("invalid-no-warehouse-cn")}','DTD-B-NO-SYNTHETIC-BOX',null)`, state: "P0135" },
  ];
  for (const [n, test] of cases.entries()) {
    const old = new Session(`original_error_${n}`);
    try {
      await old.begin("repeatable read"); await old.ok("select txid_current_snapshot();");
      sql(`update dtd_client_normal.scopes set starts_at=starts_at where id='${scope}';`);
      const version = sql(`select touched from dtd_client_normal.scope_fences where tenant_id='${id("tenant-A")}' and warehouse_id='${warehouse}';`);
      const result = await old.query(run(test.command, null, "service_role"));
      assert.equal(result.error, true); assert.equal(result.state, test.state, result.stderr);
      assert.doesNotMatch(result.stderr, /NORMAL_|40001|deadlock/i, "A scope fence cannot replace an original pre-birth validation");
      await old.ok("rollback;");
      assert.equal(sql(`select touched from dtd_client_normal.scope_fences where tenant_id='${id("tenant-A")}' and warehouse_id='${warehouse}';`), version);
      assert.equal(sql("select (select count(*) from dtd_client_normal.contexts)+(select count(*) from dtd_client_normal.intakes);"), "0");
      observed(`${test.name}: stale RR config does not mask original rejection or retain wrapper context`);
    } finally { await old.close(); }
  }
}

try {
  const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
  assert.equal(labels?.["dtd.sdd0578.disposable"], "true", "Caller must supply an explicitly labelled disposable container");
  const migration = readFileSync(resolve(root, "supabase/migrations/0502_consolidacion_cliente_camino_normal.sql"), "utf8");
  assert(!migration.includes("do $authoring_fuse$"), "P1_FUSE_RETAINED: needs Director local GO and reviewed source removal");
  docker(["exec", container, "createdb", "-U", "postgres", database]); created = true;
  const contract = inline(resolve(root, "supabase/tests/consolidacion_cliente_normal.test.sql"));
  assert.equal(contract.split("-- SDD0578_ASSERTIONS_BEGIN").length, 2);
  sql(contract.split("-- SDD0578_ASSERTIONS_BEGIN")[0] + "\ncommit;");
  console.log(`SDD0578 immutable source SHA256 ${createHash("sha256").update(migration).digest("hex")}; owned DB ${database}`);

  // Same intention: B waits on A's durable intent lock, then replays A's exact
  // historical result. It must not form a second group/item/alert/event.
  const a = new Session("intentA"), b = new Session("intentB");
  await a.begin(); await b.begin();
  const form = stateSql("race-form-sql");
  const fresh = JSON.parse(await a.ok(run(form)));
  const replayPending = held(b.ok(run(form))); await blocked(b, a); await a.ok("commit;");
  const replay = JSON.parse(await replayPending); await b.ok("commit;");
  assert.equal(fresh.outcome, "confirmed"); assert.equal(replay.outcome, "replay");
  assert.deepEqual({ ...fresh, outcome: "replay" }, replay);
  assert.equal(sql(`select count(*) from dtd_client_normal.groups where container_id='${id("race-form")}';`), "1");

  // Global public code uniqueness: a legacy writer in another tenant cannot
  // commit a collision after the cohort writer. No broader legacy reservation.
  const c = new Session("codeA"), d = new Session("codeB"); await c.begin(); await d.begin();
  await c.ok(run(stateSql("race-code-sql")));
  const legacy = `with r as(insert into public.shipments(tenant_id,code,shipment_service)
    values('${id("tenant-B")}','s-2026-5002','consolidado_lcl') returning id) select to_jsonb(count(*)) from r`;
  const legacyPending = held(d.query(run(legacy, "operations-B"))); await blocked(d, c); await c.ok("commit;");
  const collision = await legacyPending; assert.equal(collision.error, true); assert.match(d.stderr, /NORMAL_CODE_UNAVAILABLE/);
  assert.notEqual(collision.state, "40P01"); await d.ok("rollback;");
  assert.equal(sql("select count(*) from public.shipments where upper(code)='S-2026-5002' and deleted_at is null;"), "1");

  // Freeze holds receipt before snapshot. Confirmation waits on that receipt,
  // then binds the one live0496 snapshot. No reverse wait or unbound row.
  const freeze = new Session("freeze"), link = new Session("link"); await freeze.begin(); await link.begin();
  const freezeSql = sql("select sdd0578_fixture.freeze_sql('race-r4');");
  await freeze.ok(run(freezeSql, "admin-A"));
  const linkPending = held(link.ok(run(confirm("second", 0, "race-freeze-link", "race-r4", "S-2026-5004"))));
  await blocked(link, freeze); await freeze.ok("commit;"); await linkPending; await link.ok("commit;");
  assert.equal(sql(`select count(*) from public.shipment_rate_snapshots s join sdd0578_fixture.state f on f.id=s.receipt_id
    join public.warehouse_receipts_cn r on r.id=s.receipt_id where f.label='race-r4' and s.superseded_at is null and s.shipment_id=r.shipment_id;`), "1");

  // Extension invalidates the current plan in the SAME commit. A save built
  // against the old input waits, fails, and cannot publish a stale current plan.
  const oldPlan = sql("select sdd0578_fixture.plan_sql('race-form','old-plan-race');");
  const extension = new Session("extend"), plan = new Session("plan"); await extension.begin(); await plan.begin();
  await extension.ok(run(confirm("race-form", 1, "race-extend", "race-r5", null, true)));
  const planPending = held(plan.query(run(oldPlan))); await blocked(plan, extension); await extension.ok("commit;");
  const stale = await planPending; assert.equal(stale.error, true); assert.match(plan.stderr, /NORMAL_CONFLICT/); await plan.ok("rollback;");
  assert.equal(sql(`select count(*) from public.consolidation_plans where consolidation_id='${id("race-form")}' and is_current and deleted_at is null;`), "0");

  // Seal wins over a competing extension. Both members must be stowed first.
  for (const receipt of ["race-r1", "race-r5"]) sql(run(sql(`select sdd0578_fixture.stow_sql('race-form',${literal(receipt)},2);`), null, "service_role"));
  const seal = new Session("seal"), late = new Session("late"); await seal.begin(); await late.begin();
  await seal.ok(run(sql("select sdd0578_fixture.close_sql('race-form',2,'race-seal');")));
  const latePending = held(late.query(run(confirm("race-form", 2, "late-extension", "race-r6", null, true))));
  await blocked(late, seal); await seal.ok("commit;"); const tooLate = await latePending;
  assert.equal(tooLate.error, true); assert.match(late.stderr, /NORMAL_CONFLICT|NORMAL_SEALED/); await late.ok("rollback;");
  assert.equal(sql("select shipment_id is null from public.warehouse_receipts_cn where id=(select id from sdd0578_fixture.state where label='race-r6');"), "t");

  // Material0184/POD inversion: split already owns package; POD owns parent and
  // waits on that package. The trigger NOWAIT rejects split, freeing its row.
  // This must never rely on PostgreSQL deadlock detection to choose a victim.
  const split = new Session("split"), pod = new Session("pod"); await split.begin(); await pod.begin();
  const packageId = sql("select id from sdd0578_fixture.state where label='pod-fragments-r1';");
  await split.ok(`select package_id from public.dispatch_order_packages where od_id='${id("od-fragments")}' and package_id='${packageId}' for update;`);
  await pod.ok(`select id from public.consolidations where id='${id("pod-fragments")}' for update;`);
  const podPending = held(pod.ok(run(sql("select sdd0578_fixture.pod_sql('od-fragments','race-pod-ref');"), null, "service_role")));
  await blocked(pod, split);
  const splitCommand = `select to_jsonb(public.bodeguero_split_p2('${id("operario-ve")}','${id("od-fragments")}','${packageId}',1,'falta_volumen','Fracción sintética'))`;
  const splitRejected = await split.query(run(splitCommand, null, "service_role"));
  assert.equal(splitRejected.error, true); assert.equal(splitRejected.state, "P0001"); assert.match(split.stderr, /NORMAL_CONFLICT/);
  assert.doesNotMatch(split.stderr, /deadlock|40P01/i); await split.ok("rollback;");
  const partial = JSON.parse(await podPending); await pod.ok("commit;"); assert.equal(partial.closed_count, 0);
  assert.equal(sql(`select count(*) from public.dispatch_orders where parent_od_id='${id("od-fragments")}';`), "0");
  const p2 = JSON.parse(sql(run(splitCommand, null, "service_role"))); assert.match(p2, /^[0-9a-f-]{36}$/);
  assert.equal(sql(`select sdd0578_fixture.attempt(null,${literal(splitCommand)},'service_role')->>'state';`), "P0013");
  assert.equal(sql(`select count(*) from public.dispatch_orders where parent_od_id='${id("od-fragments")}';`), "1");
  assert.equal(sql(`select count(*) from public.dispatch_pods where od_id='${id("od-fragments")}';`), "1");
  observed("base intentions/global code/0496link/stale plan/seal-extension/0184-POD barriers and final states");
  let serial = 0;
  for (const isolation of ["read committed", "repeatable read"]) {
    for (const mode of ["insert", "rename", "reactivate", "bulk"]) {
      for (const cohortFirst of [true, false]) await codeRace(mode, cohortFirst, isolation, ++serial);
    }
  }
  serial = 0;
  for (const isolation of ["read committed", "repeatable read"]) {
    for (const formFirst of [true, false]) await rosterRace(formFirst, isolation, ++serial);
    await sameReceiptRace(isolation, serial); await twoExtensionsRace(isolation, serial);
  }
  await freezeLinkRace(true, 1); await freezeLinkRace(false, 2);
  await lotExtensionRace(true, 1); await lotExtensionRace(false, 2);
  await distinctPodRace(false, 1); await distinctPodRace(true, 2);
  await originalRejectionsBeforeFence();
  await receiptTableQueue();
  serial = 0;
  for (const isolation of ["read committed", "repeatable read"]) {
    await offToOnSnapshot(isolation, ++serial); await offToOnSnapshot(isolation, ++serial, true);
    await birthBeforeConfig(false, isolation, ++serial); await birthBeforeConfig(true, isolation, ++serial);
    await startsAfterWait(isolation, ++serial);
    await scopeForeignKeyInversion(false, isolation, ++serial); await scopeForeignKeyInversion(true, isolation, ++serial);
  }
  console.log(`PASÓ: ${authoredCases} observed case groups with commit/rollback/fresh-retry/final-state oracles. Not E2E, global ERP or production proof.`);
} catch (error) {
  console.error("FALLÓ/NO CERTIFICADO: retain the owned-session evidence; no error, deadlock or timeout is an acceptance result.");
  for (const session of sessions) if (session.stderr.includes("ERROR:") || session.pending) {
    console.error(JSON.stringify({ label: session.label, tag: session.tag, output: session.output, stderr: session.stderr, pending: Boolean(session.pending) }));
  }
  throw error;
} finally {
  await Promise.allSettled(sessions.map((session) => session.close()));
  if (created) {
    sql("select pg_terminate_backend(pid) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid();");
    docker(["exec", container, "dropdb", "-U", "postgres", "--if-exists", database]);
  }
}

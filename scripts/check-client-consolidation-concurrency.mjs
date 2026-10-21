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
    this.tag = `sdd0578_${tag}_${database}`;
    this.output = ""; this.stderr = ""; this.pending = null; this.sequence = 0;
    this.child = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=${this.tag}`, container,
      "psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=0"],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.setEncoding("utf8"); this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => { this.output += chunk; this.consume(); });
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code) => this.fail(new Error(`Owned session exited: ${tag}/${code}`)));
    sessions.push(this);
  }
  fail(error) {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
  }
  consume() {
    if (!this.pending) return;
    const { marker, resolve: finish, timer } = this.pending;
    const match = this.output.match(new RegExp(`(?:^|\\n)${marker} (true|false) ([A-Z0-9]{5})\\r?\\n`));
    if (!match) return;
    const rows = this.output.slice(0, match.index).trim();
    this.output = this.output.slice(match.index + match[0].length);
    clearTimeout(timer); this.pending = null;
    finish({ rows, error: match[1] === "true", state: match[2] });
  }
  query(command) {
    assert.equal(this.pending, null, "Do not overlap commands inside one session");
    const marker = `__SDD578_${++this.sequence}__`;
    return new Promise((resolveQuery, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`Session barrier timeout: ${this.tag}`)), 20_000);
      this.pending = { marker, resolve: resolveQuery, reject, timer };
      this.child.stdin.write(`${command}\n\\echo ${marker} :ERROR :SQLSTATE\n`);
    });
  }
  async ok(command) {
    const result = await this.query(command);
    assert.equal(result.error, false, `${this.tag}: ${result.state}; ${this.stderr}`); return result.rows;
  }
  async begin() { await this.ok("begin; set local lock_timeout='12s'; set local statement_timeout='18s';"); }
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
  const rejected = await split.query(run(splitCommand, null, "service_role"));
  assert.equal(rejected.error, true); assert.equal(rejected.state, "P0001"); assert.match(split.stderr, /NORMAL_CONFLICT/);
  assert.doesNotMatch(split.stderr, /deadlock|40P01/i); await split.ok("rollback;");
  const partial = JSON.parse(await podPending); await pod.ok("commit;"); assert.equal(partial.closed_count, 0);
  assert.equal(sql(`select count(*) from public.dispatch_orders where parent_od_id='${id("od-fragments")}';`), "0");
  const p2 = JSON.parse(sql(run(splitCommand, null, "service_role"))); assert.match(p2, /^[0-9a-f-]{36}$/);
  assert.equal(sql(`select sdd0578_fixture.attempt(null,${literal(splitCommand)},'service_role')->>'state';`), "P0013");
  assert.equal(sql(`select count(*) from public.dispatch_orders where parent_od_id='${id("od-fragments")}';`), "1");
  assert.equal(sql(`select count(*) from public.dispatch_pods where od_id='${id("od-fragments")}';`), "1");
  console.log("PASÓ: observed barriers for intention/replay, global code,0496link, stale plan, seal/extension and0184/POD atomic conflict. Not E2E/production proof.");
} finally {
  await Promise.allSettled(sessions.map((session) => session.close()));
  if (created) {
    sql("select pg_terminate_backend(pid) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid();");
    docker(["exec", container, "dropdb", "-U", "postgres", "--if-exists", database]);
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("../next-number.mjs", import.meta.url));
const moduleUrl = new URL("../next-number.mjs", import.meta.url).href;
const env = { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.invalid", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.invalid" };
function git(cwd, ...args) { return execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
function run(cwd, ...args) { return spawnSync(process.execPath, [script, ...args], { cwd, env, encoding: "utf8" }); }
function call(cwd, code) { return spawnSync(process.execPath, ["--input-type=module", "-e", `import * as n from ${JSON.stringify(moduleUrl)}; ${code}`], { cwd, env, encoding: "utf8" }); }
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dtd-number-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, "remote.git"), repo = path.join(root, "repo");
  git(root, "init", "--bare", remote);
  git(root, "init", "-b", "main", repo);
  fs.writeFileSync(path.join(repo, "base.txt"), "base");
  git(repo, "add", "base.txt"); git(repo, "commit", "-m", "initial");
  git(repo, "remote", "add", "origin", remote); git(repo, "push", "-u", "origin", "main");
  return { root, repo, remote };
}
test("local reservation survives process and preserves HEAD, index, and dirty files", (t) => {
  const { repo } = fixture(t);
  fs.writeFileSync(path.join(repo, "staged.txt"), "staged"); git(repo, "add", "staged.txt");
  fs.writeFileSync(path.join(repo, "base.txt"), "dirty");
  const head = git(repo, "rev-parse", "HEAD"), index = git(repo, "write-tree"), status = git(repo, "status", "--porcelain");
  const first = run(repo, "--reserve", "alpha"); assert.equal(first.status, 0, first.stderr);
  assert.match(git(repo, "show", "refs/heads/codex/sdd-reserve-0001-alpha:docs/specs/0001-alpha/spec.md"), /sdd: "0001"/);
  assert.equal(git(repo, "rev-parse", "HEAD"), head); assert.equal(git(repo, "write-tree"), index); assert.equal(git(repo, "status", "--porcelain"), status);
  assert.match(run(repo, "--no-fetch").stdout, /spec siguiente: 0002/);
  const second = run(repo, "--reserve", "beta"); assert.equal(second.status, 0, second.stderr); assert.match(second.stdout, /reserve-0002-beta/);
});
test("dirty specs and migrations from all linked worktrees count", (t) => {
  const { repo, root } = fixture(t); const other = path.join(root, "other worktree");
  git(repo, "worktree", "add", "-b", "other", other);
  fs.mkdirSync(path.join(other, "docs/specs/0042-dirty"), { recursive: true });
  fs.writeFileSync(path.join(other, "docs/specs/0042-dirty/spec.md"), "draft");
  fs.mkdirSync(path.join(other, "supabase/migrations"), { recursive: true }); fs.writeFileSync(path.join(other, "supabase/migrations/0088_dirty.sql"), "select 1;");
  const result = run(repo, "--reserve", "next"); assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /spec siguiente: 0043; migración siguiente: 0089/);
});
test("local CAS rejects second claimant regardless of slug, with no partial branch", (t) => {
  const { repo } = fixture(t);
  assert.equal(call(repo, "n.prepareReservation('0001', 'alpha')").status, 0);
  assert.notEqual(call(repo, "n.prepareReservation('0001', 'beta')").status, 0);
  assert.equal(git(repo, "for-each-ref", "--format=%(refname)", "refs/heads/codex/sdd-reserve-0001-beta"), "");
});
test("remote create-only lease rejects racing independent clone and never changes main", (t) => {
  const { repo, root, remote } = fixture(t); const other = path.join(root, "clone");
  git(root, "clone", "-b", "main", remote, other);
  const before = git(remote, "rev-parse", "main");
  const a = call(repo, "console.log(JSON.stringify(n.prepareReservation('0001', 'alpha')))");
  const b = call(other, "console.log(JSON.stringify(n.prepareReservation('0001', 'beta')))");
  assert.equal(a.status, 0, a.stderr); assert.equal(b.status, 0, b.stderr);
  const ra = JSON.parse(a.stdout), rb = JSON.parse(b.stdout);
  assert.equal(call(repo, `n.publishReservation(${JSON.stringify(ra)})`).status, 0);
  assert.notEqual(call(other, `n.publishReservation(${JSON.stringify(rb)})`).status, 0);
  assert.equal(git(remote, "rev-parse", "refs/heads/codex/sdd-reserve-0001"), ra.commit);
  assert.equal(git(remote, "rev-parse", "main"), before);
});
test("offline reserve and failed fetch fail closed without refs", (t) => {
  const { repo, root } = fixture(t);
  assert.notEqual(run(repo, "--no-fetch", "--reserve", "alpha").status, 0);
  git(repo, "remote", "set-url", "origin", path.join(root, "missing.git"));
  assert.notEqual(run(repo, "--reserve", "alpha").status, 0);
  assert.equal(git(repo, "for-each-ref", "--format=%(refname)", "refs/heads/codex"), "");
  assert.equal(run(repo, "--no-fetch").status, 0);
});
test("historical cross-ref collisions are reported without blocking reservation", (t) => {
  const { repo } = fixture(t);
  assert.equal(call(repo, "n.prepareReservation('0001', 'old')").status, 0);
  fs.mkdirSync(path.join(repo, "docs/specs/0001-new"), { recursive: true });
  const result = run(repo, "--reserve", "next"); assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /ADVISORY colisión/); assert.match(result.stdout, /reserve-0002-next/);
});
test("simultaneous processes cannot both claim the same local number", async (t) => {
  const { repo } = fixture(t);
  const { spawn } = await import("node:child_process");
  const claim = (slug) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", `import {prepareReservation} from ${JSON.stringify(moduleUrl)}; prepareReservation('0001', '${slug}')`], { cwd: repo, env, stdio: "ignore" });
    child.on("error", reject); child.on("close", resolve);
  });
  const results = await Promise.all([claim("alpha"), claim("beta")]);
  assert.equal(results.filter((code) => code === 0).length, 1);
  assert.equal(git(repo, "for-each-ref", "--format=%(refname)", "refs/heads/codex/sdd-reserve-").split(/\r?\n/).length, 1);
});
test("missing registered worktree makes reservation fail closed", (t) => {
  const { repo, root } = fixture(t), other = path.join(root, "other");
  git(repo, "worktree", "add", "-b", "other", other);
  fs.renameSync(other, path.join(root, "moved"));
  const result = run(repo, "--reserve", "alpha"); assert.notEqual(result.status, 0);
  assert.equal(git(repo, "for-each-ref", "--format=%(refname)", "refs/heads/codex"), "");
});

// ── SDD-0545 · --expect, --number y el aviso de hueco reciente ──────────────
// El 2026-10-16 una sesión vio la 0539 libre, otra reservó la 0540 y la
// reserva siguiente sacó la 0541 sin avisar. Estas pruebas reproducen ese
// orden con worktrees del mismo repositorio, que comparten las refs.
function integrar(repo, ...numeros) {
  for (const n of numeros) {
    fs.mkdirSync(path.join(repo, `docs/specs/${n}-base`), { recursive: true });
    fs.writeFileSync(path.join(repo, `docs/specs/${n}-base/spec.md`), `sdd: "${n}"\n`);
  }
  git(repo, "add", "docs"); git(repo, "commit", "-m", `specs ${numeros.join(" ")}`); git(repo, "push", "origin", "main");
}
const reservas = (repo) => git(repo, "for-each-ref", "--format=%(refname)", "refs/dtd/reservations", "refs/heads/codex").split(/\r?\n/).filter(Boolean).sort();
function correr(cwd, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; }); child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", reject); child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}
test("--expect con el número que toca reserva ese número", (t) => {
  const { repo } = fixture(t); integrar(repo, "0001");
  const r = run(repo, "--reserve", "alfa", "--expect", "0002"); assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(reservas(repo), ["refs/dtd/reservations/0002", "refs/heads/codex/sdd-reserve-0002-alfa"]);
});
test("réplica del 16-10: otra sesión reserva entre el inventario y la reserva; --expect cancela sin lock ni rama", (t) => {
  const { repo, root } = fixture(t); integrar(repo, "0001");
  const otra = path.join(root, "worktree b"); git(repo, "worktree", "add", "-b", "b", otra);
  assert.match(run(repo, "--no-fetch").stdout, /spec siguiente: 0002/);
  assert.equal(run(otra, "--reserve", "otra").status, 0);
  const head = git(repo, "rev-parse", "HEAD"), index = git(repo, "write-tree"), status = git(repo, "status", "--porcelain");
  const r = run(repo, "--reserve", "mia", "--expect", "0002");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Reserva cancelada: esperabas 0002, pero tocaría la 0003\. 0002 ya está ocupada: docs\/specs\/0002-otra/);
  assert.match(r.stderr, /No se creó ninguna ref/);
  assert.deepEqual(reservas(repo), ["refs/dtd/reservations/0002", "refs/heads/codex/sdd-reserve-0002-otra"]);
  assert.equal(git(repo, "rev-parse", "HEAD"), head); assert.equal(git(repo, "write-tree"), index); assert.equal(git(repo, "status", "--porcelain"), status);
});
test("--expect sobre un hueco dice que --reserve no lo usa y quién tiene los números intermedios", (t) => {
  const { repo } = fixture(t); integrar(repo, "0001");
  assert.equal(call(repo, "n.prepareReservation('0003', 'salto')").status, 0);
  const r = run(repo, "--reserve", "mia", "--expect", "0002");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /esperabas 0002, pero tocaría la 0004\. 0002 está libre, pero --reserve toma el máximo \+ 1, no el primer hueco\. 0003: docs\/specs\/0003-salto/);
  assert.deepEqual(reservas(repo), ["refs/dtd/reservations/0003", "refs/heads/codex/sdd-reserve-0003-salto"]);
});
test("--expect mayor que el siguiente también cancela", (t) => {
  const { repo } = fixture(t); integrar(repo, "0001");
  const r = run(repo, "--reserve", "mia", "--expect", "0009");
  assert.notEqual(r.status, 0); assert.match(r.stderr, /0009 es mayor que el siguiente libre/);
  assert.deepEqual(reservas(repo), []);
});
test("dos reservas casi simultáneas desde worktrees distintos con --expect: una gana y la otra no deja nada", async (t) => {
  const { repo, root } = fixture(t); integrar(repo, "0001");
  const otra = path.join(root, "worktree b"); git(repo, "worktree", "add", "-b", "b", otra);
  const [a, b] = await Promise.all([
    correr(repo, "--reserve", "alfa", "--expect", "0002"),
    correr(otra, "--reserve", "beta", "--expect", "0002"),
  ]);
  assert.equal([a, b].filter((r) => r.status === 0).length, 1, `${a.stderr}\n${b.stderr}`);
  const ganadora = a.status === 0 ? "alfa" : "beta";
  assert.deepEqual(reservas(repo), ["refs/dtd/reservations/0002", `refs/heads/codex/sdd-reserve-0002-${ganadora}`]);
});
test("aviso de hueco reciente: sí por encima de lo integrado en origin/main, no por debajo", (t) => {
  const { repo } = fixture(t); integrar(repo, "0001", "0003");
  assert.doesNotMatch(run(repo, "--no-fetch").stderr, /hueco reciente/);
  assert.equal(call(repo, "n.prepareReservation('0005', 'salto')").status, 0);
  const r = run(repo, "--no-fetch");
  assert.match(r.stderr, /ADVISORY hueco reciente: 0004 está libre entre lo integrado en origin\/main \(0003\) y la siguiente \(0006\)\. --reserve no los usa/);
  assert.match(r.stderr, /resérvalo con --number NNNN/);
  assert.doesNotMatch(r.stderr, /0002/);
});
test("--number libre reserva ese número y el hueco deja de avisarse", (t) => {
  const { repo } = fixture(t); integrar(repo, "0001");
  assert.equal(call(repo, "n.prepareReservation('0003', 'salto')").status, 0);
  const r = run(repo, "--reserve", "asignada", "--number", "0002"); assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /reserve-0002-asignada/);
  assert.match(git(repo, "show", "refs/heads/codex/sdd-reserve-0002-asignada:docs/specs/0002-asignada/spec.md"), /sdd: "0002"/);
  assert.doesNotMatch(run(repo, "--no-fetch").stderr, /hueco reciente/);
});
test("--number ocupado por una reserva cancela sin crear nada", (t) => {
  const { repo } = fixture(t); integrar(repo, "0001");
  assert.equal(call(repo, "n.prepareReservation('0002', 'previa')").status, 0);
  const antes = reservas(repo);
  const r = run(repo, "--reserve", "mia", "--number", "0002");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Reserva cancelada: la 0002 ya está ocupada: docs\/specs\/0002-previa .*No se creó ninguna ref/);
  assert.deepEqual(reservas(repo), antes);
});
test("--number ocupado por un archivo sin commit de otro worktree cancela sin crear nada", (t) => {
  const { repo, root } = fixture(t); integrar(repo, "0001");
  const otra = path.join(root, "worktree b"); git(repo, "worktree", "add", "-b", "b", otra);
  assert.equal(call(repo, "n.prepareReservation('0003', 'salto')").status, 0);
  fs.mkdirSync(path.join(otra, "docs/specs/0002-borrador"), { recursive: true });
  fs.writeFileSync(path.join(otra, "docs/specs/0002-borrador/spec.md"), "borrador");
  const r = run(repo, "--reserve", "mia", "--number", "0002");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /la 0002 ya está ocupada: docs\/specs\/0002-borrador \(worktree:/);
  assert.deepEqual(reservas(repo), ["refs/dtd/reservations/0003", "refs/heads/codex/sdd-reserve-0003-salto"]);
});
test("--number por encima del siguiente cancela: dejaría un hueco nuevo", (t) => {
  const { repo } = fixture(t); integrar(repo, "0001");
  const r = run(repo, "--reserve", "mia", "--number", "0005");
  assert.notEqual(r.status, 0); assert.match(r.stderr, /la 0005 es mayor que la siguiente \(0002\) y dejaría un hueco nuevo/);
  assert.deepEqual(reservas(repo), []);
});
test("dos reservas casi simultáneas del mismo --number: una gana y la otra cancela", async (t) => {
  const { repo, root } = fixture(t); integrar(repo, "0001");
  const otra = path.join(root, "worktree b"); git(repo, "worktree", "add", "-b", "b", otra);
  assert.equal(call(repo, "n.prepareReservation('0003', 'salto')").status, 0);
  const [a, b] = await Promise.all([
    correr(repo, "--reserve", "alfa", "--number", "0002"),
    correr(otra, "--reserve", "beta", "--number", "0002"),
  ]);
  assert.equal([a, b].filter((r) => r.status === 0).length, 1, `${a.stderr}\n${b.stderr}`);
  const ganadora = a.status === 0 ? "alfa" : "beta";
  assert.deepEqual(reservas(repo), [
    "refs/dtd/reservations/0002", "refs/dtd/reservations/0003",
    `refs/heads/codex/sdd-reserve-0002-${ganadora}`, "refs/heads/codex/sdd-reserve-0003-salto",
  ]);
});
test("errores de uso: --expect y --number sin --reserve, juntos, mal escritos o repetidos", (t) => {
  const { repo } = fixture(t);
  for (const args of [
    ["--expect", "0001"], ["--number", "0001"],
    ["--reserve", "a", "--expect", "0001", "--number", "0001"],
    ["--reserve", "a", "--expect", "1"], ["--reserve", "a", "--number", "0000"], ["--reserve", "a", "--number"],
    ["--reserve", "a", "--reserve", "b"], ["--reserve", "a", "--expect", "0001", "--expect", "0001"], ["--otra"],
  ]) {
    const r = run(repo, ...args);
    assert.notEqual(r.status, 0, args.join(" ")); assert.match(r.stderr, /^Uso: next-number\.mjs/, args.join(" "));
  }
  assert.deepEqual(reservas(repo), []);
});
test("recentGaps: sólo los libres entre lo integrado y el siguiente", async () => {
  const { recentGaps } = await import(moduleUrl);
  assert.deepEqual(recentGaps(new Set([1, 2, 5, 7]), new Set([1, 2])), [3, 4, 6]);
  assert.deepEqual(recentGaps(new Set([1, 3, 4]), new Set([1, 3, 4])), []);
  assert.deepEqual(recentGaps(new Set([2]), new Set()), [1]);
  assert.deepEqual(recentGaps(new Set([1, 5]), null), []);
});

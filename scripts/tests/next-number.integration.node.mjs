import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
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

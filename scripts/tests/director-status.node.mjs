import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseWorktrees, overlaps, snapshot } from "../director-status.mjs";

test("NUL worktree paths and overlap evidence", () => {
  const result = parseWorktrees("worktree /path with space\0HEAD abc\0branch refs/heads/main\0\0worktree /other\0HEAD def\0detached\0locked owner\0\0");
  assert.equal(result[0].path, "/path with space");
  assert.equal(result[1].detached, true);
  assert.equal(result[1].locked, true);
  assert.deepEqual(overlaps([{ number: 1, files: ["api.ts", "spec.md"] },
    { number: 2, files: ["api.ts"] }, { number: 3, files: null }]),
    [{ prs: [1, 2], files: ["api.ts"] }]);
});
test("offline snapshot preserves index, dirty files and refs; absent remote stays unavailable", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "dtd-status-test-"));
  try {
    const git = (...args) => execFileSync("git", args, { cwd: temp, encoding: "utf8" });
    git("init", "-b", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
    fs.writeFileSync(path.join(temp, "file.txt"), "base"); git("add", "file.txt"); git("commit", "-m", "base");
    fs.mkdirSync(path.join(temp, "docs/specs/9000-pending"), { recursive: true });
    fs.writeFileSync(path.join(temp, "docs/specs/9000-pending/spec.md"), "---\nstatus: draft\n---\n");
    fs.writeFileSync(path.join(temp, "file.txt"), "dirty");
    const before = git("status", "--porcelain");
    const refs = git("show-ref");
    const result = snapshot(temp, { offline: true });
    assert.equal(result.github.available, false);
    assert.equal(result.originMain.available, false);
    assert.equal(result.worktrees[0].specs[0].status, "draft");
    assert.match(result.worktrees[0].status.output, /file.txt/);
    assert.equal(result.worktrees[0].sessionActivity, "NOT_VERIFIED");
    assert.equal(git("status", "--porcelain"), before);
    assert.equal(git("show-ref"), refs);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

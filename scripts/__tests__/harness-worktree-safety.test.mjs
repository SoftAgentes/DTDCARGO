// @vitest-environment node
import { existsSync, readFileSync, renameSync, symlinkSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupWorktreeFixtures, createWorktreeFixture } from "./fixtures/worktree-fixture.mjs";

// Real CLI/Git, synthetic local bare origin only. confirm-idle is an external
// attestation in this contract, not evidence that the helper detects processes.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  cleanupWorktreeFixtures();
});

function expectPreserved(fixture, before, result) {
  const after = fixture.evidence();
  expect({
    rejected: result.status !== 0,
    filesPreserved: JSON.stringify(after.files) === JSON.stringify(before.files),
    mainFilesPreserved: JSON.stringify(after.mainFiles) === JSON.stringify(before.mainFiles),
    indexPreserved: after.index === before.index,
    registrationPreserved: after.registration === before.registration,
    refsPreserved: after.refs === before.refs,
    remoteRefsPreserved: after.remoteRefs === before.remoteRefs,
  }, result.output).toEqual({
    rejected: true, filesPreserved: true, mainFilesPreserved: true, indexPreserved: true, registrationPreserved: true,
    refsPreserved: true, remoteRefsPreserved: true,
  });
}

describe("worktree CLI: preservation before lifecycle mutation", () => {
  it("start uses origin/main, a codex branch without upstream and frozen dependencies", () => {
    const f = createWorktreeFixture();
    const published = f.git(f.main, ["rev-parse", "origin/main"]).out;
    f.commit(f.main, "local-only.txt", "Local main must not become the implicit base.\n");
    const result = f.cli(["start", f.slug]);
    expect(result.status, result.output).toBe(0);
    expect(f.git(f.target, ["branch", "--show-current"]).out).toBe(`codex/${f.slug}`);
    expect(f.git(f.target, ["rev-parse", "HEAD"]).out).toBe(published);
    expect(f.git(f.target, ["rev-parse", "--verify", "@{upstream}"], { allowFailure: true }).status).not.toBe(0);
    expect(f.installation()).toEqual({ args: ["install", "--frozen-lockfile"], cwd: f.target });
  }, 20_000);

  it("start never copies even a synthetic ignored .env.local", () => {
    const f = createWorktreeFixture();
    f.write(f.main, ".env.local", "ONLY_SYNTHETIC_VALUE=not-a-secret\n");
    const result = f.cli(["start", f.slug]);
    expect(result.status, result.output).toBe(0);
    expect(existsSync(path.join(f.target, ".env.local"))).toBe(false);
    expect(existsSync(path.join(f.main, ".env.local"))).toBe(true);
  }, 20_000);

  it("start reports failed installation even when a package marker exists, preserving the lane", () => {
    const f = createWorktreeFixture();
    const result = f.cli(["start", f.slug], { env: { VERIFY_WORKTREE_FIXTURE_INSTALL_EXIT: "23" } });
    expect({ rejected: result.status !== 0, lanePreserved: existsSync(f.target) }, result.output)
      .toEqual({ rejected: true, lanePreserved: true });
    expect(f.git(f.target, ["rev-parse", "--is-inside-work-tree"]).out).toBe("true");
  }, 20_000);

  it("finish preserves an unpublished candidate even without --delete-branch", () => {
    const f = createWorktreeFixture().candidate({ publish: false });
    const before = f.evidence();
    expectPreserved(f, before, f.cli(f.finishArgs()));
  }, 20_000);

  it("dry-run still requires external idle attestation and a published handoff", () => {
    const f = createWorktreeFixture().candidate();
    const before = f.evidence();
    expectPreserved(f, before, f.cli(["finish", f.slug, "--dry-run"]));
  }, 20_000);

  it.each(["codex", "feat"])("finish removes only the safe %s candidate and retains its branch", (prefix) => {
    const f = createWorktreeFixture();
    f.candidate({ branch: `${prefix}/${f.slug}` });
    const before = f.evidence();
    const result = f.cli(f.finishArgs());
    expect(result.status, result.output).toBe(0);
    expect(existsSync(f.target)).toBe(false);
    expect(f.git(f.main, ["worktree", "list", "--porcelain"]).out).not.toContain(f.slug);
    expect(f.git(f.main, ["rev-parse", f.branch]).out).toBe(f.head);
    expect(f.evidence().refs).toBe(before.refs);
    expect(f.evidence().remoteRefs).toBe(before.remoteRefs);
    expect(existsSync(path.join(f.main, f.handoff))).toBe(true);
  }, 20_000);

  it("--delete-branch removes a safely integrated branch, not origin or main refs", () => {
    const f = createWorktreeFixture().candidate();
    const before = f.evidence();
    const result = f.cli(f.finishArgs(["--delete-branch"]));
    expect(result.status, result.output).toBe(0);
    expect(existsSync(f.target)).toBe(false);
    expect(f.git(f.main, ["show-ref", "--verify", `refs/heads/${f.branch}`], { allowFailure: true }).status).not.toBe(0);
    expect(f.git(f.main, ["rev-parse", "main"]).out).toBe(f.head);
    expect(f.git(f.main, ["rev-parse", `origin/${f.branch}`]).out).toBe(f.head);
    expect(f.evidence().remoteRefs).toBe(before.remoteRefs);
  }, 20_000);

  it("valid finish dry-run executes gates without changing files, refs or registration", () => {
    const f = createWorktreeFixture().candidate();
    const before = f.evidence();
    const result = f.cli(f.finishArgs(["--delete-branch", "--dry-run"]));
    expect(result.status, result.output).toBe(0);
    expect(f.evidence()).toEqual(before);
  }, 20_000);

  it("start dry-run creates neither a branch, worktree nor installer output", () => {
    const f = createWorktreeFixture();
    const before = f.evidence();
    const result = f.cli(["start", f.slug, "--dry-run"]);
    expect(result.status, result.output).toBe(0);
    expect(f.evidence()).toEqual(before);
    expect(existsSync(path.join(f.root, "pnpm-log.json"))).toBe(false);
  }, 20_000);

  it("start accepts an explicit base without assigning an upstream", () => {
    const f = createWorktreeFixture();
    const explicit = f.commit(f.main, "explicit.txt", "Requested local base.\n");
    const result = f.cli(["start", f.slug, "--from", "main"]);
    expect(result.status, result.output).toBe(0);
    expect(f.git(f.target, ["rev-parse", "HEAD"]).out).toBe(explicit);
    expect(f.git(f.target, ["rev-parse", "--verify", "@{upstream}"], { allowFailure: true }).status).not.toBe(0);
  }, 20_000);

  const preservationCases = [
    ["candidate is neither published nor integrated", (f) => f.candidate({ publish: false, integrate: false })],
    ["integration exists only in local main", (f) => f.candidate({ publishMain: false })],
    ["published branch is not contained in main", (f) => f.candidate({ integrate: false })],
    ["cached main is stale against live origin/main", (f) => {
      f.candidate();
      const tree = f.git(f.origin, ["rev-parse", "refs/heads/main^{tree}"]).out;
      const remoteHead = f.git(f.origin, ["commit-tree", tree, "-p", f.head, "-m", "Synthetic remote-only main update"]).out;
      f.git(f.origin, ["update-ref", "refs/heads/main", remoteHead]);
    }],
    ["cached branch is stale against its live remote branch", (f) => {
      f.candidate();
      const tree = f.git(f.origin, ["rev-parse", `refs/heads/${f.branch}^{tree}`]).out;
      const remoteHead = f.git(f.origin, ["commit-tree", tree, "-p", f.head, "-m", "Synthetic remote-only branch update"]).out;
      f.git(f.origin, ["update-ref", `refs/heads/${f.branch}`, remoteHead]);
    }],
    ["upstream points to origin/main despite identical SHA", (f) => {
      f.candidate();
      f.git(f.target, ["branch", "--set-upstream-to=origin/main"]);
    }],
    ["upstream points to another origin branch with identical SHA", (f) => {
      f.candidate();
      f.git(f.main, ["push", "origin", `${f.head}:refs/heads/codex/another-lane`]);
      f.git(f.target, ["branch", "--set-upstream-to=origin/codex/another-lane"]);
    }],
    ["branch is published but has no upstream", (f) => {
      f.candidate();
      f.git(f.target, ["branch", "--unset-upstream"]);
    }],
    ["upstream uses another remote even if it serves the same local bare repository", (f) => {
      f.candidate();
      f.git(f.main, ["remote", "add", "backup", f.origin]);
      f.git(f.main, ["fetch", "backup"]);
      f.git(f.target, ["branch", `--set-upstream-to=backup/${f.branch}`]);
    }],
    ["origin is absent and local main cannot be a fallback", (f) => {
      f.candidate();
      f.git(f.main, ["remote", "remove", "origin"]);
    }],
    ["handoff differs from the one preserved in published main", (f) => {
      f.candidate();
      f.commit(f.main, f.handoff, "# Different synthetic handoff\n");
      f.git(f.main, ["push", "origin", "main"]);
    }],
    ["candidate is on an unrelated branch", (f) => f.candidate({ branch: "topic/fixture-lane" })],
    ["candidate is detached", (f) => {
      f.candidate();
      f.git(f.target, ["checkout", "--detach"]);
    }],
    ["Git has explicitly locked the candidate", (f) => {
      f.candidate();
      f.git(f.main, ["worktree", "lock", "--reason", "Synthetic external owner", f.target]);
    }],
    ["main contains a tracked change", (f) => {
      f.candidate();
      f.write(f.main, "README.md", "Uncommitted main evidence.\n");
    }],
    ["principal checkout is not on main", (f) => {
      f.candidate();
      f.git(f.main, ["checkout", "-b", "codex/principal-not-main"]);
    }],
    ["candidate has unstaged work", (f) => {
      f.candidate();
      f.write(f.target, "feature.txt", "Unstaged evidence.\n");
    }],
    ["candidate has staged work", (f) => {
      f.candidate();
      f.write(f.target, "feature.txt", "Staged evidence.\n");
      f.git(f.target, ["add", "--", "feature.txt"]);
    }],
    ["candidate has untracked work", (f) => {
      f.candidate();
      f.write(f.target, "untracked.txt", "Untracked evidence.\n");
    }],
    ["candidate has ignored data", (f) => {
      f.candidate();
      f.write(f.target, "ignored-evidence.txt", "Ignored evidence, not disposable.\n");
    }],
    ["candidate has ignored node_modules (no automatic exemption)", (f) => {
      f.candidate();
      f.write(f.target, "node_modules/synthetic.txt", "Regenerable only with separate authorization.\n");
    }],
    ["assume-unchanged hides a tracked modification", (f) => {
      f.candidate();
      f.git(f.target, ["update-index", "--assume-unchanged", "feature.txt"]);
      f.write(f.target, "feature.txt", "Hidden modification.\n");
    }],
    ["skip-worktree hides a tracked modification", (f) => {
      f.candidate();
      f.git(f.target, ["update-index", "--skip-worktree", "feature.txt"]);
      f.write(f.target, "feature.txt", "Hidden modification.\n");
    }],
    ["candidate contains a real local submodule", (f) => {
      f.candidate();
      f.git(f.target, ["submodule", "add", "--", f.origin, "vendor/synthetic"]);
      f.git(f.target, ["commit", "-m", "Synthetic local submodule"]);
      f.head = f.git(f.target, ["rev-parse", "HEAD"]).out;
      f.git(f.target, ["push", "origin", f.branch]);
      f.git(f.main, ["merge", "--ff-only", f.branch]);
      f.git(f.main, ["push", "origin", "main"]);
    }],
    ["a replacement object forges integration into main", (f) => {
      f.candidate({ integrate: false });
      const mainHead = f.commit(f.main, "unrelated.txt", "Different main work, not the candidate.\n");
      f.git(f.main, ["push", "origin", "main"]);
      const tree = f.git(f.main, ["rev-parse", "main^{tree}"]).out;
      const forged = f.git(f.main, ["commit-tree", tree, "-p", f.head, "-m", "Synthetic false ancestry"]).out;
      f.git(f.main, ["replace", mainHead, forged]);
      expect(f.git(f.main, ["merge-base", "--is-ancestor", f.head, "main"]).status).toBe(0);
      expect(f.git(f.main, ["--no-replace-objects", "merge-base", "--is-ancestor", f.head, "main"], { allowFailure: true }).status).not.toBe(0);
    }],
    ["legacy info/grafts forges integration into main", (f) => {
      f.candidate({ integrate: false });
      const mainHead = f.commit(f.main, "unrelated.txt", "Different main work, not the candidate.\n");
      f.git(f.main, ["push", "origin", "main"]);
      f.write(f.main, ".git/info/grafts", `${mainHead} ${f.head}\n`);
      expect(f.git(f.main, ["merge-base", "--is-ancestor", f.head, "main"]).status).toBe(0);
    }],
  ];
  it.each(preservationCases)("finish refuses and preserves: %s", (_name, prepare) => {
    const f = createWorktreeFixture();
    prepare(f);
    const before = f.evidence();
    expectPreserved(f, before, f.cli(f.finishArgs(["--delete-branch"])));
  }, 20_000);

  it.each([
    ["missing idle attestation", (f) => ["finish", f.slug, "--handoff", f.handoff]],
    ["wrong full HEAD attestation", (f) => ["finish", f.slug, "--confirm-idle", "1".repeat(40), "--handoff", f.handoff]],
    ["abbreviated HEAD attestation", (f) => ["finish", f.slug, "--confirm-idle", f.head.slice(0, 12), "--handoff", f.handoff]],
    ["missing handoff", (f) => ["finish", f.slug, "--confirm-idle", f.head]],
    ["untracked handoff path", (f) => ["finish", f.slug, "--confirm-idle", f.head, "--handoff", "missing.md"]],
  ])("finish rejects %s without changing evidence", (_name, args) => {
    const f = createWorktreeFixture().candidate();
    const before = f.evidence();
    expectPreserved(f, before, f.cli(args(f)));
  }, 20_000);

  it.each(["candidate", "principal-subdirectory"])("finish cannot run from %s", (location) => {
    const f = createWorktreeFixture().candidate();
    const before = f.evidence();
    const cwd = location === "candidate" ? f.target : path.join(f.main, ".agents");
    expectPreserved(f, before, f.cli(f.finishArgs(), { cwd }));
  }, 20_000);

  it("a homonymous unregistered directory is not a removable worktree", () => {
    const f = createWorktreeFixture();
    f.head = f.git(f.main, ["rev-parse", "HEAD"]).out;
    f.write(f.target, "sentinel.txt", "Unregistered synthetic evidence.\n");
    const before = f.evidence();
    expectPreserved(f, before, f.cli(f.finishArgs()));
  }, 20_000);

  it("a prunable registration is preserved, not globally pruned", () => {
    const f = createWorktreeFixture().candidate();
    const moved = path.join(f.root, "preserved-prunable-candidate");
    renameSync(f.target, moved);
    const before = f.evidence();
    expectPreserved(f, before, f.cli(f.finishArgs()));
    expect(readFileSync(path.join(moved, "feature.txt"), "utf8")).toBe("Synthetic completed work.\n");
  }, 20_000);

  it("a junction/symlink at the registered target cannot redirect removal", () => {
    const f = createWorktreeFixture().candidate();
    const moved = path.join(f.root, "preserved-link-target");
    renameSync(f.target, moved);
    symlinkSync(moved, f.target, process.platform === "win32" ? "junction" : "dir");
    const before = f.evidence();
    expectPreserved(f, before, f.cli(f.finishArgs()));
    expect(readFileSync(path.join(moved, "feature.txt"), "utf8")).toBe("Synthetic completed work.\n");
  }, 20_000);

  it("a junction/symlink in the container ancestry cannot redirect removal", () => {
    const f = createWorktreeFixture().candidate();
    const container = path.dirname(f.target);
    const moved = path.join(f.root, "preserved-link-container");
    renameSync(container, moved);
    symlinkSync(moved, container, process.platform === "win32" ? "junction" : "dir");
    const before = f.evidence();
    expectPreserved(f, before, f.cli(f.finishArgs()));
    expect(readFileSync(path.join(moved, f.slug, "feature.txt"), "utf8")).toBe("Synthetic completed work.\n");
  }, 20_000);

  it("Git repository redirection from the environment is rejected before mutation", () => {
    const f = createWorktreeFixture().candidate();
    const before = f.evidence();
    expectPreserved(f, before, f.cli(f.finishArgs(), { env: { GIT_DIR: path.join(f.main, ".git") } }));
  }, 20_000);

  it("GIT_GRAFT_FILE is rejected explicitly even when its external fixture file is empty", () => {
    const f = createWorktreeFixture().candidate();
    const graftFile = path.join(f.root, "external-synthetic-grafts");
    f.write(f.root, "external-synthetic-grafts", "");
    const before = f.evidence();
    const result = f.cli(f.finishArgs(), { env: { GIT_GRAFT_FILE: graftFile } });
    expectPreserved(f, before, result);
    expect(result.output).toMatch(/variables Git.*redirigen/);
    expect(readFileSync(graftFile, "utf8")).toBe("");
  }, 20_000);

  it("list is read-only and does not invoke the installer", () => {
    const f = createWorktreeFixture().candidate();
    const before = f.evidence();
    const result = f.cli(["list"]);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain(f.slug);
    expect(f.evidence()).toEqual(before);
    expect(existsSync(path.join(f.root, "pnpm-log.json"))).toBe(false);
  }, 20_000);

  it("a removal failure after real gates stops without recursive fallback or branch deletion", async () => {
    const f = createWorktreeFixture().candidate();
    const before = f.evidence();
    const { runWorktreeCommand } = await import("../harness-worktree.mjs");
    for (const key of Object.keys(process.env).filter((name) => /^GIT_/i.test(name))) vi.stubEnv(key, undefined);
    for (const [key, value] of Object.entries(f.gitEnvironment)) vi.stubEnv(key, value);
    vi.spyOn(process, "cwd").mockReturnValue(f.main);
    const removeWorktree = vi.fn(() => ({ code: 1, out: "", err: "Synthetic operational removal failure" }));
    expect(() => runWorktreeCommand(f.finishArgs(["--delete-branch"]), { removeWorktree })).toThrow();
    expect(removeWorktree).toHaveBeenCalledExactlyOnceWith(f.main, ["worktree", "remove", "--", f.target]);
    expect(f.evidence()).toEqual(before);
  }, 20_000);
});

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(new URL("../../harness-worktree.mjs", import.meta.url));
const fixtures = [];
const prefix = "dtd-worktree-safety-";
const equalPath = (a, b) => process.platform === "win32"
  ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
  : path.resolve(a) === path.resolve(b);

function assertInside(root, candidate) {
  const relative = path.relative(root, path.resolve(candidate));
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error("Fixture path escaped its own temporary root");
  }
}

function treeSnapshot(directory, excludeRootGit = false) {
  if (!existsSync(directory)) return null;
  const rows = [];
  function visit(current, relative) {
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) {
      rows.push([relative, "link", readlinkSync(current)]);
    } else if (stat.isDirectory()) {
      rows.push([relative, "directory"]);
      for (const name of readdirSync(current).sort()) {
        if (excludeRootGit && relative === "." && name === ".git") continue;
        visit(path.join(current, name), path.join(relative, name));
      }
    } else {
      rows.push([relative, createHash("sha256").update(readFileSync(current)).digest("hex")]);
    }
  }
  visit(directory, ".");
  return rows;
}

/** Only synthetic repositories, file protocol and child-local config; never user's Git config. */
export function createWorktreeFixture() {
  const temporaryParent = realpathSync(tmpdir());
  const root = realpathSync(mkdtempSync(path.join(temporaryParent, prefix)));
  const token = randomUUID();
  const marker = path.join(root, ".fixture-owner");
  writeFileSync(marker, token);
  fixtures.push({ root, token, temporaryParent });
  const main = path.join(root, "DTDCargo");
  const origin = path.join(root, "origin.git");
  const slug = "fixture-lane";
  const target = path.join(root, "DTD-worktrees", slug);
  const handoff = ".agents/handoffs/fixture-close.md";
  const bin = path.join(root, "bin");
  const hooks = path.join(root, "hooks");
  const template = path.join(root, "template");
  for (const directory of [main, bin, hooks, template]) mkdirSync(directory, { recursive: true });
  const globalConfig = path.join(root, "git-global.config");
  writeFileSync(globalConfig, "");
  const environment = {};
  let inheritedPath = "";
  for (const [key, value] of Object.entries(process.env)) {
    if (/^GIT_/i.test(key)) continue;
    if (/^PATH$/i.test(key)) inheritedPath = value ?? "";
    else environment[key] = value;
  }
  Object.assign(environment, {
    PATH: `${bin}${path.delimiter}${inheritedPath}`,
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_SYSTEM: globalConfig, GIT_TEMPLATE_DIR: template,
    GIT_TERMINAL_PROMPT: "0", GIT_ALLOW_PROTOCOL: "file",
    GIT_AUTHOR_NAME: "Synthetic fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Synthetic fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    VERIFY_WORKTREE_FIXTURE_INSTALL_EXIT: "0",
    VERIFY_WORKTREE_FIXTURE_INSTALL_LOG: path.join(root, "pnpm-log.json"),
  });
  const driver = path.join(root, "pnpm-driver.mjs");
  writeFileSync(driver, [
    'import { mkdirSync, writeFileSync } from "node:fs";',
    'import path from "node:path";',
    'writeFileSync(process.env.VERIFY_WORKTREE_FIXTURE_INSTALL_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));',
    'mkdirSync(path.join(process.cwd(), "node_modules/vitest"), { recursive: true });',
    'writeFileSync(path.join(process.cwd(), "node_modules/vitest/vitest.mjs"), "// synthetic package marker\\n");',
    'process.exit(Number(process.env.VERIFY_WORKTREE_FIXTURE_INSTALL_EXIT));',
  ].join("\n"));
  if (process.platform === "win32") {
    writeFileSync(path.join(bin, "pnpm.cmd"), `@"${process.execPath}" "${driver}" %*\r\n@exit /b %errorlevel%\r\n`);
  } else {
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
    const executable = path.join(bin, "pnpm");
    writeFileSync(executable, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(driver)} "$@"\n`);
    chmodSync(executable, 0o700);
  }

  function git(cwd, args, { input, allowFailure = false } = {}) {
    assertInside(root, cwd);
    const result = spawnSync("git", args, {
      cwd, env: environment, input, encoding: "utf8", timeout: 8_000, maxBuffer: 1_048_576,
    });
    if (result.error || result.signal) throw new Error(`Synthetic Git did not finish: ${result.error?.code ?? result.signal}`);
    if (!allowFailure && result.status !== 0) {
      throw new Error(`Synthetic Git ${args.join(" ")} failed: ${result.stderr}`);
    }
    return { status: result.status, out: (result.stdout ?? "").trim(), err: result.stderr ?? "" };
  }
  function write(cwd, relative, content) {
    const destination = path.resolve(cwd, relative);
    assertInside(root, destination);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
  function commit(cwd, relative, content, message = "Synthetic fixture update") {
    write(cwd, relative, content);
    git(cwd, ["add", "--", relative]);
    git(cwd, ["commit", "-m", message]);
    return git(cwd, ["rev-parse", "HEAD"]).out;
  }
  git(root, ["init", "--bare", origin]);
  git(main, ["init", "-b", "main"]);
  for (const cwd of [main, origin]) {
    git(cwd, ["config", "core.hooksPath", hooks]);
    git(cwd, ["config", "commit.gpgsign", "false"]);
    git(cwd, ["config", "core.autocrlf", "false"]);
  }
  write(main, "README.md", "Only synthetic data.\n");
  write(main, ".gitignore", ".env.local\nnode_modules/\nignored-*\n");
  write(main, "package.json", '{"private":true}\n');
  write(main, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  write(main, handoff, "# Synthetic handoff\nAll fixture work is preserved.\n");
  git(main, ["add", "--", "README.md", ".gitignore", "package.json", "pnpm-lock.yaml", handoff]);
  git(main, ["commit", "-m", "Synthetic initial state"]);
  git(main, ["remote", "add", "origin", origin]);
  git(main, ["push", "-u", "origin", "main"]);
  git(origin, ["symbolic-ref", "HEAD", "refs/heads/main"]);

  const fixture = {
    root, main, origin, slug, target, handoff, git, write, commit,
    gitEnvironment: Object.fromEntries(Object.entries(environment).filter(([key]) => /^GIT_/i.test(key))),
    branch: `codex/${slug}`,
    candidate({ branch = `codex/${slug}`, publish = true, integrate = true, publishMain = true } = {}) {
      fixture.branch = branch;
      git(main, ["worktree", "add", "--no-track", "-b", branch, target, "origin/main"]);
      fixture.head = commit(target, "feature.txt", "Synthetic completed work.\n");
      fixture.gitDirectory = git(target, ["rev-parse", "--absolute-git-dir"]).out;
      if (publish) git(target, ["push", "-u", "origin", branch]);
      if (integrate) {
        git(main, ["merge", "--ff-only", branch]);
        if (publishMain) git(main, ["push", "origin", "main"]);
      }
      return fixture;
    },
    finishArgs(extra = []) {
      return ["finish", slug, "--confirm-idle", fixture.head, "--handoff", handoff, ...extra];
    },
    cli(args, { cwd = main, env = {} } = {}) {
      assertInside(root, cwd);
      const result = spawnSync(process.execPath, [helperPath, ...args], {
        cwd, env: { ...environment, ...env }, encoding: "utf8", timeout: 10_000, maxBuffer: 1_048_576,
      });
      if (result.error || result.signal) throw new Error(`Synthetic CLI did not finish: ${result.error?.code ?? result.signal}`);
      return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
    },
    installation() {
      return JSON.parse(readFileSync(environment.VERIFY_WORKTREE_FIXTURE_INSTALL_LOG, "utf8"));
    },
    evidence() {
      return {
        files: treeSnapshot(target),
        mainFiles: treeSnapshot(main, true),
        index: fixture.gitDirectory && existsSync(fixture.gitDirectory)
          ? git(main, [`--git-dir=${fixture.gitDirectory}`, "ls-files", "--stage", "-v"]).out : null,
        registration: git(main, ["worktree", "list", "--porcelain"]).out,
        refs: git(main, ["for-each-ref", "--format=%(refname) %(objectname) %(upstream)"]).out,
        remoteRefs: git(origin, ["for-each-ref", "--format=%(refname) %(objectname)"]).out,
      };
    },
  };
  return fixture;
}

/** Explicitly validate exact owned mkdtemp targets before recursive fixture cleanup. */
export function cleanupWorktreeFixtures() {
  for (const fixture of fixtures.splice(0)) {
    const { root, token, temporaryParent } = fixture;
    if (!path.isAbsolute(root) || !path.basename(root).startsWith(prefix)
      || !equalPath(path.dirname(root), temporaryParent) || lstatSync(root).isSymbolicLink()
      || !equalPath(realpathSync(root), root)
      || readFileSync(path.join(root, ".fixture-owner"), "utf8") !== token) {
      throw new Error("Refusing cleanup: temporary fixture ownership is not valid");
    }
    rmSync(root, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
    if (existsSync(root)) throw new Error("Synthetic fixture was not removed");
  }
}

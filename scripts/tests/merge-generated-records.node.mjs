import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DRIVER_SOURCE = path.join(ROOT, "scripts", "merge-generated-records.mjs");
const INSTALLER_SOURCE = path.join(ROOT, "scripts", "install-merge-drivers.mjs");
const DOCS_SOURCE = path.join(ROOT, "scripts", "build-docs-index.mjs");

function run(cwd, command, args, { expected = [0] } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || !expected.includes(result.status)) {
    throw new Error(
      [
        `${command} ${args.join(" ")} terminó ${result.status}`,
        result.error?.stack,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result;
}

function git(repo, args, options) {
  return run(repo, "git", args, options);
}

function safeRemoveTemp(repo) {
  const resolved = path.resolve(repo);
  const tempPrefix = `${path.resolve(tmpdir())}${path.sep}`;
  if (!resolved.startsWith(tempPrefix)) {
    throw new Error(`rechazo borrar ruta fuera de temp: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true, maxRetries: 3 });
}

function writeSpec(repo, number, title) {
  const dir = path.join(repo, "docs", "specs", `${number}-merge-test`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "spec.md"),
    [
      "---",
      `sdd: \"${number}\"`,
      `title: \"${title}\"`,
      "status: draft",
      "confidencialidad: interno",
      "---",
      "",
      `# ${title}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

function addPending(repo, key, reason) {
  const baselinePath = path.join(repo, "supabase", "migrations-baseline.json");
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  baseline.pendingBelowCutoff[key] = reason;
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

function commitAll(repo, message) {
  git(repo, ["add", ".gitattributes", "docs", "scripts", "supabase"]);
  git(repo, ["commit", "-m", message]);
}

function createRepo(t, { installDriver = true } = {}) {
  const repo = mkdtempSync(path.join(tmpdir(), "dtd-merge-records-"));
  t.after(() => safeRemoveTemp(repo));
  mkdirSync(path.join(repo, "scripts"), { recursive: true });
  mkdirSync(path.join(repo, "docs", "specs"), { recursive: true });
  mkdirSync(path.join(repo, "supabase"), { recursive: true });
  copyFileSync(DRIVER_SOURCE, path.join(repo, "scripts", "merge-generated-records.mjs"));
  copyFileSync(INSTALLER_SOURCE, path.join(repo, "scripts", "install-merge-drivers.mjs"));
  copyFileSync(DOCS_SOURCE, path.join(repo, "scripts", "build-docs-index.mjs"));
  writeFileSync(
    path.join(repo, ".gitattributes"),
    [
      "* text=auto eol=lf",
      "docs/specs/README.md merge=dtd-generated-records",
      "supabase/migrations-baseline.json merge=dtd-generated-records",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(repo, "supabase", "migrations-baseline.json"),
    `${JSON.stringify(
      {
        $doc: ["fixture del baseline"],
        cutoff: 238,
        pendingBelowCutoff: { base_wait: "motivo base" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    path.join(repo, "docs", "specs", "README.md"),
    [
      "# Specs — fixture",
      "",
      "<!-- AUTO-INDEX:START (generado por scripts/build-docs-index.mjs · no editar a mano) -->",
      "<!-- AUTO-INDEX:END -->",
      "",
    ].join("\n"),
    "utf8",
  );
  writeSpec(repo, "0001", "Spec base");

  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "DTD merge test"]);
  git(repo, ["config", "user.email", "merge-test@example.invalid"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  git(repo, ["config", "core.autocrlf", "false"]);
  run(repo, process.execPath, ["scripts/build-docs-index.mjs"]);
  commitAll(repo, "base");
  if (installDriver) {
    run(repo, process.execPath, ["scripts/install-merge-drivers.mjs"]);
    run(repo, process.execPath, ["scripts/install-merge-drivers.mjs", "--check"]);
  }
  return repo;
}

function makeIndependentBranches(repo, options = {}) {
  const {
    currentKey = "9002_branch_current",
    currentReason = "motivo current",
    otherKey = "9001_branch_other",
    otherReason = "motivo other",
  } = options;
  git(repo, ["switch", "-c", "branch-other"]);
  addPending(repo, otherKey, otherReason);
  writeSpec(repo, "0002", "Spec rama other");
  run(repo, process.execPath, ["scripts/build-docs-index.mjs"]);
  commitAll(repo, "rama other");

  git(repo, ["switch", "-c", "branch-current", "main"]);
  addPending(repo, currentKey, currentReason);
  writeSpec(repo, "0003", "Spec rama current");
  run(repo, process.execPath, ["scripts/build-docs-index.mjs"]);
  commitAll(repo, "rama current");
}

test("fusiona dos ramas con claves baseline y specs distintas sin perder entradas", (t) => {
  const repo = createRepo(t);
  makeIndependentBranches(repo);

  const merge = git(repo, ["merge", "--no-edit", "branch-other"]);
  assert.match(merge.stderr, /merge semántico: docs\/specs\/README\.md/u);
  assert.match(merge.stderr, /merge semántico: supabase\/migrations-baseline\.json/u);
  assert.equal(git(repo, ["diff", "--name-only", "--diff-filter=U"]).stdout, "");

  const baseline = JSON.parse(
    readFileSync(path.join(repo, "supabase", "migrations-baseline.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(baseline.pendingBelowCutoff), [
    "base_wait",
    "9001_branch_other",
    "9002_branch_current",
  ]);
  assert.equal(baseline.pendingBelowCutoff["9001_branch_other"], "motivo other");
  assert.equal(baseline.pendingBelowCutoff["9002_branch_current"], "motivo current");

  const indexPath = path.join(repo, "docs", "specs", "README.md");
  const index = readFileSync(indexPath, "utf8");
  assert.match(index, /generado · 3 specs/u);
  assert.ok(index.indexOf("| 0002 |") < index.indexOf("| 0003 |"));
  run(repo, process.execPath, ["scripts/build-docs-index.mjs", "--check"]);

  writeFileSync(indexPath, index.replace(/^\| 0002 \|.*\n/mu, ""), "utf8");
  const stale = run(repo, process.execPath, ["scripts/build-docs-index.mjs", "--check"], {
    expected: [1],
  });
  assert.match(stale.stderr, /índice desactualizado/u);
});

test("falla cerrado si ambos lados cambian la misma clave del baseline", (t) => {
  const repo = createRepo(t);
  makeIndependentBranches(repo, {
    currentKey: "9000_shared",
    currentReason: "texto current",
    otherKey: "9000_shared",
    otherReason: "texto other",
  });

  const merge = git(repo, ["merge", "--no-edit", "branch-other"], { expected: [1] });
  assert.match(merge.stderr, /conflicto real en pendingBelowCutoff\.9000_shared/u);
  const unresolved = git(repo, ["diff", "--name-only", "--diff-filter=U"]).stdout;
  assert.match(unresolved, /supabase\/migrations-baseline\.json/u);
  const current = JSON.parse(
    readFileSync(path.join(repo, "supabase", "migrations-baseline.json"), "utf8"),
  );
  assert.equal(current.pendingBelowCutoff["9000_shared"], "texto current");
});

test("una eliminación unilateral no puede borrar una entrada del baseline", (t) => {
  const repo = createRepo(t);

  git(repo, ["switch", "-c", "branch-other"]);
  addPending(repo, "9001_branch_other", "motivo other");
  commitAll(repo, "rama other agrega");

  git(repo, ["switch", "-c", "branch-current", "main"]);
  const baselinePath = path.join(repo, "supabase", "migrations-baseline.json");
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  delete baseline.pendingBelowCutoff.base_wait;
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  commitAll(repo, "rama current borra");

  git(repo, ["merge", "--no-edit", "branch-other"]);
  const merged = JSON.parse(readFileSync(baselinePath, "utf8"));
  assert.equal(merged.pendingBelowCutoff.base_wait, "motivo base");
  assert.equal(merged.pendingBelowCutoff["9001_branch_other"], "motivo other");
});

test("sin instalar el driver el merge bloquea y no inventa una unión textual", (t) => {
  const repo = createRepo(t, { installDriver: false });
  makeIndependentBranches(repo);

  const merge = git(repo, ["merge", "--no-edit", "branch-other"], { expected: [1] });
  assert.match(merge.stdout + merge.stderr, /CONFLICT/u);
  const unresolved = git(repo, ["diff", "--name-only", "--diff-filter=U"]).stdout;
  assert.match(unresolved, /supabase\/migrations-baseline\.json/u);
});

test("rechaza JSON con claves duplicadas antes de sobrescribir %A", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "dtd-merge-duplicate-"));
  t.after(() => safeRemoveTemp(dir));
  const base = path.join(dir, "base.json");
  const current = path.join(dir, "current.json");
  const other = path.join(dir, "other.json");
  const valid = '{"cutoff":238,"pendingBelowCutoff":{"base":"motivo"}}\n';
  const duplicate =
    '{"cutoff":238,"pendingBelowCutoff":{"repetida":"uno","repetida":"dos"}}\n';
  writeFileSync(base, valid, "utf8");
  writeFileSync(current, duplicate, "utf8");
  writeFileSync(other, valid, "utf8");

  const result = run(
    ROOT,
    process.execPath,
    [DRIVER_SOURCE, base, current, other, "supabase/migrations-baseline.json"],
    { expected: [1] },
  );
  assert.match(result.stderr, /clave duplicada 'repetida'/u);
  assert.equal(readFileSync(current, "utf8"), duplicate);
});

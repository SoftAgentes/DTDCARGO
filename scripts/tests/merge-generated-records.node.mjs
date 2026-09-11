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
const DECLARATIONS_PATH = "supabase/pending-migration-symbol-declarations.json";

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
      `${DECLARATIONS_PATH} merge=dtd-generated-records`,
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
    path.join(repo, DECLARATIONS_PATH),
    serializeDeclarations({
      schemaVersion: 1,
      $doc: ["fixture de declaraciones"],
      degradations: [declaration("base-retirable"), declaration("base-vigente")],
    }),
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

function declaration(id, { site = `lib/${id}.ts:10`, degradation = `degrada ${id}` } = {}) {
  const symbol = `rpc_${id.replaceAll("-", "_")}`;
  return {
    id,
    primarySymbol: symbol,
    migration: `9000_${symbol}`,
    symbols: [{ kind: "function", name: symbol, callSites: [site] }],
    evidence: [{ site, contains: "if (error)", degradation }],
  };
}

function serializeDeclarations(declarations) {
  return `${JSON.stringify(declarations, null, 2)}\n`;
}

function readDeclarations(repo) {
  return JSON.parse(readFileSync(path.join(repo, DECLARATIONS_PATH), "utf8"));
}

function declarationIds(declarations) {
  return declarations.degradations.map((entry) => entry.id);
}

function updateDeclarations(repo, update) {
  const declarations = readDeclarations(repo);
  update(declarations);
  writeFileSync(
    path.join(repo, DECLARATIONS_PATH),
    serializeDeclarations(declarations),
    "utf8",
  );
}

function makeDeclarationBranches(repo, { current, other }) {
  git(repo, ["switch", "-c", "branch-other"]);
  updateDeclarations(repo, other);
  commitAll(repo, "rama other");

  git(repo, ["switch", "-c", "branch-current", "main"]);
  updateDeclarations(repo, current);
  commitAll(repo, "rama current");
}

// Fusiona other en current y, desde los mismos dos commits, current en other.
function mergeDeclarationsBothWays(repo) {
  const currentTip = git(repo, ["rev-parse", "branch-current"]).stdout.trim();
  const forward = git(repo, ["merge", "--no-edit", "branch-other"]);
  const forwardText = readFileSync(path.join(repo, DECLARATIONS_PATH), "utf8");

  git(repo, ["switch", "-c", "reverse", "branch-other"]);
  const reverse = git(repo, ["merge", "--no-edit", currentTip]);
  const reverseText = readFileSync(path.join(repo, DECLARATIONS_PATH), "utf8");

  for (const merge of [forward, reverse]) {
    assert.match(
      merge.stderr,
      /merge semántico: supabase\/pending-migration-symbol-declarations\.json/u,
    );
  }
  return { merged: JSON.parse(forwardText), forwardText, reverseText };
}

function mergeExpectingDeclarationConflict(repo, message) {
  const declarationsFile = path.join(repo, DECLARATIONS_PATH);
  const before = readFileSync(declarationsFile, "utf8");
  const merge = git(repo, ["merge", "--no-edit", "branch-other"], { expected: [1] });
  assert.match(merge.stderr, message);
  const unresolved = git(repo, ["diff", "--name-only", "--diff-filter=U"]).stdout;
  assert.match(unresolved, /supabase\/pending-migration-symbol-declarations\.json/u);
  // Al rechazar, el driver no toca %A: queda la versión actual, sin unión parcial.
  assert.equal(readFileSync(declarationsFile, "utf8"), before);
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

test("el .gitattributes del repositorio asigna los tres registros al driver", () => {
  const paths = ["docs/specs/README.md", "supabase/migrations-baseline.json", DECLARATIONS_PATH];
  const attributes = git(ROOT, ["check-attr", "merge", "--", ...paths]).stdout;
  for (const repoPath of paths) {
    assert.ok(
      attributes.includes(`${repoPath}: merge: dtd-generated-records`),
      `${repoPath} no está asignado a dtd-generated-records:\n${attributes}`,
    );
  }
});

test("une degradations por id sin perder entradas y con el mismo orden en ambos sentidos", (t) => {
  const repo = createRepo(t);
  const sameInBoth = declaration("l07-agregada-igual-en-ambas");
  makeDeclarationBranches(repo, {
    other: (value) => value.degradations.push(declaration("l06-rama-other"), sameInBoth),
    current: (value) => value.degradations.push(declaration("l05-rama-current"), sameInBoth),
  });

  const { merged, forwardText, reverseText } = mergeDeclarationsBothWays(repo);
  assert.equal(merged.schemaVersion, 1);
  assert.deepEqual(merged.$doc, ["fixture de declaraciones"]);
  assert.deepEqual(declarationIds(merged), [
    "base-retirable",
    "base-vigente",
    "l05-rama-current",
    "l06-rama-other",
    "l07-agregada-igual-en-ambas",
  ]);
  assert.deepEqual(merged.degradations[2], declaration("l05-rama-current"));
  assert.deepEqual(merged.degradations[3], declaration("l06-rama-other"));
  assert.equal(reverseText, forwardText);
});

test("respeta el retiro de una declaración según la base y no la resucita", (t) => {
  const repo = createRepo(t);
  makeDeclarationBranches(repo, {
    other: (value) => value.degradations.push(declaration("l05-rama-other")),
    // Su migración ya se aplicó: esta rama retira la declaración.
    current: (value) => {
      value.degradations = value.degradations.filter((entry) => entry.id !== "base-retirable");
    },
  });

  // El sentido inverso cubre el retiro hecho por la rama entrante.
  const { merged, forwardText, reverseText } = mergeDeclarationsBothWays(repo);
  assert.deepEqual(declarationIds(merged), ["base-vigente", "l05-rama-other"]);
  assert.equal(reverseText, forwardText);
});

test("toma la edición unilateral de una declaración vigente según la base", (t) => {
  const repo = createRepo(t);
  const edited = declaration("base-vigente", { site: "lib/base-vigente.ts:42" });
  makeDeclarationBranches(repo, {
    other: (value) => value.degradations.push(declaration("l05-rama-other")),
    current: (value) => {
      value.degradations = value.degradations.map((entry) =>
        entry.id === "base-vigente" ? edited : entry,
      );
    },
  });

  const { merged, forwardText, reverseText } = mergeDeclarationsBothWays(repo);
  assert.deepEqual(declarationIds(merged), ["base-retirable", "base-vigente", "l05-rama-other"]);
  assert.deepEqual(merged.degradations[1], edited);
  assert.equal(reverseText, forwardText);
});

test("falla cerrado si $doc difiere entre las ramas aunque solo una lo cambie", (t) => {
  const repo = createRepo(t);
  makeDeclarationBranches(repo, {
    other: (value) => value.degradations.push(declaration("l06-rama-other")),
    current: (value) => {
      value.$doc.push("nota agregada solo en current");
      value.degradations.push(declaration("l05-rama-current"));
    },
  });

  mergeExpectingDeclarationConflict(
    repo,
    /conflicto real en declaraciones\.\$doc: difiere entre las ramas/u,
  );
});

test("falla cerrado si ambas ramas agregan el mismo id con contenido distinto", (t) => {
  const repo = createRepo(t);
  makeDeclarationBranches(repo, {
    other: (value) =>
      value.degradations.push(declaration("l07-mismo-id", { degradation: "texto other" })),
    current: (value) =>
      value.degradations.push(declaration("l07-mismo-id", { degradation: "texto current" })),
  });

  mergeExpectingDeclarationConflict(
    repo,
    /conflicto real en degradations\[id=l07-mismo-id\]: ambas ramas agregan el mismo id con contenido distinto/u,
  );
});

test("falla cerrado si una rama retira una declaración que la otra edita", (t) => {
  const repo = createRepo(t);
  makeDeclarationBranches(repo, {
    other: (value) => {
      const entry = value.degradations.find((candidate) => candidate.id === "base-retirable");
      entry.symbols[0].callSites = ["lib/base-retirable.ts:99"];
    },
    current: (value) => {
      value.degradations = value.degradations.filter((entry) => entry.id !== "base-retirable");
    },
  });

  mergeExpectingDeclarationConflict(
    repo,
    /conflicto real en degradations\[id=base-retirable\]: borrado contra edición/u,
  );
});

test("falla cerrado si ambas ramas editan la misma declaración de forma distinta", (t) => {
  const repo = createRepo(t);
  const editEvidence = (text) => (value) => {
    const entry = value.degradations.find((candidate) => candidate.id === "base-vigente");
    entry.evidence[0].degradation = text;
  };
  makeDeclarationBranches(repo, {
    other: editEvidence("texto other"),
    current: editEvidence("texto current"),
  });

  mergeExpectingDeclarationConflict(
    repo,
    /conflicto real en degradations\[id=base-vigente\]: ambas ramas editaron la declaración de forma distinta/u,
  );
});

test("rechaza ids repetidos, claves duplicadas y schemaVersion desconocido sin tocar %A", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "dtd-merge-declarations-"));
  t.after(() => safeRemoveTemp(dir));
  const valid = {
    schemaVersion: 1,
    $doc: ["fixture de declaraciones"],
    degradations: [declaration("base-vigente")],
  };
  const cases = [
    [
      serializeDeclarations({
        ...valid,
        degradations: [declaration("repetida"), declaration("repetida", { degradation: "otra" })],
      }),
      /declaraciones actual: id duplicado 'repetida'/u,
    ],
    [
      '{"schemaVersion":1,"$doc":[],"degradations":[{"id":"uno","id":"dos"}]}\n',
      /declaraciones actual: clave duplicada 'id'/u,
    ],
    [
      serializeDeclarations({ ...valid, schemaVersion: 2 }),
      /declaraciones actual: schemaVersion 2 no soportado/u,
    ],
  ];

  for (const [currentText, message] of cases) {
    const base = path.join(dir, "base.json");
    const current = path.join(dir, "current.json");
    const other = path.join(dir, "other.json");
    writeFileSync(base, serializeDeclarations(valid), "utf8");
    writeFileSync(current, currentText, "utf8");
    writeFileSync(other, serializeDeclarations(valid), "utf8");

    const result = run(
      ROOT,
      process.execPath,
      [DRIVER_SOURCE, base, current, other, DECLARATIONS_PATH],
      { expected: [1] },
    );
    assert.match(result.stderr, message);
    assert.equal(readFileSync(current, "utf8"), currentText);
  }
});

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

const PENDING_BASE = [
  ["0409_bank_rbac", "espera 0409"],
  ["0418_academia", "espera 0418"],
  ["0430_perfil", "espera 0430"],
];

function baselineFile(repo) {
  return path.join(repo, "supabase", "migrations-baseline.json");
}

// Sin ref lee el árbol de trabajo; con ref, la versión confirmada.
function readBaseline(repo, ref) {
  const text = ref
    ? git(repo, ["show", `${ref}:supabase/migrations-baseline.json`]).stdout
    : readFileSync(baselineFile(repo), "utf8");
  return JSON.parse(text);
}

function serializeBaseline(baseline) {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

function setPending(repo, entries) {
  const baseline = readBaseline(repo);
  baseline.pendingBelowCutoff = Object.fromEntries(entries);
  writeFileSync(baselineFile(repo), serializeBaseline(baseline), "utf8");
}

const without = (entries, key) => entries.filter(([name]) => name !== key);
const withReason = (entries, key, reason) =>
  entries.map(([name, value]) => [name, name === key ? reason : value]);

// main y la rama parten de la misma base con tres esperas. HEAD queda en la
// rama, lista para `git merge main`: el `git merge origin/main` con el que un
// Worker actualiza su rama y el Director valida la cabeza de una PR.
function makeMainAndBranch(repo, { main, branch }) {
  setPending(repo, PENDING_BASE);
  commitAll(repo, "base con esperas");
  git(repo, ["switch", "-c", "branch"]);
  setPending(repo, branch(PENDING_BASE));
  commitAll(repo, "rama");
  git(repo, ["switch", "main"]);
  setPending(repo, main(PENDING_BASE));
  commitAll(repo, "main avanza");
  git(repo, ["switch", "branch"]);
}

test("el retiro de main gana si la rama conserva la espera y queda main más la rama", (t) => {
  const repo = createRepo(t);
  makeMainAndBranch(repo, {
    // main registra la aplicación de 0409 (como #85) e integra dos esperas en el
    // orden en que se fusionaron, que no es el numérico.
    main: (entries) => [
      ...without(entries, "0409_bank_rbac"),
      ["0433_realtime", "espera 0433"],
      ["0408_mailing", "espera 0408"],
    ],
    // La rama nació antes del retiro y solo agrega sus esperas.
    branch: (entries) => [
      ...entries,
      ["0436_rama", "espera 0436"],
      ["0435_rama", "espera 0435"],
    ],
  });
  const branchTip = git(repo, ["rev-parse", "HEAD"]).stdout.trim();

  const merge = git(repo, ["merge", "--no-edit", "main"]);
  assert.match(merge.stderr, /merge semántico: supabase\/migrations-baseline\.json/u);
  assert.equal(git(repo, ["diff", "--name-only", "--diff-filter=U"]).stdout, "");
  const merged = readBaseline(repo);
  assert.deepEqual(Object.keys(merged.pendingBelowCutoff), [
    "0418_academia",
    "0430_perfil",
    "0433_realtime",
    "0408_mailing",
    "0436_rama",
    "0435_rama",
  ]);
  // Texto exacto de main más las adiciones de la rama, en el orden de la rama:
  // el mismo control semántico que hace el Director antes de integrar.
  const expected = readBaseline(repo, "main");
  expected.pendingBelowCutoff["0436_rama"] = "espera 0436";
  expected.pendingBelowCutoff["0435_rama"] = "espera 0435";
  assert.equal(readFileSync(baselineFile(repo), "utf8"), serializeBaseline(expected));

  // En sentido inverso cambia el orden, pero no las claves ni los motivos.
  git(repo, ["switch", "-c", "reverse", "main"]);
  git(repo, ["merge", "--no-edit", branchTip]);
  const sortedEntries = (baseline) => Object.entries(baseline.pendingBelowCutoff).sort();
  assert.deepEqual(sortedEntries(readBaseline(repo)), sortedEntries(merged));
});

test("una rama de registro retira su espera aunque main haya cambiado otras", (t) => {
  const repo = createRepo(t);
  makeMainAndBranch(repo, {
    // main ya registró 0409, revisó el motivo de 0430 e integró 0450.
    main: (entries) => [
      ...withReason(without(entries, "0409_bank_rbac"), "0430_perfil", "espera 0430 revisada"),
      ["0450_aliado", "espera 0450"],
    ],
    // La rama registra 0418 (como #92) y también 0409: los dos retiros de 0409 coinciden.
    branch: (entries) => without(without(entries, "0409_bank_rbac"), "0418_academia"),
  });

  git(repo, ["merge", "--no-edit", "main"]);
  const merged = readBaseline(repo);
  assert.deepEqual(Object.keys(merged.pendingBelowCutoff), ["0430_perfil", "0450_aliado"]);
  assert.equal(merged.pendingBelowCutoff["0430_perfil"], "espera 0430 revisada");
  const expected = readBaseline(repo, "main");
  delete expected.pendingBelowCutoff["0418_academia"];
  assert.equal(readFileSync(baselineFile(repo), "utf8"), serializeBaseline(expected));
});

test("borrar contra editar una espera falla cerrado en ambos sentidos", (t) => {
  const edited = (entries) => withReason(entries, "0418_academia", "espera 0418 con otro motivo");
  const removed = (entries) => without(entries, "0418_academia");
  for (const [label, sides] of [
    ["main retira y la rama edita", { main: removed, branch: edited }],
    ["main edita y la rama retira", { main: edited, branch: removed }],
  ]) {
    const repo = createRepo(t);
    makeMainAndBranch(repo, sides);
    const before = readFileSync(baselineFile(repo), "utf8");

    const merge = git(repo, ["merge", "--no-edit", "main"], { expected: [1] });
    assert.match(
      merge.stderr,
      /conflicto real en pendingBelowCutoff\.0418_academia: borrado contra edición/u,
      label,
    );
    const unresolved = git(repo, ["diff", "--name-only", "--diff-filter=U"]).stdout;
    assert.match(unresolved, /supabase\/migrations-baseline\.json/u, label);
    // Al rechazar, el driver no toca %A: queda la versión de la rama.
    assert.equal(readFileSync(baselineFile(repo), "utf8"), before, label);
  }
});

test("rechaza claves duplicadas en la base o en la versión entrante sin tocar %A", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "dtd-merge-duplicate-"));
  t.after(() => safeRemoveTemp(dir));
  const valid = '{"cutoff":238,"pendingBelowCutoff":{"0409_a":"motivo","0418_b":"motivo"}}\n';
  // Un retiro a mano que deja una clave repetida no puede leerse como retiro de 0409_a.
  const duplicate =
    '{"cutoff":238,"pendingBelowCutoff":{"0418_b":"motivo","0418_b":"motivo"}}\n';
  const files = Object.fromEntries(
    ["base", "current", "other"].map((name) => [name, path.join(dir, `${name}.json`)]),
  );

  for (const [side, label] of [
    ["base", "baseline base"],
    ["other", "baseline entrante"],
  ]) {
    for (const name of Object.keys(files)) {
      writeFileSync(files[name], name === side ? duplicate : valid, "utf8");
    }
    const result = run(
      ROOT,
      process.execPath,
      [DRIVER_SOURCE, files.base, files.current, files.other, "supabase/migrations-baseline.json"],
      { expected: [1] },
    );
    assert.match(result.stderr, new RegExp(`${label}: clave duplicada '0418_b'`, "u"));
    assert.equal(readFileSync(files.current, "utf8"), valid);
  }
});

test("el índice retira la fila de una spec que main renumeró y conserva la de la rama", (t) => {
  const repo = createRepo(t);
  git(repo, ["switch", "-c", "branch"]);
  writeSpec(repo, "0003", "Spec rama");
  run(repo, process.execPath, ["scripts/build-docs-index.mjs"]);
  commitAll(repo, "rama agrega 0003");

  git(repo, ["switch", "main"]);
  git(repo, ["rm", "-r", "-q", "docs/specs/0001-merge-test"]);
  writeSpec(repo, "0004", "Spec base");
  run(repo, process.execPath, ["scripts/build-docs-index.mjs"]);
  commitAll(repo, "main renumera 0001 como 0004");

  git(repo, ["switch", "branch"]);
  const merge = git(repo, ["merge", "--no-edit", "main"]);
  assert.match(merge.stderr, /merge semántico: docs\/specs\/README\.md/u);
  const index = readFileSync(path.join(repo, "docs", "specs", "README.md"), "utf8");
  assert.doesNotMatch(index, /^\| 0001 \|/mu);
  assert.match(index, /^\| 0003 \| Spec rama \|/mu);
  assert.match(index, /^\| 0004 \| Spec base \|/mu);
  // La fila sigue al árbol de specs: una unión la dejaría huérfana y docs:check en rojo.
  run(repo, process.execPath, ["scripts/build-docs-index.mjs", "--check"]);
});

// Driver anterior simulado: une pendingBelowCutoff y nunca aplica un retiro,
// como la regla 1 original. Deja una marca para saber qué driver corrió.
const UNION_DRIVER = [
  'import { readFileSync, writeFileSync } from "node:fs";',
  "const [, currentFile, otherFile] = process.argv.slice(2);",
  'const read = (file) => JSON.parse(readFileSync(file, "utf8"));',
  "const current = read(currentFile);",
  "current.pendingBelowCutoff = {",
  "  ...read(otherFile).pendingBelowCutoff,",
  "  ...current.pendingBelowCutoff,",
  "};",
  'writeFileSync(currentFile, JSON.stringify(current, null, 2) + "\\n", "utf8");',
  'console.error("driver de la rama: unión");',
  "",
].join("\n");

test("la rama corre el driver de su propio árbol: la primera actualización fuerza el de main", (t) => {
  const repo = createRepo(t);
  const driverFile = path.join(repo, "scripts", "merge-generated-records.mjs");
  // Base y rama llevan el driver anterior; main recibe el retiro de 0409 y
  // después el driver nuevo, como cuando esta enmienda entra a main.
  writeFileSync(driverFile, UNION_DRIVER, "utf8");
  makeMainAndBranch(repo, {
    main: (entries) => without(entries, "0409_bank_rbac"),
    branch: (entries) => [...entries, ["0436_rama", "espera 0436"]],
  });
  git(repo, ["switch", "main"]);
  copyFileSync(DRIVER_SOURCE, driverFile);
  commitAll(repo, "main recibe el driver nuevo");
  git(repo, ["switch", "branch"]);
  const branchTip = git(repo, ["rev-parse", "HEAD"]).stdout.trim();

  // Sin override, Git ejecuta el driver que la rama tiene en su árbol.
  const plain = git(repo, ["merge", "--no-edit", "main"]);
  assert.match(plain.stderr, /driver de la rama: unión/u);
  assert.ok(Object.hasOwn(readBaseline(repo).pendingBelowCutoff, "0409_bank_rbac"));

  // El merge trajo el driver nuevo, pero la espera resucitada ya cuenta como
  // adición de la rama: la actualización siguiente no la retira.
  git(repo, ["switch", "main"]);
  setPending(repo, [
    ...Object.entries(readBaseline(repo).pendingBelowCutoff),
    ["0450_aliado", "espera 0450"],
  ]);
  commitAll(repo, "main integra 0450");
  git(repo, ["switch", "branch"]);
  const next = git(repo, ["merge", "--no-edit", "main"]);
  assert.match(next.stderr, /merge semántico: supabase\/migrations-baseline\.json/u);
  assert.ok(Object.hasOwn(readBaseline(repo).pendingBelowCutoff, "0409_bank_rbac"));

  // Con el driver de main forzado en la primera actualización, gana el retiro.
  git(repo, ["switch", "-c", "override", branchTip]);
  const mainDriver = path.join(repo, ".git", "dtd-merge-driver-main.mjs").replaceAll("\\", "/");
  writeFileSync(
    mainDriver,
    git(repo, ["show", "main:scripts/merge-generated-records.mjs"]).stdout,
    "utf8",
  );
  const forced = git(repo, [
    "-c",
    `merge.dtd-generated-records.driver=node "${mainDriver}" %O %A %B %P`,
    "merge",
    "--no-edit",
    "main",
  ]);
  assert.match(forced.stderr, /merge semántico: supabase\/migrations-baseline\.json/u);
  assert.doesNotMatch(forced.stderr, /driver de la rama/u);
  const expected = readBaseline(repo, "main");
  expected.pendingBelowCutoff["0436_rama"] = "espera 0436";
  assert.equal(readFileSync(baselineFile(repo), "utf8"), serializeBaseline(expected));
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

test("una declaración retirada en ambas ramas queda retirada", (t) => {
  const repo = createRepo(t);
  const retire = (value) => {
    value.degradations = value.degradations.filter((entry) => entry.id !== "base-retirable");
  };
  makeDeclarationBranches(repo, {
    // La rama entrante también agrega otra declaración: así el archivo difiere
    // entre ramas y Git invoca el driver en vez de tomar un lado idéntico.
    other: (value) => {
      retire(value);
      value.degradations.push(declaration("l05-rama-other"));
    },
    current: retire,
  });

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

/**
 * SDD-0464: `skills-lock.json` y el árbol de skills describen lo mismo bajo una
 * regla explícita. Repos git temporales reproducen la alineación y cada forma
 * de desalineación; la última prueba corre el checker sobre este repositorio.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditSkillsManifest, parseSkillFrontmatter } from "../check-skills-manifest.mjs";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const script = path.join(repo, "scripts", "check-skills-manifest.mjs");

const GITIGNORE = [
  ".claude/*",
  "!.claude/skills/",
  ".claude/skills/*",
  "!.claude/skills/ui-pro/",
  "!.claude/skills/ui-pro/**",
  ".agents/skills/higgsfield-*/",
  ".agents/skills/find-skills/",
  "",
].join("\n");

function skillMd(name, description = `Skill ${name} de prueba.`) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;
}

function thirdPartyEntry(name) {
  return { source: "higgsfield-ai/skills", sourceType: "github", skillPath: `${name}/SKILL.md`, computedHash: "0".repeat(64) };
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

/** Repo temporal con una skill propia por base, una de terceros en el lock y la regla de .gitignore del proyecto. */
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "dtd-skills-manifest-"));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });
  git(root, ["init", "-q", "-b", "main"]);
  write(root, ".gitignore", GITIGNORE);
  write(root, ".agents/skills/local-one/SKILL.md", skillMd("local-one"));
  write(root, ".claude/skills/ui-pro/SKILL.md", skillMd("ui-pro", '"Auditoría, con comillas y dos puntos: sí."'));
  git(root, ["add", "--", ".gitignore", ".agents/skills/local-one/SKILL.md", ".claude/skills/ui-pro/SKILL.md"]);
  const lock = { version: 1, skills: { "higgsfield-x": thirdPartyEntry("higgsfield-x") } };
  const writeLock = (value) => write(root, "skills-lock.json", typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
  writeLock(lock);
  return { root, lock, writeLock };
}

function run(root) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [script, "--root", root], { encoding: "utf8", env, windowsHide: true });
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

test("frontmatter: name y description, con comillas opcionales; sin cierre no hay frontmatter", () => {
  assert.deepEqual(parseSkillFrontmatter('---\nname: ui-pro\ndescription: "a: b"\n---\n# x'), { name: "ui-pro", description: "a: b" });
  assert.equal(parseSkillFrontmatter("---\nname: x\n# sin cierre"), null);
  assert.equal(parseSkillFrontmatter("# sin frontmatter"), null);
});

test("un lock de terceros ignorados más skills propias versionadas está alineado", (t) => {
  const { root } = fixture(t);
  const result = run(root);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /\[OK\]/);
  assert.match(result.output, /1 de terceros registradas .* 0 presente\(s\) en disco/);
  assert.match(result.output, /2 propias versionadas: local-one \(\.agents\/skills\) · ui-pro \(\.claude\/skills\)/);
});

test("una skill versionada registrada en el lock es una desalineación", (t) => {
  const { root, lock, writeLock } = fixture(t);
  writeLock({ ...lock, skills: { ...lock.skills, "local-one": thirdPartyEntry("local-one") } });
  const result = run(root);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /local-one: está versionada en \.agents\/skills\/local-one y a la vez registrada/);
});

test("una entrada del lock que git no ignora quedaría versionada por accidente", (t) => {
  const { root, lock, writeLock } = fixture(t);
  writeLock({ ...lock, skills: { ...lock.skills, stray: thirdPartyEntry("stray") } });
  const result = run(root);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /stray: git no ignora \.agents\/skills\/stray\//);
});

test("una skill propia cuyo SKILL.md no coincide con su directorio o no describe falla", (t) => {
  const { root } = fixture(t);
  write(root, ".agents/skills/local-one/SKILL.md", skillMd("otro-nombre", ""));
  const result = run(root);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /frontmatter name «otro-nombre» no coincide con el directorio local-one/);
  assert.match(result.output, /local-one\/SKILL\.md: description vacía/);
});

test("una instalación ignorada sin entrada en el lock no se puede reinstalar; con entrada, se inventaría", (t) => {
  const { root, lock, writeLock } = fixture(t);
  write(root, ".agents/skills/higgsfield-y/SKILL.md", skillMd("higgsfield-y"));
  const missing = run(root);
  assert.equal(missing.status, 1, missing.output);
  assert.match(missing.output, /higgsfield-y\/ está instalada e ignorada pero no figura en skills-lock\.json/);

  writeLock({ ...lock, skills: { ...lock.skills, "higgsfield-y": thirdPartyEntry("higgsfield-y") } });
  const registered = run(root);
  assert.equal(registered.status, 0, registered.output);
  assert.match(registered.output, /2 de terceros registradas .* 1 presente\(s\) en disco/);
});

test("un lock ilegible o con otra forma es error de contrato", (t) => {
  const { root, writeLock } = fixture(t);
  writeLock("{ not json");
  const broken = run(root);
  assert.equal(broken.status, 2, broken.output);
  // La etiqueta lleva color: entre `[FAIL]` y el nombre hay un código ANSI de reset.
  assert.match(broken.output, /\[FAIL\].*skills-manifest/);

  writeLock({ version: 2, skills: [] });
  const shape = run(root);
  assert.equal(shape.status, 1, shape.output);
  assert.match(shape.output, /requiere version=1 y skills\{\}/);
});

test("la decisión pura nombra cada problema y deja el inventario cuando está alineado", () => {
  const aligned = auditSkillsManifest({
    lock: { version: 1, skills: { "higgsfield-x": thirdPartyEntry("higgsfield-x") } },
    versioned: [{ base: ".agents/skills", name: "worker", frontmatter: { name: "worker", description: "Ejecuta." } }],
    ignoredPresent: [{ base: ".agents/skills", name: "higgsfield-x" }],
    isIgnored: () => true,
  });
  assert.deepEqual(aligned.problems, []);
  assert.deepEqual(aligned.inventory, {
    thirdParty: [{ name: "higgsfield-x", present: true, ignored: true }],
    versioned: [{ base: ".agents/skills", name: "worker" }],
  });

  const malformed = auditSkillsManifest({
    lock: { version: 1, skills: { "bad name": { source: "x", sourceType: "github", skillPath: "x/README.md" } } },
    versioned: [],
    ignoredPresent: [],
    isIgnored: () => true,
  });
  assert.equal(malformed.problems.length, 2);
  assert.match(malformed.problems[0], /nombre de skill inválido/);
  assert.match(malformed.problems[1], /skillPath debe terminar en SKILL\.md/);
});

test("este repositorio está alineado: terceros ignorados en el lock y cuatro propias versionadas", () => {
  const result = run(repo);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /director, worker \(\.agents\/skills\) · revisar-datos-ve, ui-pro \(\.claude\/skills\)/);
});

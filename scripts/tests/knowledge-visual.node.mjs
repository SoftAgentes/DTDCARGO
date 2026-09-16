import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceEvidence, verifyRuntime, runtimeTreeDigest, inspectVisual } from '../lib/knowledge-visual.mjs';
import { extractStandaloneSVG } from '../knowledge-visual.mjs';

const root = fs.realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const policy = JSON.parse(fs.readFileSync(path.join(root, 'scripts/knowledge-visual-evidence.json')));
const specification = JSON.parse(fs.readFileSync(path.join(root, 'docs/architecture/knowledge-lifecycle.archify.json')));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function scratch(t) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'archify-evidence-')));
  t.after(() => {
    assert.ok(dir.startsWith(fs.realpathSync.native(os.tmpdir()) + path.sep));
    fs.rmSync(dir, {recursive:true,force:true});
  });
  return dir;
}

test('all ten visual components and eleven connections have verifiable local full-byte sources', (t) => {
  const fixture = scratch(t);
  const sources = [...new Set(Object.values(policy.components).concat(Object.values(policy.connections))
    .flatMap((selectors) => selectors.map((s) => s.path)))];
  for (const relative of sources) {
    const destination = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(destination), {recursive:true});
    fs.copyFileSync(path.join(root, relative), destination);
  }
  const first = sourceEvidence(fixture, specification, policy);
  assert.equal(Object.keys(first.components).length, 10);
  assert.equal(Object.keys(first.connections).length, 11);
  assert.equal(first.kind, 'AUTHORED_EXPLANATION');
  const agents = path.join(fixture, 'AGENTS.md');
  fs.writeFileSync(agents, '---\nreview: later\n---\n' + fs.readFileSync(agents, 'utf8'));
  const changed = sourceEvidence(fixture, specification, policy);
  assert.notEqual(first.sourceHashes['AGENTS.md'], changed.sourceHashes['AGENTS.md'], 'YAML-only changes invalidate the source receipt');
  const runbook = path.join(fixture, 'docs/runbooks/knowledge-graphify-obsidian.md');
  fs.writeFileSync(runbook, fs.readFileSync(runbook, 'utf8').replace('Obsidian detecta archivos locales', 'Obsidian awaits a reader'));
  assert.throws(() => sourceEvidence(fixture, specification, policy), /ARCHIFY_SOURCE_STALE/);
});

test('pinned release archive and runtime tree reject altered package bytes', (t) => {
  const fixture = scratch(t);
  const packageRoot = path.join(fixture, 'graphify-out/archify-package');
  const bin = path.join(packageRoot, 'archify/bin');
  fs.mkdirSync(bin, {recursive:true});
  const archive = path.join(packageRoot, 'archify.zip');
  const cli = path.join(bin, 'archify.mjs');
  fs.writeFileSync(archive, 'trusted-release');
  fs.writeFileSync(cli, 'trusted-cli');
  const lock = {archiveSha256:sha(fs.readFileSync(archive)),runtimeTreeSha256:runtimeTreeDigest(path.join(packageRoot,'archify'))};
  assert.equal(verifyRuntime(fixture,lock), cli);
  fs.writeFileSync(archive, 'different-release');
  assert.throws(() => verifyRuntime(fixture,lock), /ARCHIFY_ARCHIVE_MISMATCH/);
  fs.writeFileSync(archive, 'trusted-release');
  fs.writeFileSync(cli, 'modified-cli');
  assert.throws(() => verifyRuntime(fixture,lock), /ARCHIFY_RUNTIME_MISMATCH/);
});

test('a tracked visual specification without its stable runtime remains pending', (t) => {
  const fixture = scratch(t);
  const sources = [...new Set(Object.values(policy.components).concat(Object.values(policy.connections))
    .flatMap((selectors) => selectors.map((s) => s.path)))];
  for (const relative of [...sources, 'scripts/knowledge-visual-evidence.json', 'scripts/archify.lock.json',
    'docs/architecture/knowledge-lifecycle.archify.json']) {
    const destination = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(destination), {recursive:true});
    fs.copyFileSync(path.join(root, relative), destination);
  }
  const repo = {root:fixture,revision:'a'.repeat(40),sourcePaths:['docs/architecture/knowledge-lifecycle.archify.json']};
  const graph = {graphHash:'graph-fixture',corpusHash:'corpus-fixture'};
  const state = inspectVisual(repo, graph, 'fixture-policy');
  assert.equal(state.status, 'PENDING');
  assert.match(state.reason, /ARCHIFY_RUNTIME_MISSING/);
});

test('standalone SVG for Obsidian carries its own styles and rejects ambiguous HTML', () => {
  const html = '<html><style>:root { --ink: #123; } .node { fill: var(--ink); }</style><svg viewBox="0 0 100 100"><rect class="node"/></svg></html>';
  const svg = extractStandaloneSVG(html);
  assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /data-theme="light"/);
  assert.match(svg, /<style><!\[CDATA\[/);
  assert.match(svg, /fill: var\(--ink\)/);
  assert.throws(() => extractStandaloneSVG(html.replace('</svg>', '</svg><svg></svg>')), /ARCHIFY_SVG_EXPORT_UNAVAILABLE/);
});

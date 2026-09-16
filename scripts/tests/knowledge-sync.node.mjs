import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run } from '../knowledge-sync.mjs';

// Integration fixtures exercise the real adapter, Git and filesystem. Their graph
// nodes and semantic receipts are synthetic test evidence, never a production run.
const adapter = fileURLToPath(new URL('../knowledge-graph.py', import.meta.url));
const policySource = fileURLToPath(new URL('../knowledge-policy.json', import.meta.url));
const candidates = [process.env.GRAPHIFY_PYTHON,
  path.join(os.homedir(), 'AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe'),
  path.join(os.homedir(), '.local/share/uv/tools/graphifyy/bin/python'), 'python3', 'python'].filter(Boolean);
let python;
for (const candidate of candidates) {
  const probe = spawnSync(candidate, ['-c', "import importlib.metadata,sys; print(importlib.metadata.version('graphifyy')); print(sys.executable)"], { encoding: 'utf8', windowsHide: true });
  const lines = probe.stdout?.trim().split(/\r?\n/) ?? [];
  if (probe.status === 0 && lines[0] === '0.9.61' && path.isAbsolute(lines[1] ?? '')) { python = lines[1]; break; }
}
const skip = python ? false : 'NO DISPONIBLE: Graphify 0.9.61 runtime; set GRAPHIFY_PYTHON. No installation attempted.';
const hash = (content, algorithm = 'sha256') => createHash(algorithm).update(content).digest('hex');

function fixture(t) {
  // Native canonical paths also avoid Git/Node disagreements about Windows DOS 8.3.
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-sync-fixture-')));
  const root = path.join(base, 'repo'); const promptFile = path.join(base, 'fixture-extraction-spec.md');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(promptFile, 'SYNTHETIC FIXTURE: read document including YAML properties.\n');
  fs.copyFileSync(policySource, path.join(root, 'scripts/knowledge-policy.json'));
  const fixturePolicyPath = path.join(root, 'scripts/knowledge-policy.json');
  const fixturePolicy = JSON.parse(fs.readFileSync(fixturePolicyPath, 'utf8'));
  fixturePolicy.semanticPilot = { id: 'fixture-readme', label: 'README fixture', documents: ['README.md'] };
  fs.writeFileSync(fixturePolicyPath, JSON.stringify(fixturePolicy, null, 2) + '\n');
  const implementation = ['knowledge-sync.mjs', 'knowledge-graph.py', 'knowledge-visual.mjs',
    'lib/knowledge-state.mjs', 'lib/knowledge-projection.mjs', 'lib/knowledge-vault.mjs', 'lib/knowledge-visual.mjs'];
  for (const relative of implementation) {
    const destination = path.join(root, 'scripts', relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(fileURLToPath(new URL('../' + relative, import.meta.url)), destination);
  }
  fs.writeFileSync(path.join(root, '.gitignore'), 'graphify-out/\n/DTD Cargo/\n');
  fs.writeFileSync(path.join(root, '.graphifyignore'), 'scripts/\n/DTD Cargo/\ngraphify-out/\n');
  fs.writeFileSync(path.join(root, 'source.py'), 'def fixture_example():\n    return 1\n');
  fs.writeFileSync(path.join(root, 'README.md'), '---\nstatus: approved\n---\n# Synthetic integration fixture\n\nOne verified fixture decision.\n\n[Missing fixture reference](missing-fixture.md)\n');
  fs.mkdirSync(path.join(root, 'docs/architecture'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/architecture/outside.md'), '# Outside pilot\n\nVisible global pending source.\n');
  const gitAt = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const git = (...args) => gitAt(root, ...args);
  git('init', '-b', 'main'); git('config', 'user.name', 'Knowledge Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  git('add', 'README.md', 'docs/architecture/outside.md', 'source.py', '.gitignore', '.graphifyignore', 'scripts/knowledge-policy.json', ...implementation.map((relative) => 'scripts/' + relative));
  git('commit', '-m', 'test fixture: canonical knowledge sources');
  git('remote', 'add', 'origin', 'https://github.com/example/knowledge-fixture');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD'); // Local fixture ref; no fetch/push.
  const graph = { directed: false, nodes: [
    { id: 'fixture_source_example', label: 'fixture example', source_file: 'source.py', _origin: 'ast', file_type: 'code' },
    { id: 'fixture_readme_heading', label: 'Synthetic integration fixture', source_file: 'README.md', _origin: 'ast', file_type: 'document' },
    { id: 'fixture_outside_heading', label: 'Outside pilot', source_file: 'docs/architecture/outside.md', _origin: 'ast', file_type: 'document' },
    { id: 'fixture_readme_decision', label: 'One verified fixture decision', source_file: 'README.md', source_location: 'L7', _origin: 'semantic', file_type: 'document' },
  ], links: [{ source: 'fixture_readme_decision', target: 'fixture_source_example', confidence: 'EXTRACTED', relation: 'documents_fixture', source_file: 'README.md', source_location: 'L7', _origin: 'semantic' }] };
  function stamp(directory = root) {
    const out = path.join(directory, 'graphify-out'); fs.mkdirSync(out, { recursive: true });
    const manifest = {};
    for (const name of ['README.md', 'docs/architecture/outside.md', 'source.py']) {
      const md5 = hash(fs.readFileSync(path.join(directory, name)), 'md5');
      manifest[name] = { ast_hash: md5, semantic_hash: name.endsWith('.md') ? md5 : '' };
    }
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(out, 'graph.json'), JSON.stringify(graph));
  }
  function inspect(directory = root, command = 'inspect', extra = []) {
    const result = spawnSync(python, [adapter, command, '--root', directory, '--prompt-file', promptFile, ...extra], { encoding: 'utf8', windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
  function certify(directory = root) {
    const state = inspect(directory);
    const evidence = Object.fromEntries(['schemaVersion', 'version', 'root', 'head', 'graphHash', 'corpusHash', 'configHash', 'promptHash'].map((key) => [key, state[key]]));
    evidence.files = { 'README.md': { status: 'success', sha256: state.files['README.md'].sha256, nodeIds: ['fixture_readme_decision'], frontmatterReviewed: true } };
    const location = path.join(base, 'synthetic-semantic-evidence.json');
    fs.writeFileSync(location, JSON.stringify(evidence));
    const result = inspect(directory, 'record', ['--semantic-evidence', location]);
    assert.equal(result.semantic.status, 'PENDING');
    assert.deepEqual(result.semantic.verified, ['README.md']);
    return result;
  }
  const call = async (command, extra = {}) => {
    const integrated = await import(pathToFileURL(path.join(root, 'scripts/knowledge-sync.mjs')).href);
    return integrated.run({ command, root, python, promptFile, preview: false, ...extra });
  };
  const vault = path.join(root, 'DTD Cargo');
  const generated = (...parts) => path.join(vault, 'Generado', ...parts);
  t.after(() => {
    const resolved = path.resolve(base); const parent = fs.realpathSync.native(os.tmpdir());
    assert.ok(resolved.startsWith(parent + path.sep), 'Fixture cleanup remains within the system temp directory');
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  stamp();
  return { base, root, promptFile, git, gitAt, graph, stamp, inspect, certify, call, vault, generated };
}

test('synthetic end-to-end: 0/1 blocks; 1/1 publishes while global pending stays visible and idempotent', { skip }, async (t) => {
  const f = fixture(t);
  const pending = await f.call('status');
  assert.equal(pending.structural.status, 'CURRENT'); assert.equal(pending.semantic.status, 'PENDING');
  assert.equal(pending.semanticCoverage.pilot.status, 'PENDING');
  assert.ok(pending.publicationProblems.some((problem) => problem.startsWith('SEMANTIC_PILOT_PENDING')));
  await assert.rejects(f.call('publish'), /SEMANTIC_PILOT_PENDING/);
  assert.equal(fs.existsSync(f.vault), false, 'Rejected publication must not create the shared vault');
  f.certify();
  fs.mkdirSync(f.vault); fs.writeFileSync(path.join(f.vault, 'Personal.md'), '# My private fixture notes\n');
  const published = await f.call('publish');
  assert.equal(published.ok, true); assert.equal(published.published, true); assert.equal(published.obsidian.status, 'CURRENT');
  assert.equal(published.semantic.status, 'PENDING');
  assert.deepEqual({status:published.semanticCoverage.pilot.status,verified:published.semanticCoverage.pilot.verifiedCount,total:published.semanticCoverage.pilot.targetCount},{status:'CURRENT',verified:1,total:1});
  assert.deepEqual({status:published.semanticCoverage.global.status,verified:published.semanticCoverage.global.verifiedCount,total:published.semanticCoverage.global.totalCount,pending:published.semanticCoverage.global.pendingCount},{status:'PENDING',verified:1,total:2,pending:1});
  assert.match(published.publicationWarnings[0],/^SEMANTIC_GLOBAL_PENDING: 1\/2/);
  assert.equal(published.documents, 2);
  const map = JSON.parse(fs.readFileSync(f.generated('Mapa', 'mapa.json'), 'utf8'));
  assert.equal(map.topics.length, 8); assert.equal(map.documents.length, 2);
  assert.equal(map.semanticCoverage.pilot.status, 'CURRENT'); assert.equal(map.semanticCoverage.global.status, 'PENDING');
  assert.deepEqual(map.documents.find((document) => document.path === 'README.md').semantic,{scope:'PILOT',status:'VERIFIED'});
  assert.deepEqual(map.documents.find((document) => document.path === 'docs/architecture/outside.md').semantic,{scope:'OUTSIDE_PILOT',status:'PENDING'});
  const index = fs.readFileSync(f.generated('Indice.md'), 'utf8');
  assert.match(index,/Piloto semántico CURRENT/); assert.match(index,/Cobertura global: \*\*PENDING\*\*, 1\/2/);
  const manifest = JSON.parse(fs.readFileSync(f.generated('.knowledge-manifest.json'), 'utf8'));
  assert.equal(manifest.metadata.semanticCoverage.pilot.status, 'CURRENT'); assert.equal(manifest.metadata.semanticCoverage.global.status, 'PENDING');
  const checked = await f.call('check');
  assert.equal(checked.ok, true); assert.equal(checked.obsidian.status, 'CURRENT');
  assert.ok(checked.obsidian.warnings.some((warning) => warning.type === 'missing-link-target'));
  assert.deepEqual(checked.obsidian.warnings, published.warnings);
  const before = fs.statSync(f.generated('Indice.md')).mtimeMs;
  const repeated = await f.call('publish');
  assert.equal(repeated.ok, true); assert.equal(repeated.unchanged, true); assert.equal(repeated.published, false);
  assert.equal(fs.statSync(f.generated('Indice.md')).mtimeMs, before);
  assert.equal(fs.readFileSync(path.join(f.vault, 'Personal.md'), 'utf8'), '# My private fixture notes\n');
  assert.equal(f.git('status', '--porcelain'), '', 'Generated outputs remain outside tracked Git state');
});

test('an exporter from another checkout cannot publish into integrated main via --root', { skip }, async (t) => {
  const f = fixture(t); f.certify();
  await assert.rejects(run({ command: 'publish', root: f.root, python, promptFile: f.promptFile, preview: false }), /EXECUTOR_MAIN_REQUIRED/);
  assert.equal(fs.existsSync(f.vault), false, 'Rejected foreign executor must not create the shared vault');
  const integrated = await f.call('publish');
  assert.equal(integrated.ok, true);
});

test('synthetic YAML-only edit remains pending despite a native full stamp and unchanged body', { skip }, async (t) => {
  const f = fixture(t); f.certify(); await f.call('publish');
  const before = fs.readFileSync(f.generated('Documentacion', 'README.md'), 'utf8');
  const readme = path.join(f.root, 'README.md');
  fs.writeFileSync(readme, fs.readFileSync(readme, 'utf8').replace('status: approved', 'status: reviewed'));
  f.git('add', 'README.md'); f.git('commit', '-m', 'fixture: YAML-only decision status change'); f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  f.stamp(); // Simulates native cache reuse; does not create new full-byte semantic evidence.
  const native = f.inspect();
  assert.equal(native.files['README.md'].semanticNativeCurrent, true);
  assert.equal(native.structural.status, 'CURRENT'); assert.equal(native.semantic.status, 'PENDING');
  const status = await f.call('check');
  assert.equal(status.ok, false); assert.equal(status.semantic.status, 'PENDING');
  assert.equal(status.semanticCoverage.pilot.status, 'PENDING');
  await assert.rejects(f.call('publish'), /SEMANTIC_PILOT_PENDING/);
  assert.equal(fs.readFileSync(f.generated('Documentacion', 'README.md'), 'utf8'), before);
});

test('synthetic linked worktree cannot publish into the shared main vault even with fresh evidence', { skip }, async (t) => {
  const f = fixture(t); f.certify(); await f.call('publish');
  const before = fs.readFileSync(f.generated('.knowledge-manifest.json'), 'utf8');
  const worktree = path.join(f.base, 'worker');
  f.git('worktree', 'add', '-b', 'codex/fixture-worker', worktree, 'HEAD');
  f.stamp(worktree); f.certify(worktree);
  assert.equal(f.gitAt(worktree, 'status', '--porcelain'), '');
  const workerStatus = await f.call('status', { root: worktree });
  assert.equal(workerStatus.structural.status, 'CURRENT'); assert.equal(workerStatus.semantic.status, 'PENDING');
  assert.equal(workerStatus.semanticCoverage.pilot.status, 'CURRENT');
  assert.ok(workerStatus.publicationProblems.some((problem) => problem.startsWith('MAIN_REQUIRED')));
  await assert.rejects(f.call('publish', { root: worktree }), /MAIN_REQUIRED/);
  assert.equal(fs.readFileSync(f.generated('.knowledge-manifest.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(worktree, 'DTD Cargo')), false);
});

test('synthetic manifest prompt and tool version regressions are detected and corrected', { skip }, async (t) => {
  const f = fixture(t); f.certify(); await f.call('publish');
  const location = f.generated('.knowledge-manifest.json');
  for (const [field, stale] of [['promptHash', 'stale-fixture-prompt'], ['graphifyVersion', '0.9.60-fixture']]) {
    const manifest = JSON.parse(fs.readFileSync(location, 'utf8'));
    manifest.metadata[field] = stale; fs.writeFileSync(location, JSON.stringify(manifest));
    const status = await f.call('check');
    assert.equal(status.ok, false); assert.equal(status.obsidian.status, 'PENDING');
    assert.equal(status.semantic.status, 'PENDING'); assert.equal(status.semanticCoverage.pilot.status, 'CURRENT');
    const corrected = await f.call('publish');
    assert.equal(corrected.ok, true); assert.equal(corrected.changed, true);
    assert.notEqual(JSON.parse(fs.readFileSync(location, 'utf8')).metadata[field], stale);
  }
  fs.appendFileSync(f.promptFile, 'SYNTHETIC FIXTURE: new extraction requirement.\n');
  const promptChanged = await f.call('check');
  assert.equal(promptChanged.ok, false); assert.equal(promptChanged.semantic.status, 'PENDING');
  assert.equal(promptChanged.semanticCoverage.pilot.status, 'PENDING');
  await assert.rejects(f.call('publish'), /SEMANTIC_PILOT_PENDING/);
});

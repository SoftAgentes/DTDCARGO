import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../knowledge-graph-repair.py', import.meta.url));
const candidates = [process.env.GRAPHIFY_PYTHON,
  path.join(os.homedir(), 'AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe'),
  'python3', 'python'].filter(Boolean);
const python = candidates.find(candidate => {
  const probe = spawnSync(candidate, ['-c', "import importlib.metadata; print(importlib.metadata.version('graphifyy'))"], { encoding: 'utf8' });
  return probe.status === 0 && probe.stdout.trim() === '0.9.61';
});
const skip = python ? false : 'NO DISPONIBLE: Graphify 0.9.61 Python runtime';
const external = 'ext_app_portal_auth_login_page_js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-graph-repair-'));
  const out = path.join(root, 'graphify-out');
  const sourcePath = path.join(root, 'scripts/prune-next-types.mjs');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.mkdirSync(out);
  const source = '/** Next validator held la referencia ../../app/portal/(auth)/login/page.js mediante import() */\nexport function prune() { return true; }\n';
  fs.writeFileSync(sourcePath, source);
  const graph = { directed: false, nodes: [
    { id: 'scripts_prune_next_types', source_file: 'scripts/prune-next-types.mjs', _origin: 'ast', label: 'prune-next-types.mjs' },
    { id: external, source_file: '../app/portal/(auth)/login/page.js', _origin: 'ast', label: '../../app/portal/(auth)/login/page.js' },
  ], links: [], hyperedges: [] };
  const graphPath = path.join(out, 'graph.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ 'scripts/prune-next-types.mjs': {
    ast_hash: createHash('md5').update(source).digest('hex'), semantic_hash: '',
  } }));
  function run(extra = [], status = 0) {
    const result = spawnSync(python, [script, '--root', root, ...extra], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    assert.equal(result.status, status, `status ${result.status}; stdout ${result.stdout}; stderr ${result.stderr}`);
    return JSON.parse((status === 0 ? result.stdout : result.stderr).trim());
  }
  function close() {
    const target = path.resolve(root);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
  return { root, out, sourcePath, graph, graphPath, run, close };
}

test('verified historical orphan is backed up, removed exactly once and can be checked again', { skip }, () => {
  const f = fixture();
  try {
    const before = fs.readFileSync(f.graphPath);
    assert.equal(f.run(['--check']).status, 'REPAIRABLE');
    assert.deepEqual(fs.readFileSync(f.graphPath), before);
    assert.ok(!fs.existsSync(path.join(f.out, 'repair-backups')));
    const result = f.run();
    assert.equal(result.status, 'REPAIRED');
    assert.equal(result.nodesAfter, 1);
    assert.deepEqual(fs.readFileSync(result.backup), before);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.graphPath)).nodes.map(node => node.id), ['scripts_prune_next_types']);
    assert.equal(f.run(['--check']).status, 'UNCHANGED');
    assert.ok(!fs.existsSync(path.join(f.out, 'knowledge-graph-repair.lock')));
  } finally { f.close(); }
});

test('connected or falsely attributed nodes are rejected without changing graph or backup', { skip }, () => {
  const f = fixture();
  try {
    f.graph.links.push({ source: 'scripts_prune_next_types', target: external });
    fs.writeFileSync(f.graphPath, JSON.stringify(f.graph));
    const before = fs.readFileSync(f.graphPath);
    assert.match(f.run([], 1).error, /connected/);
    assert.deepEqual(fs.readFileSync(f.graphPath), before);
    assert.ok(!fs.existsSync(path.join(f.out, 'repair-backups')));
    f.graph.links = [];
    f.graph.nodes[1].source_file = 'elsewhere/outside.js';
    fs.writeFileSync(f.graphPath, JSON.stringify(f.graph));
    assert.match(f.run([], 1).error, /identity or provenance/);
  } finally { f.close(); }
});

test('stale source stamp and concurrent writer lock stop before replacement', { skip }, () => {
  const f = fixture();
  try {
    const before = fs.readFileSync(f.graphPath);
    fs.writeFileSync(f.sourcePath, ['im', 'port', '("../../app/portal/(auth)/login/page.js")\n'].join(''));
    assert.match(f.run([], 1).error, /historical example/);
    const original = '/** Next validator held la referencia ../../app/portal/(auth)/login/page.js mediante import() */\nexport function prune() { return true; }\n';
    fs.writeFileSync(f.sourcePath, original);
    fs.writeFileSync(path.join(f.out, 'manifest.json'), '{}');
    assert.match(f.run([], 1).error, /AST stamp is stale/);
    fs.writeFileSync(path.join(f.out, 'manifest.json'), JSON.stringify({ 'scripts/prune-next-types.mjs': {
      ast_hash: createHash('md5').update(original).digest('hex'),
    } }));
    fs.writeFileSync(path.join(f.out, 'knowledge-graph-repair.lock'), 'other-writer');
    assert.match(f.run([], 1).error, /another graph repair/);
    assert.deepEqual(fs.readFileSync(f.graphPath), before);
    assert.ok(!fs.existsSync(path.join(f.out, 'repair-backups')));
  } finally { f.close(); }
});

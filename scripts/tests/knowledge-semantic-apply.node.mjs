import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../knowledge-semantic-apply.py', import.meta.url));
const adapter = fileURLToPath(new URL('../knowledge-graph.py', import.meta.url));
const candidates = [process.env.GRAPHIFY_PYTHON,
  path.join(os.homedir(), 'AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe'),
  'python3', 'python'].filter(Boolean);
const python = candidates.find(candidate => {
  const result = spawnSync(candidate, ['-c', "import importlib.metadata; print(importlib.metadata.version('graphifyy'))"], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === '0.9.61';
});
const skip = python ? false : 'NO DISPONIBLE: Graphify 0.9.61 Python runtime';
const hash = (raw, algorithm = 'sha256') => createHash(algorithm).update(raw).digest('hex');

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-semantic-apply-'));
  const root = path.join(base, 'repo');
  const out = path.join(root, 'graphify-out');
  const prompt = path.join(base, 'extraction-spec.md');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'));
  fs.mkdirSync(out);
  fs.copyFileSync(adapter, path.join(root, 'scripts/knowledge-graph.py'));
  fs.writeFileSync(prompt, 'Extract named decisions and review YAML frontmatter.\n');
  fs.writeFileSync(path.join(root, '.graphifyignore'), 'scripts/knowledge-graph.py\n');
  fs.writeFileSync(path.join(root, '.gitignore'), 'graphify-out/\nscripts/knowledge-graph.py\n');
  fs.writeFileSync(path.join(root, 'source.py'), 'def example():\n    return 1\n');
  const doc = path.join(root, 'docs/guide.md');
  fs.writeFileSync(doc, '---\nstatus: approved\n---\n# Knowledge\n\nA confirmed decision is documented.\n');
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('add', '.graphifyignore', '.gitignore', 'source.py', 'docs/guide.md');
  git('commit', '-m', 'fixture');
  const graph = { directed: false, nodes: [
    { id: 'source_example', source_file: 'source.py', _origin: 'ast', label: 'example', file_type: 'code' },
    { id: 'docs_guide_knowledge', source_file: 'docs/guide.md', _origin: 'ast', label: 'Knowledge', file_type: 'document' },
  ], links: [], hyperedges: [] };
  const graphPath = path.join(out, 'graph.json');
  const manifestPath = path.join(out, 'manifest.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph));
  function stamp() {
    const manifest = {};
    for (const name of ['source.py', 'docs/guide.md']) manifest[name] = {
      ast_hash: hash(fs.readFileSync(path.join(root, name)), 'md5'), semantic_hash: '',
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  }
  function inputs(label = 'Confirmed decision') {
    const fragment = { nodes: [{ id: 'docs_guide_decision', label, file_type: 'concept',
      source_file: doc, source_location: 'L6', source_url: null, captured_at: null, author: null, contributor: null }],
    edges: [{ source: 'docs_guide_decision', target: 'source_example', relation: 'references',
      confidence: 'EXTRACTED', confidence_score: 1, source_file: doc, source_location: 'L6', weight: 1 }],
    hyperedges: [], input_tokens: 0, output_tokens: 0 };
    const fragmentPath = path.join(base, 'fragment.json');
    const raw = JSON.stringify(fragment);
    fs.writeFileSync(fragmentPath, raw);
    const reviewPath = path.join(base, 'review.json');
    const review = { schemaVersion: 1, head: git('rev-parse', 'HEAD'), fragmentSha256: hash(raw),
      files: { 'docs/guide.md': { sha256: hash(fs.readFileSync(doc)), frontmatterReviewed: true } } };
    fs.writeFileSync(reviewPath, JSON.stringify(review));
    return { fragmentPath, reviewPath };
  }
  function run(paths, extra = [], status = 0) {
    const result = spawnSync(python, [script, '--root', root, '--fragment', paths.fragmentPath, '--review', paths.reviewPath,
      '--prompt-file', prompt, ...extra], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    assert.equal(result.status, status, `status ${result.status}; stdout ${result.stdout}; stderr ${result.stderr}`);
    return JSON.parse((status === 0 ? result.stdout : result.stderr).trim().split(/\r?\n/).at(-1));
  }
  function close() {
    const target = path.resolve(base);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
  stamp();
  return { root, out, doc, git, graphPath, manifestPath, stamp, inputs, run, close };
}

test('assistant fragment receipts one document, leaves other sources unchanged and replaces it after a real edit', { skip }, () => {
  const f = fixture();
  try {
    const paths = f.inputs();
    const prior = fs.readFileSync(f.graphPath);
    assert.equal(f.run(paths, ['--check']).status, 'VALIDATED');
    assert.deepEqual(fs.readFileSync(f.graphPath), prior);
    const applied = f.run(paths);
    assert.equal(applied.status, 'APPLIED');
    assert.equal(applied.nativeCacheFiles, 1);
    assert.equal(applied.semanticVerified, 1);
    assert.equal(applied.semanticPendingAfter, 0);
    assert.equal(JSON.parse(fs.readFileSync(f.manifestPath))['source.py'].semantic_hash, '');
    assert.ok(JSON.parse(fs.readFileSync(f.manifestPath))['docs/guide.md'].semantic_hash);
    assert.ok(fs.existsSync(path.join(applied.backup, 'graph.json')));
    assert.ok(!fs.existsSync(path.join(f.out, 'knowledge-semantic-apply.lock')));
    fs.writeFileSync(f.doc, fs.readFileSync(f.doc, 'utf8').replace('approved', 'reviewed').replace('confirmed', 'revised'));
    f.git('add', 'docs/guide.md');
    f.git('commit', '-m', 'update decision');
    f.stamp();
    const fresh = f.inputs('Revised decision');
    const replacement = f.run(fresh);
    assert.equal(replacement.status, 'APPLIED');
    assert.equal(replacement.semanticVerified, 1);
    const graph = JSON.parse(fs.readFileSync(f.graphPath));
    assert.equal(graph.nodes.filter(node => node.id === 'docs_guide_decision').length, 1);
    assert.equal(graph.nodes.find(node => node.id === 'docs_guide_decision').label, 'Revised decision');
  } finally { f.close(); }
});

test('stale review, missing endpoint and recorder contention preserve original graph and manifest', { skip }, () => {
  const f = fixture();
  try {
    const paths = f.inputs();
    const beforeGraph = fs.readFileSync(f.graphPath);
    const beforeManifest = fs.readFileSync(f.manifestPath);
    const review = JSON.parse(fs.readFileSync(paths.reviewPath));
    review.files['docs/guide.md'].frontmatterReviewed = false;
    fs.writeFileSync(paths.reviewPath, JSON.stringify(review));
    assert.match(f.run(paths, [], 1).error, /frontmatter review missing/);
    const fresh = f.inputs();
    const fragment = JSON.parse(fs.readFileSync(fresh.fragmentPath));
    fragment.edges[0].target = 'missing';
    fs.writeFileSync(fresh.fragmentPath, JSON.stringify(fragment));
    const updated = JSON.parse(fs.readFileSync(fresh.reviewPath));
    updated.fragmentSha256 = hash(fs.readFileSync(fresh.fragmentPath));
    fs.writeFileSync(fresh.reviewPath, JSON.stringify(updated));
    assert.match(f.run(fresh, [], 1).error, /missing endpoint/);
    const valid = f.inputs();
    fs.writeFileSync(path.join(f.out, 'knowledge-record.lock'), 'other recorder');
    assert.match(f.run(valid, [], 1).error, /exist/i);
    assert.deepEqual(fs.readFileSync(f.graphPath), beforeGraph);
    assert.deepEqual(fs.readFileSync(f.manifestPath), beforeManifest);
    assert.ok(!fs.existsSync(path.join(f.out, 'knowledge-semantic-apply.lock')));
  } finally { f.close(); }
});

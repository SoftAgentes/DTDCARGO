import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const outputs = Object.freeze({
  html: 'knowledge-lifecycle.html',
  svg: 'knowledge-lifecycle.svg',
  evidence: 'knowledge-lifecycle.evidence.json',
  receipt: 'knowledge-lifecycle.receipt.json',
});

export function visualPaths(root) {
  const base = path.join(root, 'graphify-out', 'knowledge-visual');
  return Object.fromEntries(Object.entries(outputs).map(([key, file]) => [key, path.join(base, file)]));
}

function readJSON(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }

export function visualConfig(root) {
  const lock = readJSON(path.join(root, 'scripts', 'archify.lock.json'));
  if (lock.schemaVersion !== 1 || lock.version !== '2.16.0' ||
      !/^[a-f0-9]{64}$/.test(lock.archiveSha256) || !/^[a-f0-9]{64}$/.test(lock.runtimeTreeSha256) ||
      lock.specPath !== 'docs/architecture/knowledge-lifecycle.archify.json') throw new Error('ARCHIFY_LOCK_INVALID');
  const evidencePolicy = readJSON(path.join(root, 'scripts', 'knowledge-visual-evidence.json'));
  if (evidencePolicy.schemaVersion !== 1) throw new Error('ARCHIFY_EVIDENCE_POLICY_INVALID');
  return { lock, evidencePolicy };
}

export function runtimeTreeDigest(directory) {
  const entries = [];
  function walk(folder) {
    for (const name of fs.readdirSync(folder)) {
      const file = path.join(folder, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('ARCHIFY_RUNTIME_LINK: ' + file);
      if (stat.isDirectory()) walk(file);
      else if (stat.isFile()) entries.push(path.relative(directory, file).split(path.sep).join('/') + '\0' + digest(fs.readFileSync(file)) + '\n');
      else throw new Error('ARCHIFY_RUNTIME_TYPE: ' + file);
    }
  }
  walk(directory);
  return digest(entries.sort(compare).join(''));
}

export function verifyRuntime(root, lock) {
  const packageRoot = path.join(root, 'graphify-out', 'archify-package');
  const archive = path.join(packageRoot, 'archify.zip');
  const directory = path.join(packageRoot, 'archify');
  if (!fs.existsSync(archive) || !fs.existsSync(directory)) throw new Error('ARCHIFY_RUNTIME_MISSING: descarga archify.zip v2.16.0 y extráelo en graphify-out/archify-package');
  if (digest(fs.readFileSync(archive)) !== lock.archiveSha256) throw new Error('ARCHIFY_ARCHIVE_MISMATCH');
  if (runtimeTreeDigest(directory) !== lock.runtimeTreeSha256) throw new Error('ARCHIFY_RUNTIME_MISMATCH');
  const cli = path.join(directory, 'bin', 'archify.mjs');
  if (!fs.statSync(cli).isFile()) throw new Error('ARCHIFY_CLI_MISSING');
  return cli;
}

function sourcePath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.startsWith('/') ||
      relative.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('ARCHIFY_UNSAFE_SOURCE: ' + relative);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || fs.lstatSync(file).isSymbolicLink() || fs.realpathSync.native(file) !== file) throw new Error('ARCHIFY_REDIRECTED_SOURCE: ' + relative);
  return file;
}

export function sourceEvidence(root, specification, evidencePolicy) {
  const components = specification.components ?? [];
  const connections = specification.connections ?? [];
  if (specification.diagram_type !== 'architecture' || specification.meta?.quality_profile !== 'showcase' ||
      components.length < 8 || components.length > 12) throw new Error('ARCHIFY_SPEC_OUT_OF_SCOPE');
  const ids = (items) => items.map((item) => item.id);
  for (const [kind, items] of [['components', components], ['connections', connections]]) {
    const names = ids(items);
    if (new Set(names).size !== names.length || names.some((id) => !id)) throw new Error('ARCHIFY_DUPLICATE_ID: ' + kind);
    const definitions = evidencePolicy[kind];
    if (Object.keys(definitions ?? {}).sort(compare).join('\0') !== names.sort(compare).join('\0')) throw new Error('ARCHIFY_EVIDENCE_COVERAGE: ' + kind);
  }
  const sourceHashes = {};
  const facts = {};
  for (const kind of ['components', 'connections']) {
    facts[kind] = {};
    for (const [id, selectors] of Object.entries(evidencePolicy[kind]).sort(([a], [b]) => compare(a, b))) {
      if (!Array.isArray(selectors) || !selectors.length) throw new Error('ARCHIFY_EVIDENCE_EMPTY: ' + id);
      facts[kind][id] = selectors.map(({ path: relative, contains }) => {
        if (typeof contains !== 'string' || !contains) throw new Error('ARCHIFY_EVIDENCE_ASSERTION: ' + id);
        const file = sourcePath(root, relative);
        const bytes = fs.readFileSync(file);
        const content = bytes.toString('utf8');
        const at = content.indexOf(contains);
        if (at < 0) throw new Error('ARCHIFY_SOURCE_STALE: ' + id + ' in ' + relative);
        const sha256 = digest(bytes);
        sourceHashes[relative] = sha256;
        return { path: relative, sha256, line: content.slice(0, at).split('\n').length, assertion: contains,
          type: relative.endsWith('.mjs') || relative.endsWith('.py') ? 'CODE' : 'DOCUMENTED' };
      });
    }
  }
  return { schemaVersion: 1, kind: 'AUTHORED_EXPLANATION', components: facts.components, connections: facts.connections,
    sourceHashes: Object.fromEntries(Object.entries(sourceHashes).sort(([a], [b]) => compare(a, b))) };
}

export function inspectVisual(repo, graph, policyHash, { readFiles = false } = {}) {
  const specPath = 'docs/architecture/knowledge-lifecycle.archify.json';
  // The focused Graphify/Obsidian fixtures intentionally have no Archify source.
  if (!repo.sourcePaths.includes(specPath)) return { status: 'NOT_APPLICABLE', reason: 'No hay especificación Archify integrada en este repositorio' };
  try {
    const { lock, evidencePolicy } = visualConfig(repo.root);
    const spec = fs.readFileSync(sourcePath(repo.root, lock.specPath));
    const facts = sourceEvidence(repo.root, JSON.parse(spec), evidencePolicy);
    const cli = verifyRuntime(repo.root, lock);
    const paths = visualPaths(repo.root);
    const receipt = readJSON(paths.receipt);
    const evidence = fs.readFileSync(paths.evidence);
    const html = fs.readFileSync(paths.html);
    const svg = fs.readFileSync(paths.svg);
    const expected = {revision: repo.revision, specification: digest(spec), evidence: digest(evidence),
      archive: lock.archiveSha256, runtime: lock.runtimeTreeSha256, html: digest(html), svg: digest(svg),
      graph: graph.graphHash, corpus: graph.corpusHash, policy: policyHash};
    for (const [key, value] of Object.entries(expected)) if (receipt[key] !== value) throw new Error('ARCHIFY_STALE_' + key.toUpperCase());
    if (receipt.schemaVersion !== 1 || receipt.version !== lock.version || receipt.checksPassed !== 9 ||
        receipt.errors !== 0 || receipt.warnings !== 0) throw new Error('ARCHIFY_VALIDATION_STALE');
    const recorded = JSON.parse(evidence);
    if (JSON.stringify(recorded.sourceHashes) !== JSON.stringify(facts.sourceHashes)) throw new Error('ARCHIFY_SOURCES_CHANGED');
    if (JSON.stringify(recorded.components) !== JSON.stringify(facts.components) ||
        JSON.stringify(recorded.connections) !== JSON.stringify(facts.connections)) throw new Error('ARCHIFY_EVIDENCE_POLICY_CHANGED');
    return { status: 'CURRENT', version: lock.version, revision: repo.revision, specificationSha256: expected.specification,
      artifactSha256: expected.html, evidenceSha256: expected.evidence, graphSha256: expected.graph,
      runtime: cli, sourceCount: Object.keys(facts.sourceHashes).length,
      ...(readFiles ? { files: {
        'Mapa/knowledge-lifecycle.archify.json': spec.toString('utf8'),
        'Mapa/knowledge-lifecycle.evidence.json': evidence.toString('utf8'),
        'Mapa/knowledge-lifecycle.svg': svg.toString('utf8'),
        'Mapa/knowledge-lifecycle.html': html.toString('utf8'),
      } } : {})};
  } catch (error) { return { status: 'PENDING', reason: error.message }; }
}

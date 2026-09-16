import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function runGit(root, args, { optional = false } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0 && !optional) throw new Error(r.stderr?.trim() || r.error?.message || 'Git no disponible');
  return r.status === 0 ? r.stdout.trimEnd() : null;
}
export function repositoryState(root) {
  root = fs.realpathSync.native(root);
  if (fs.realpathSync.native(runGit(root, ['rev-parse', '--show-toplevel'])) !== root) throw new Error('Ejecuta desde la raíz del worktree');
  const revision = runGit(root, ['rev-parse', 'HEAD']);
  const branch = runGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {optional:true});
  const common = runGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const mainRoot = path.dirname(common);
  const entries = runGit(root, ['worktree', 'list', '--porcelain', '-z']).split('\0\0');
  const mainVerified = entries.some((entry) => entry.split('\0').includes('worktree ' + mainRoot.replaceAll('\\', '/'))) ||
    entries.some((entry) => entry.split('\0').some((line) => line.startsWith('worktree ') && path.resolve(line.slice(9)) === mainRoot));
  const mainRevision = runGit(root, ['rev-parse', '--verify', 'refs/heads/main'], {optional:true});
  const remoteRevision = runGit(root, ['rev-parse', '--verify', 'refs/remotes/origin/main'], {optional:true});
  const dirty = runGit(root, ['diff', '--name-only', '-z', 'HEAD', '--']).split('\0').filter(Boolean);
  const sourcePaths = runGit(root, ['ls-files', '-z']).split('\0').filter(Boolean).sort();
  const origin = runGit(root, ['remote', 'get-url', 'origin'], {optional:true}) || '';
  const repositoryUrl = origin.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
  return {root,revision,branch,mainRoot,mainVerified,mainRevision,remoteRevision,dirty,sourcePaths,repositoryUrl,
    isMain: mainVerified && root === fs.realpathSync.native(mainRoot) && branch === 'main' && revision === mainRevision && revision === remoteRevision};
}
export function loadPolicy(root) {
  const file = path.join(root, 'scripts', 'knowledge-policy.json');
  const raw = fs.readFileSync(file);
  const policy = JSON.parse(raw);
  if (policy.schemaVersion !== 1 || policy.graphifyVersion !== '0.9.61' || policy.visual?.version !== '2.16.0' ||
      policy.visual.specPath !== 'docs/architecture/knowledge-lifecycle.archify.json' || policy.vaultDirectory !== 'DTD Cargo' ||
      policy.generatedDirectory !== 'Generado' || policy.topics?.length !== 8) throw new Error('Política de conocimiento incompatible');
  const pilotDocuments = policy.semanticPilot?.documents;
  if (!/^[a-z0-9-]+$/.test(policy.semanticPilot?.id ?? '') || typeof policy.semanticPilot?.label !== 'string' ||
      !policy.semanticPilot.label || !Array.isArray(pilotDocuments) || !pilotDocuments.length ||
      new Set(pilotDocuments).size !== pilotDocuments.length ||
      pilotDocuments.join('\0') !== [...pilotDocuments].sort().join('\0') ||
      pilotDocuments.some((relative) => !documentTopic(relative, policy))) throw new Error('Alcance semántico piloto incompatible');
  const implementation = ['knowledge-sync.mjs', 'knowledge-graph.py', 'knowledge-visual.mjs',
    'lib/knowledge-state.mjs', 'lib/knowledge-projection.mjs', 'lib/knowledge-vault.mjs', 'lib/knowledge-visual.mjs']
    .map((file) => fs.readFileSync(path.join(scriptRoot, file)));
  return {policy, policyHash: sha256(Buffer.concat([raw, ...implementation]))};
}
export function documentTopic(relative, policy) {
  if (relative.includes('\\') || relative.startsWith('/') || relative.split('/').includes('..') ||
      policy.excludedPrefixes.some((prefix) => relative.startsWith(prefix)) || !policy.extensions.includes(path.posix.extname(relative))) return null;
  return policy.topics.find((topic) => topic.files?.includes(relative) || (topic.prefix && relative.startsWith(topic.prefix)))?.id || null;
}
export function resolvePython(root, explicit) {
  const candidates = [explicit, process.env.GRAPHIFY_PYTHON];
  const saved = path.join(root, 'graphify-out', '.graphify_python');
  if (fs.existsSync(saved)) candidates.push(fs.readFileSync(saved, 'utf8').replace(/^\uFEFF/, '').trim());
  candidates.push(path.join(os.homedir(), 'AppData', 'Roaming', 'uv', 'tools', 'graphifyy', 'Scripts', 'python.exe'));
  candidates.push(path.join(os.homedir(), '.local', 'share', 'uv', 'tools', 'graphifyy', 'bin', 'python'));
  const python = candidates.find((candidate) => candidate && path.isAbsolute(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!python) throw new Error('Graphify Python no localizado; usa --python <ruta absoluta> o GRAPHIFY_PYTHON');
  return python;
}
export function inspectGraph(root, {python, promptFile} = {}) {
  const args = [path.join(scriptRoot, 'knowledge-graph.py'), 'inspect', '--root', root];
  if (promptFile) args.push('--prompt-file', promptFile);
  const r = spawnSync(resolvePython(root, python), args, {cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
  let data;
  try { data = JSON.parse(r.stdout.replace(/^\uFEFF/, '')); } catch { throw new Error(r.stderr?.trim() || r.error?.message || 'Respuesta inválida del adaptador Graphify'); }
  if (r.status !== 0) throw new Error(data.error || r.stderr?.trim() || 'Falló el adaptador Graphify');
  return data;
}
export function collectDocuments(root, files, policy) {
  root = fs.realpathSync.native(root);
  const documents = [];
  for (const [relative, evidence] of Object.entries(files).sort(([a],[b])=>a.localeCompare(b,'en'))) {
    const topic = documentTopic(relative, policy);
    if (!topic) continue;
    const full = path.resolve(root, relative);
    const resolved = fs.realpathSync.native(full);
    if (resolved !== full || !resolved.startsWith(root + path.sep)) throw new Error('Fuente redirigida: ' + relative);
    const bytes = fs.readFileSync(full);
    if (sha256(bytes) !== evidence.sha256) throw new Error('La fuente cambió durante la lectura: ' + relative);
    documents.push({path:relative,content:bytes.toString('utf8'),sha256:evidence.sha256,topic});
  }
  return documents;
}
export function semanticCoverage(repo, graph, policy) {
  const targetPaths = policy.semanticPilot.documents;
  const targetSet = new Set(targetPaths);
  const tracked = new Set(repo.sourcePaths || []);
  const graphFiles = graph.files || {};
  const verifiedPaths = [...new Set(graph.semantic?.verified || [])].sort((a, b) => a.localeCompare(b, 'en'));
  const pendingPaths = [...new Set(graph.semantic?.pending || [])].sort((a, b) => a.localeCompare(b, 'en'));
  const verified = new Set(verifiedPaths);
  const documents = targetPaths.map((relative) => {
    const evidence = graphFiles[relative];
    let status = 'VERIFIED'; let reason = null;
    if (!tracked.has(relative)) { status = 'PENDING'; reason = 'not_tracked_at_revision'; }
    else if (!evidence) { status = 'PENDING'; reason = 'not_in_graph_corpus'; }
    else if (!verified.has(relative)) {
      status = 'PENDING';
      reason = graph.semantic?.pendingReasons?.[relative] || 'semantic_evidence_not_current';
    }
    return { path: relative, status, sha256: evidence?.sha256 || null, ...(reason ? { reason } : {}) };
  });
  const pilotVerified = documents.filter((document) => document.status === 'VERIFIED').length;
  const globalDocuments = new Set([...verifiedPaths, ...pendingPaths]);
  let globalStatus = graph.semantic?.status || 'UNAVAILABLE';
  if (globalStatus === 'CURRENT' && pendingPaths.length) globalStatus = 'PENDING';
  return {
    global: { status: globalStatus, totalCount: globalDocuments.size, verifiedCount: verifiedPaths.length,
      pendingCount: pendingPaths.length, outsidePilotPendingCount: pendingPaths.filter((relative) => !targetSet.has(relative)).length,
      stateHash: sha256(JSON.stringify({ verified: verifiedPaths, pending: pendingPaths })) },
    pilot: { id: policy.semanticPilot.id, label: policy.semanticPilot.label,
      status: pilotVerified === targetPaths.length ? 'CURRENT' : 'PENDING',
      targetCount: targetPaths.length, verifiedCount: pilotVerified,
      pendingCount: targetPaths.length - pilotVerified, documents },
  };
}
export function publicationProblems(repo, graph, policy, coverage = semanticCoverage(repo, graph, policy)) {
  const problems = [];
  if (!repo.isMain) problems.push('MAIN_REQUIRED: la bóveda compartida exige checkout principal main = origin/main');
  if (repo.dirty.length) problems.push('DIRTY_SOURCE: cambios rastreados pendientes');
  if (graph.version !== policy.graphifyVersion) problems.push('VERSION_MISMATCH: se requiere Graphify ' + policy.graphifyVersion);
  if (graph.structural?.status !== 'CURRENT') problems.push('STRUCTURAL_PENDING');
  if (coverage.pilot.status !== 'CURRENT') {
    const pending = coverage.pilot.documents.filter((document) => document.status !== 'VERIFIED');
    problems.push(`SEMANTIC_PILOT_PENDING: ${coverage.pilot.verifiedCount}/${coverage.pilot.targetCount}; ` +
      pending.map((document) => `${document.path} (${document.reason})`).join(', '));
  }
  if (graph.issues?.length) problems.push('GRAPH_ISSUES: ' + graph.issues.map((issue) => typeof issue === 'string' ? issue : issue.code + (issue.source ? ': ' + issue.source : '')).join('; '));
  const tracked = new Set(repo.sourcePaths);
  if (Object.keys(graph.files || {}).some((p) => !tracked.has(p))) problems.push('UNTRACKED_SOURCE: el corpus incluye archivos sin integrar');
  return problems;
}
export function publicationWarnings(repo, graph, policy, coverage = semanticCoverage(repo, graph, policy)) {
  const warnings = [];
  if (coverage.global.status !== 'CURRENT') warnings.push(
    `SEMANTIC_GLOBAL_PENDING: ${coverage.global.verifiedCount}/${coverage.global.totalCount} verificadas; ` +
    `${coverage.global.pendingCount} pendientes (${coverage.global.outsidePilotPendingCount} fuera del piloto)`
  );
  return warnings;
}
export function snapshotKey(repo, graph, policyHash) {
  return sha256(JSON.stringify({revision:repo.revision,branch:repo.branch,dirty:repo.dirty,mainRevision:repo.mainRevision,
    remoteRevision:repo.remoteRevision,corpusHash:graph.corpusHash,configHash:graph.configHash,policyHash,graphHash:graph.graphHash,
    promptHash:graph.promptHash,graphifyVersion:graph.version,structural:graph.structural,semantic:graph.semantic}));
}

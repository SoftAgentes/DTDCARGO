import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { repositoryState, loadPolicy, inspectGraph, collectDocuments, publicationProblems, snapshotKey, sha256 } from './lib/knowledge-state.mjs';
import { buildProjection } from './lib/knowledge-projection.mjs';
import { publishVault, checkVault, recoverVault } from './lib/knowledge-vault.mjs';
import { inspectVisual } from './lib/knowledge-visual.mjs';

const executorRoot = fs.realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

export function parseArgs(args) {
  const options = {command:args.shift() || 'status',root:process.cwd(),preview:false};
  if (!['status','publish','check'].includes(options.command)) throw new Error('Uso: knowledge-sync.mjs status|publish|check [--preview] [--root ruta] [--python ruta] [--prompt-file ruta]');
  while (args.length) {
    const arg = args.shift();
    if (arg === '--') continue;
    if (arg === '--preview') options.preview = true;
    else if (['--root','--python','--prompt-file'].includes(arg)) {
      const value = args.shift(); if (!value || value.startsWith('--')) throw new Error('Falta valor: ' + arg);
      options[{'--root':'root','--python':'python','--prompt-file':'promptFile'}[arg]] = value;
    } else throw new Error('Opción desconocida: ' + arg);
  }
  return options;
}
export async function run(options) {
  const repo = repositoryState(path.resolve(options.root));
  const {policy,policyHash} = loadPolicy(repo.root);
  let graph;
  try { graph = inspectGraph(repo.root, options); }
  catch (error) {
    if (options.command === 'publish') throw error;
    return {ok:false,root:repo.root,revision:repo.revision,structural:'UNAVAILABLE',semantic:'UNAVAILABLE',error:error.message};
  }
  const vaultPath = options.preview ? path.join(repo.root,'graphify-out','obsidian-preview') : path.join(repo.mainRoot, policy.vaultDirectory);
  let vault = await checkVault(vaultPath);
  const problems = publicationProblems(repo, graph, policy);
  const visual = inspectVisual(repo, graph, policyHash);
  if (visual.status === 'PENDING') problems.push('ARCHIFY_PENDING: ' + visual.reason);
  if (!options.preview && repo.root !== executorRoot) problems.unshift('EXECUTOR_MAIN_REQUIRED: ejecutar el exportador integrado desde el checkout principal');
  const visualMetadata = {status:visual.status,version:visual.version ?? null,specification:visual.specificationSha256 ?? null,
    artifact:visual.artifactSha256 ?? null,evidence:visual.evidenceSha256 ?? null};
  const current = vault.ok && vault.manifest?.metadata?.corpusHash === graph.corpusHash &&
    vault.manifest.metadata.graphHash === graph.graphHash && vault.manifest.metadata.policyHash === policyHash &&
    vault.manifest.metadata.revision === repo.revision && vault.manifest.metadata.mode === (options.preview ? 'preview':'integrated') &&
    vault.manifest.metadata.promptHash === graph.promptHash && vault.manifest.metadata.graphifyVersion === graph.version &&
    vault.manifest.metadata.structuralStatus === graph.structural.status && vault.manifest.metadata.semanticStatus === graph.semantic.status &&
    JSON.stringify(vault.manifest.metadata.visual) === JSON.stringify(visualMetadata);
  const status = {ok:problems.length === 0 && current,root:repo.root,revision:repo.revision,branch:repo.branch,
    mainRevision:repo.mainRevision,remoteTrackingRevision:repo.remoteRevision,graphifyVersion:graph.version,
    structural:graph.structural,semantic:graph.semantic,graphIssues:graph.issues,graphWarnings:graph.warnings || [],publicationProblems:problems,
    archify:visual,
    obsidian:{status:vault.conflicts?.length ? 'CONFLICT' : current ? (options.preview ? 'PREVIEW' : 'CURRENT'):'PENDING',path:vaultPath,
      revision:vault.manifest?.metadata?.revision || null,conflicts:vault.conflicts || [],warnings:vault.manifest?.metadata?.projectionWarnings || []},mode:options.preview ? 'preview':'integrated'};
  if (options.command !== 'publish') return status;
  if (!options.preview && problems.length) throw new Error(problems.join('\n'));
  if (graph.version !== policy.graphifyVersion) throw new Error('El piloto requiere Graphify ' + policy.graphifyVersion);
  if (!graph.graphHash) throw new Error('No hay grafo comprobable para publicar');
  vault = await recoverVault(vaultPath);
  if (vault.conflicts?.length) throw new Error('CONFLICT: ' + vault.conflicts.map((c) => c.path + ': ' + c.reason).join('; '));
  const bytes = fs.readFileSync(path.join(repo.root, 'graphify-out', 'graph.json'));
  if (sha256(bytes) !== graph.graphHash) throw new Error('El grafo cambió durante la lectura');
  const parsedGraph = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  const documents = collectDocuments(repo.root, graph.files || {}, policy);
  if (!documents.length) throw new Error('No hay documentos autorizados para proyectar');
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repo.repositoryUrl)) throw new Error('origin debe identificar un repositorio GitHub sin credenciales');
  const projection = buildProjection({documents,graph:parsedGraph,revision:options.preview ? 'WORKTREE:' + repo.revision : repo.revision,repositoryUrl:repo.repositoryUrl,
    policyHash,graphHash:graph.graphHash,previousManifest:vault.manifest,sourcePaths:repo.sourcePaths});
  if (visual.status === 'CURRENT') {
    const verified = inspectVisual(repo, graph, policyHash, {readFiles:true});
    if (verified.status !== 'CURRENT') throw new Error('ARCHIFY_CHANGED: repetir la publicación');
    Object.assign(projection.files, verified.files);
    projection.files['Indice.md'] += '\n## Vista visual verificada\n\nEste diagrama de diez componentes es una explicación basada en fuentes, no una relación extraída automáticamente por Graphify. [Abrir HTML interactivo](Mapa/knowledge-lifecycle.html) · [JSON visual](Mapa/knowledge-lifecycle.archify.json) · [Evidencia de código y documentos](Mapa/knowledge-lifecycle.evidence.json).\n\n![Mapa visual de conocimiento](Mapa/knowledge-lifecycle.svg)\n';
  } else if (visual.status === 'PENDING') {
    projection.files['Indice.md'] += '\n## Vista visual pendiente\n\nArchify: ' + visual.reason + '. El índice documental y el JSON del grafo indican su propia cobertura; este diagrama visual aún no representa esta revisión.\n';
  }
  // A preview carries visible limits; it never targets the shared vault.
  if (options.preview) {
    projection.files['Indice.md'] = '> **Vista previa local.** Estructura: ' + graph.structural.status + '; semántica: ' + graph.semantic.status + '. No representa la bóveda compartida integrada. Los enlaces de GitHub a esta revisión requieren que esté publicada; verifica la procedencia local mediante rutas y hashes.\n\n' + projection.files['Indice.md'];
    projection.files['LEEME-PREVIEW.md'] = '# Vista previa de una tarea\n\nRevisión: ' + repo.revision +
    '\n\nEsta salida no representa main integrado.\n\nEstructura: ' + graph.structural.status + '\n\nSemántica: ' + graph.semantic.status +
    '\n\nPendientes: ' + problems.join('; ') + '\n';
  }
  const metadata = {schemaVersion:1,revision:repo.revision,corpusHash:graph.corpusHash,policyHash,graphHash:graph.graphHash,
    graphifyVersion:graph.version,promptHash:graph.promptHash,mode:options.preview?'preview':'integrated',
    documentPaths:projection.documentPaths,structuralStatus:graph.structural.status,semanticStatus:graph.semantic.status,
    visual:visualMetadata,projectionWarnings:projection.warnings};
  const initialKey = snapshotKey(repo,graph,policyHash);
  const result = await publishVault({vaultPath,files:projection.files,metadata,expectedManifest:vault.manifest,beforeCommit: async () => {
    const latestRepo = repositoryState(repo.root);
    const latestGraph = inspectGraph(repo.root,options);
    const latestPolicy = loadPolicy(repo.root);
    const latestVisual = inspectVisual(latestRepo,latestGraph,latestPolicy.policyHash);
    if (initialKey !== snapshotKey(latestRepo,latestGraph,latestPolicy.policyHash)) throw new Error('SOURCE_CHANGED: repetir con una instantánea estable');
    if (JSON.stringify(visualMetadata) !== JSON.stringify({status:latestVisual.status,version:latestVisual.version ?? null,
      specification:latestVisual.specificationSha256 ?? null,artifact:latestVisual.artifactSha256 ?? null,
      evidence:latestVisual.evidenceSha256 ?? null})) throw new Error('ARCHIFY_CHANGED: repetir con una instantánea estable');
    if (!options.preview && publicationProblems(latestRepo,latestGraph,latestPolicy.policy).length) throw new Error('MAIN_CHANGED: publicación cancelada');
  }});
  return {...status,ok:true,published:result.changed,unchanged:!result.changed,changed:result.changed,documents:documents.length,warnings:projection.warnings,
    obsidian:{...status.obsidian,status:options.preview?'PREVIEW':'CURRENT',revision:repo.revision,conflicts:[],warnings:projection.warnings}};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await run(options);
    console.log(JSON.stringify(result,null,2));
    if (options.command === 'check' && !result.ok) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ok:false,error:error.message},null,2)); process.exitCode = 1; }
}

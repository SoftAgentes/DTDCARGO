import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { repositoryState, inspectGraph, loadPolicy } from './lib/knowledge-state.mjs';
import { visualConfig, verifyRuntime, sourceEvidence, visualPaths, inspectVisual } from './lib/knowledge-visual.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function cli(cliPath, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  let receipt;
  try { receipt = JSON.parse(result.stdout); } catch { throw new Error('Archify devolvió una respuesta inválida: ' + (result.stderr || result.stdout)); }
  if (result.status !== 0 || receipt.ok !== true) throw new Error('ARCHIFY_VALIDATION_FAILED: ' + JSON.stringify(receipt.diagnostics ?? receipt.error));
  return receipt;
}

export function extractStandaloneSVG(html) {
  const styles = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
  const diagrams = html.match(/<svg\b[\s\S]*?<\/svg>/g) ?? [];
  if (!styles || diagrams.length !== 1 || styles[1].includes(']]>')) throw new Error('ARCHIFY_SVG_EXPORT_UNAVAILABLE');
  return diagrams[0].replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg" data-theme="light"')
    .replace(/(<svg\b[^>]*>)/, '$1\n<style><![CDATA[\n' + styles[1] + '\n]]></style>');
}

export function buildVisual(repo, graph, policyHash) {
  const { lock, evidencePolicy } = visualConfig(repo.root);
  const cliPath = verifyRuntime(repo.root, lock);
  const specification = fs.readFileSync(path.join(repo.root, lock.specPath));
  const facts = sourceEvidence(repo.root, JSON.parse(specification), evidencePolicy);
  const paths = visualPaths(repo.root);
  fs.mkdirSync(path.dirname(paths.html), { recursive: true });
  const validation = cli(cliPath, ['validate', 'architecture', path.join(repo.root, lock.specPath), '--quality', 'showcase', '--json']);
  if (validation.checks?.length !== 9 || validation.composition?.summary?.errors !== 0 ||
      validation.composition?.summary?.warnings !== 0) throw new Error('ARCHIFY_SHOWCASE_INCOMPLETE');
  const delivery = cli(cliPath, ['deliver', 'architecture', path.join(repo.root, lock.specPath), paths.html, '--quality', 'showcase', '--json']);
  if (delivery.validation?.checksPassed !== 9 || delivery.validation?.errors !== 0 || delivery.validation?.warnings !== 0 ||
      delivery.specification?.sha256 !== digest(specification)) throw new Error('ARCHIFY_DELIVERY_INCOMPLETE');
  const html = fs.readFileSync(paths.html);
  const svg = extractStandaloneSVG(html.toString('utf8'));
  const evidence = JSON.stringify({ ...facts, revision: repo.revision, graphSha256: graph.graphHash,
    graphStructural: graph.structural.status, graphSemantic: graph.semantic.status }, null, 2) + '\n';
  for (const [file, content] of [[paths.svg, svg], [paths.evidence, evidence]]) {
    fs.writeFileSync(file + '.tmp', content, 'utf8');
    fs.renameSync(file + '.tmp', file);
  }
  const receipt = {schemaVersion:1,version:lock.version,revision:repo.revision,specification:digest(specification),
    evidence:digest(evidence),archive:lock.archiveSha256,runtime:lock.runtimeTreeSha256,html:digest(html),svg:digest(svg),
    graph:graph.graphHash,corpus:graph.corpusHash,policy:policyHash,checksPassed:9,errors:0,warnings:0,
    graphStructural:graph.structural.status,graphSemantic:graph.semantic.status};
  fs.writeFileSync(paths.receipt + '.tmp', JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  fs.renameSync(paths.receipt + '.tmp', paths.receipt);
  return { ...inspectVisual(repo, graph, policyHash), checksPassed: 9,
    graphStructural: graph.structural.status, graphSemantic: graph.semantic.status };
}

export function parseVisualArgs(args) {
  const options = { command: args.shift() || 'status', root: process.cwd() };
  if (!['status', 'build', 'check'].includes(options.command)) throw new Error('Uso: knowledge-visual.mjs status|build|check [--root ruta] [--python ruta] [--prompt-file ruta]');
  while (args.length) {
    const option = args.shift();
    if (!['--root','--python','--prompt-file'].includes(option)) throw new Error('Opción desconocida: ' + option);
    const value = args.shift();
    if (!value || value.startsWith('--')) throw new Error('Falta valor: ' + option);
    options[{'--root':'root','--python':'python','--prompt-file':'promptFile'}[option]] = value;
  }
  return options;
}

export function runVisual(options) {
  const repo = repositoryState(path.resolve(options.root));
  const graph = inspectGraph(repo.root, options);
  const { policyHash } = loadPolicy(repo.root);
  const state = options.command === 'build' ? buildVisual(repo, graph, policyHash) : inspectVisual(repo, graph, policyHash);
  return { ...state, ok: state.status === 'CURRENT', revision: repo.revision,
    graphStructural: graph.structural.status, graphSemantic: graph.semantic.status };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseVisualArgs(process.argv.slice(2));
    const result = runVisual(options);
    console.log(JSON.stringify(result, null, 2));
    if (options.command === 'check' && !result.ok) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ok:false,status:'PENDING',error:error.message}, null, 2)); process.exitCode = 1; }
}

import path from 'node:path';
import { createHash } from 'node:crypto';

export const TOPICS = Object.freeze([
  ['proyecto', 'Proyecto'], ['arquitectura', 'Arquitectura'],
  ['especificaciones', 'Especificaciones'], ['runbooks', 'Runbooks'],
  ['ingenieria', 'Ingeniería'], ['gobernanza', 'Gobernanza'],
  ['marketing', 'Marketing'], ['handoffs', 'Handoffs'],
].map(([id, label]) => ({ id, label })));
const digest = (text) => createHash('sha256').update(text).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const posix = (p) => p.replaceAll('\\', '/');
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');
const markdownLabel = (text) => String(text).replace(/[\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ');

function sourcePath(value) {
  const p = posix(String(value));
  if (!p || p.startsWith('/') || /^[a-z]:/i.test(p) || p.split('/').some((s) => !s || s === '.' || s === '..' || /[:<>"|?*\x00-\x1f]/.test(s))) {
    throw new Error(`Unsafe source path: ${value}`);
  }
  return p;
}

// Obsidian does not index dot-folders, and .mdx is not a native Markdown note.
// Source identities stay unchanged; this function alone defines visible note paths.
function notePathForSource(value) {
  const source = sourcePath(value);
  // Only the two policy-approved skills receive a visible mapping. Other
  // hidden .agents content still requires an explicit selection and mapping.
  const approvedSkills = new Set(['.agents/skills/director/SKILL.md', '.agents/skills/worker/SKILL.md']);
  let visible = source.startsWith('.agents/handoffs/') || approvedSkills.has(source)
    ? `Agentes/${source.slice('.agents/'.length)}` : source;
  if (visible.split('/').some((segment) => segment.startsWith('.'))) throw new Error(`Hidden source has no approved Obsidian mapping: ${source}`);
  if (/\.mdx$/i.test(visible)) visible += '.md';
  return `Documentacion/${visible}`;
}
function topicFor(document) {
  const supplied = String(document.topic ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const match = TOPICS.find((t) => t.id === supplied);
  if (match) return match.id;
  const p = document.path;
  for (const [prefix, topic] of [
    ['docs/architecture/', 'arquitectura'], ['docs/specs/', 'especificaciones'],
    ['docs/runbooks/', 'runbooks'], ['docs/engineering/', 'ingenieria'],
    ['docs/governance/', 'gobernanza'], ['docs/marketing/', 'marketing'],
    ['.agents/handoffs/', 'handoffs'],
  ]) if (p.startsWith(prefix)) return topic;
  return 'proyecto';
}

function canonicalUrl(repositoryUrl, revision, target, fragment = '') {
  if (!repositoryUrl) return null;
  const base = repositoryUrl.replace(/\.git$/, '').replace(/\/$/, '');
  if (!/^https:\/\/[^/]+\/[^/]+\/[^/]+$/.test(base)) throw new Error('repositoryUrl must be an HTTPS repository URL');
  return `${base}/blob/${encodeURIComponent(revision.replace(/^WORKTREE:/, ''))}/${encodePath(target)}${fragment}`;
}

// Deliberately keeps code examples untouched. An unmatched inline backtick span is also
// preserved rather than interpreting its examples as links.
function outsideInlineCode(text, transform) {
  let out = ''; let start = 0; const re = /`+/g; let match;
  while ((match = re.exec(text))) {
    out += transform(text.slice(start, match.index));
    const delimiter = match[0]; let end = text.indexOf(delimiter, re.lastIndex);
    while (end !== -1 && (text[end - 1] === '`' || text[end + delimiter.length] === '`')) end = text.indexOf(delimiter, end + 1);
    if (end === -1) return out + text.slice(match.index);
    out += text.slice(match.index, end + delimiter.length);
    start = end + delimiter.length; re.lastIndex = start;
  }
  return out + transform(text.slice(start));
}

function rewriteLinks(content, document, documents, sourcePaths, revision, repositoryUrl, warnings) {
  const outputPath = documents.get(document.path).output;
  const sourceSet = new Set(sourcePaths);
  function rewrite(raw, wiki = false) {
    const angle = raw.startsWith('<') && raw.endsWith('>');
    const url = angle ? raw.slice(1, -1) : raw;
    if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(url)) return raw;
    const split = url.search(/[?#]/); const pathname = split < 0 ? url : url.slice(0, split);
    const suffix = split < 0 ? '' : url.slice(split);
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { warnings.push({ type: 'invalid-link-encoding', source: document.path, target: url }); return raw; }
    decoded = posix(decoded);
    let candidate = path.posix.normalize(decoded.startsWith('/') ? decoded.slice(1) : path.posix.join(path.posix.dirname(document.path), decoded));
    if (candidate === '..' || candidate.startsWith('../') || candidate.includes(':')) {
      warnings.push({ type: 'link-outside-repository', source: document.path, target: url }); return raw;
    }
    const variants = (p) => [p, ...(!path.posix.extname(p) ? [`${p}.md`] : []), `${p.replace(/\/$/, '')}/README.md`];
    let targets = variants(candidate).filter((p) => documents.has(p) || sourceSet.has(p));
    if (!targets.length && wiki) {
      targets = variants(decoded).filter((p) => documents.has(p) || sourceSet.has(p));
      if (!targets.length) {
        const wanted = decoded.replace(/\.md$/, '');
        targets = [...new Set([...documents.keys(), ...sourceSet])].filter((p) => p.replace(/\.md$/, '') === wanted || path.posix.basename(p, '.md') === wanted);
      }
    }
    if (targets.length > 1 && !targets.includes(candidate)) {
      warnings.push({ type: 'ambiguous-link', source: document.path, target: url }); return raw;
    }
    candidate = targets.includes(candidate) ? candidate : targets[0] ?? candidate;
    if (documents.has(candidate)) {
      const relative = path.posix.relative(path.posix.dirname(outputPath), documents.get(candidate).output);
      return `<${encodePath(relative)}${suffix}>`;
    }
    if (!sourceSet.has(candidate)) {
      warnings.push({ type: 'missing-link-target', source: document.path, target: url, resolved: candidate });
      // Keep a visible unresolved note reference; never fabricate a source document.
      return raw;
    }
    const canonical = canonicalUrl(repositoryUrl, revision, candidate, suffix);
    if (!canonical) { warnings.push({ type: 'missing-repository-url', source: document.path, target: url }); return raw; }
    return `<${canonical}>`;
  }
  function rewriteText(text) {
    // Definitions: [id]: destination "optional title".
    text = text.replace(/^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]+>|\S+)(.*)$/gm, (_m, before, destination, after) => before + rewrite(destination) + after);
    // Scan destination parentheses with balanced nesting, preserving optional titles.
    let output = ''; let cursor = 0; const opener = /(!?\[[^\]\n]*\]\()[ \t]*/g; let match;
    while ((match = opener.exec(text))) {
      const begin = opener.lastIndex; let end = begin; let depth = 0; let angled = false;
      if (text[begin] === '<') {
        end = text.indexOf('>', begin + 1); if (end < 0) continue; end += 1; angled = true;
      } else {
        for (; end < text.length; end += 1) {
          const c = text[end];
          if (c === '\\') { end += 1; continue; }
          if (c === '(') depth += 1;
          if (c === ')' && depth-- === 0) break;
          if (/\s/.test(c) && depth === 0) break;
        }
      }
      let close = end;
      if (text[close] !== ')') {
        const rest = text.slice(close).match(/^[ \t]*(?:"[^"\n]*"|'[^'\n]*'|\([^\n]*?\))[ \t]*\)/);
        if (!rest) { if (angled && /^\s*\)/.test(text.slice(close))) close += text.slice(close).match(/^\s*/)[0].length; else continue; }
        else close += rest[0].length - 1;
      }
      if (text[close] !== ')') continue;
      const rewritten = rewrite(text.slice(begin, end));
      const before = text.slice(cursor, begin);
      output += (match[1].startsWith('!') && rewritten.includes('/blob/') ? before.slice(0, match.index - cursor) + before.slice(match.index - cursor + 1) : before) + rewritten + text.slice(end, close + 1);
      cursor = close + 1; opener.lastIndex = cursor;
    }
    output += text.slice(cursor);
    return output.replace(/(!?)\[\[([^\]\n]+)\]\]/g, (_m, embed, inner) => {
      const pipe = inner.indexOf('|'); const target = pipe < 0 ? inner : inner.slice(0, pipe);
      const label = pipe < 0 ? target : inner.slice(pipe + 1);
      const rewritten = rewrite(target, true);
      if (rewritten === target && !target.startsWith('#')) return _m;
      // Attachments are linked to their canonical source, never fetched/copied.
      const prefix = rewritten.includes('/blob/') ? '' : embed;
      return `${prefix}[${markdownLabel(label)}](${rewritten})`;
    });
  }
  let fence = null; let prose = ''; let result = '';
  const flush = () => { result += outsideInlineCode(prose, rewriteText); prose = ''; };
  for (const line of content.split(/(?<=\n)/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && /^\s*$/.test(line.slice(marker[0].length))) fence = null;
      result += line; continue;
    }
    if (marker) { flush(); fence = { char: marker[1][0], length: marker[1].length }; result += line; continue; }
    if (/^(?: {4}|\t)/.test(line)) { flush(); result += line; continue; }
    prose += line;
  }
  flush(); return result;
}

/** Build deterministic, file-level views. This function never changes a vault. */
export function buildProjection({ documents, graph, revision, repositoryUrl, policyHash, graphHash, previousManifest, sourcePaths = [] }) {
  if (!Array.isArray(documents) || !graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links ?? graph.edges)) throw new Error('Expected documents and graph nodes/links arrays');
  if (!/^(?:WORKTREE:)?[a-f0-9]{7,64}$/i.test(revision ?? '')) throw new Error('Expected an immutable Git revision');
  const warnings = []; const files = {}; const docs = new Map(); const casePaths = new Set(); const outputPaths = new Set();
  for (const document of [...documents].sort((a, b) => compare(a.path, b.path))) {
    const p = sourcePath(document.path); const folded = p.toLowerCase();
    if (casePaths.has(folded)) throw new Error(`Duplicate/case-colliding document: ${p}`);
    if (typeof document.content !== 'string') throw new Error(`Missing document content: ${p}`);
    if (document.sha256 && document.sha256 !== digest(document.content)) throw new Error(`Document hash mismatch: ${p}`);
    casePaths.add(folded);
    const output = notePathForSource(p);
    if (outputPaths.has(output.toLowerCase())) throw new Error(`Duplicate/case-colliding Obsidian note: ${output}`);
    outputPaths.add(output.toLowerCase());
    docs.set(p, { ...document, path: p, sha256: digest(document.content), output, topic: topicFor({ ...document, path: p }) });
  }
  const knownPaths = [...new Set([...sourcePaths.map(sourcePath), ...docs.keys()])];
  const documentPaths = {};
  for (const document of docs.values()) {
    documentPaths[document.path] = { path: document.output, sha256: document.sha256 };
    const canonical = canonicalUrl(repositoryUrl, revision, document.path);
    const notice = `> Vista generada de ${canonical ? `[${markdownLabel(document.path)}](${canonical})` : markdownLabel(document.path)}. Revisión: \`${revision}\`. Edita el original o guarda tus notas fuera de Generado.\n\n`;
    const frontmatter = document.content.match(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/);
    const prefix = frontmatter?.[0] ?? '';
    const body = rewriteLinks(document.content.slice(prefix.length), document, docs, knownPaths, revision, repositoryUrl, warnings);
    files[document.output] = prefix + notice + body;
  }
  const prior = previousManifest?.metadata?.documentPaths ?? {};
  for (const [oldSource, raw] of Object.entries(prior).sort(([a], [b]) => compare(a, b))) {
    if (docs.has(oldSource)) continue;
    const entry = typeof raw === 'string' ? { path: raw } : raw;
    if (entry.path !== notePathForSource(oldSource)) throw new Error(`Invalid previous document mapping: ${oldSource}`);
    const replacement = entry.movedTo && docs.has(entry.movedTo) ? [docs.get(entry.movedTo)] : [...docs.values()].filter((d) => !Object.hasOwn(prior, d.path) && d.sha256 === entry.sha256);
    const destination = replacement.length === 1 ? replacement[0] : null;
    const redirect = destination ? `El documento se trasladó a [${markdownLabel(destination.path)}](<${encodePath(path.posix.relative(path.posix.dirname(entry.path), destination.output))}>).` : 'Este documento fue retirado del conjunto publicado. Su contenido anterior permanece en la historia del repositorio.';
    files[entry.path] = `# Documento ${destination ? 'trasladado' : 'retirado'}\n\n${redirect}\n\nFuente anterior: \`${oldSource}\`. Revisión comprobada: \`${revision}\`.\n`;
    documentPaths[oldSource] = { ...entry, retired: true, ...(destination ? { movedTo: destination.path } : {}) };
  }
  const graphNodes = new Map(graph.nodes.map((n) => [n.id, n]));
  if (graphNodes.size !== graph.nodes.length) throw new Error('Duplicate graph node IDs');
  const matchDocument = (source) => {
    if (typeof source !== 'string') return null;
    const p = posix(source).replace(/^\.\//, '');
    if (docs.has(p)) return p;
    if (p.startsWith('/') || /^[a-z]:\//i.test(p)) {
      const matches = [...docs.keys()].filter((d) => p.endsWith(`/${d}`));
      if (matches.length === 1) return matches[0];
    }
    return null;
  };
  const relations = new Map();
  for (const [index, edge] of (graph.links ?? graph.edges).entries()) {
    const source = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const target = typeof edge.target === 'object' ? edge.target.id : edge.target;
    if (!graphNodes.has(source) || !graphNodes.has(target)) throw new Error(`Dangling graph edge ${index}`);
    const sourceDocument = matchDocument(graphNodes.get(source).source_file);
    const targetDocument = matchDocument(graphNodes.get(target).source_file);
    if (!sourceDocument || !targetDocument || sourceDocument === targetDocument) continue;
    const confidence = ['EXTRACTED', 'INFERRED', 'AMBIGUOUS'].includes(edge.confidence) ? edge.confidence : null;
    if (!confidence) warnings.push({ type: 'missing-graph-confidence', edge: index });
    const relation = edge.relation ?? edge.label ?? 'related';
    const key = JSON.stringify([sourceDocument, targetDocument, relation, confidence]);
    if (!relations.has(key)) relations.set(key, { id: `relation:${digest(key).slice(0, 20)}`, source: `document:${sourceDocument}`, target: `document:${targetDocument}`, relation, confidence, evidence: [] });
    const evidence = { sourceNode: source, targetNode: target, edgeIndex: index };
    for (const field of ['source_file', 'source_location', 'confidence_score', 'context', '_origin']) if (edge[field] !== undefined) evidence[field] = edge[field];
    relations.get(key).evidence.push(evidence);
  }
  const map = {
    schemaVersion: 1, revision, policyHash, graphHash, directed: Boolean(graph.directed),
    topics: TOPICS.map((topic) => ({ id: `topic:${topic.id}`, label: topic.label })),
    documents: [...docs.values()].map((d) => ({ id: `document:${d.path}`, path: d.path, note: d.output, topic: `topic:${d.topic}`, sha256: d.sha256 })),
    classifications: [...docs.values()].map((d) => ({ source: `topic:${d.topic}`, target: `document:${d.path}`, relation: 'contains', confidence: 'CLASSIFICATION', rule: 'canonical-directory' })),
    relations: [...relations.values()].sort((a, b) => compare(a.id, b.id)),
  };
  files['Mapa/mapa.json'] = JSON.stringify(map, null, 2) + '\n';
  const counts = new Map(TOPICS.map((t) => [t.id, [...docs.values()].filter((d) => d.topic === t.id).length]));
  const themePairs = new Map();
  for (const relation of map.relations) {
    const a = docs.get(relation.source.slice('document:'.length)).topic;
    const b = docs.get(relation.target.slice('document:'.length)).topic;
    if (a === b) continue;
    const key = [a, b].sort(compare).join(':'); themePairs.set(key, (themePairs.get(key) ?? 0) + 1);
  }
  files['Indice.md'] = `# Conocimiento de DTD Cargo\n\nRevisión fuente: \`${revision}\`. Las notas de Documentacion son copias de lectura. Tus notas personales permanecen fuera de Generado.\n\n## Mapa de ocho temas\n\n\`\`\`mermaid\ngraph TD\n${TOPICS.map((t) => `  ${t.id}["${t.label} · ${counts.get(t.id)} ${counts.get(t.id) === 1 ? 'documento' : 'documentos'}"]`).join('\n')}\n${[...themePairs].sort(([a], [b]) => compare(a, b)).map(([pair, count]) => { const [a, b] = pair.split(':'); return `  ${a} ---|"${count} ${count === 1 ? 'relación documental' : 'relaciones documentales'}"| ${b}`; }).join('\n')}\n\`\`\`\n\nLas líneas resumen relaciones del grafo; consulta su evidencia y grado de confianza en el JSON. La clasificación en temas procede de las carpetas canónicas.\n\n${TOPICS.map((t) => `- [${t.label}](Mapa/${t.id}.md): ${counts.get(t.id)} ${counts.get(t.id) === 1 ? 'documento' : 'documentos'}.`).join('\n')}\n\n[Mapa reproducible y evidencia](Mapa/mapa.json)\n`;
  for (const topic of TOPICS) {
    const members = [...docs.values()].filter((d) => d.topic === topic.id);
    const relevant = map.relations.filter((r) => docs.get(r.source.slice(9)).topic === topic.id || docs.get(r.target.slice(9)).topic === topic.id);
    const link = (source) => `[${markdownLabel(source)}](<${encodePath(path.posix.relative('Mapa', docs.get(source).output))}>)`;
    files[`Mapa/${topic.id}.md`] = `# ${topic.label}\n\n[Índice de conocimiento](../Indice.md) · Revisión \`${revision}\`\n\n## Documentos\n\n${members.length ? members.map((d) => `- ${link(d.path)}`).join('\n') : 'No hay documentos incluidos en este tema.'}\n\n## Relaciones entre documentos\n\n${relevant.length ? relevant.map((r) => `- ${link(r.source.slice(9))} → ${link(r.target.slice(9))}: ${markdownLabel(r.relation)} · ${r.confidence ?? 'SIN CLASIFICAR'} · ${r.evidence.length} evidencia(s), ID \`${r.id}\`.`).join('\n') : 'El grafo no aporta relaciones entre documentos de este tema.'}\n\n[Evidencias completas](mapa.json)\n`;
  }
  return { files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => compare(a, b))), warnings, documentPaths };
}

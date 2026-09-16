import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildProjection, TOPICS } from '../lib/knowledge-projection.mjs';
import { publishVault, checkVault, recoverVault } from '../lib/knowledge-vault.mjs';

const sha = (content) => createHash('sha256').update(content).digest('hex');
const revision = 'a'.repeat(40);
const repositoryUrl = 'https://github.com/example/project';
const options = { revision, repositoryUrl, policyHash: 'policy', graphHash: 'graph' };
const document = (p, content, topic) => ({ path: p, content, sha256: sha(content), topic });
const emptyGraph = { nodes: [], links: [] };
async function fixture(t) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dtd-knowledge-test-'));
  t.after(async () => { await fs.rm(temp, { recursive: true, force: true }); });
  return temp;
}
const output = (root, relative) => path.join(root, 'Generado', ...relative.split('/'));
const read = (root, relative) => fs.readFile(output(root, relative), 'utf8');

// The projection consumes evidence; no source text is converted into relationships.
test('eight topic map preserves graph evidence, source text, frontmatter and code examples', () => {
  const body = '---\nowner: Director\n---\n# A\n\n[B](b.md#detail)\n`[code](b.md)`\n\n```md\n[example](b.md)\n```\n\n[[b#detail|B wiki]]\n\n[ref]: b.md "title"\n[See][ref]\n[Module](../../lib/module.ts#L4)\n';
  const docs = [document('docs/architecture/a.md', body), document('docs/architecture/b.md', '# B\n\n## detail\n')];
  const graph = { directed: true, nodes: [{ id: 'a', source_file: docs[0].path }, { id: 'b', source_file: docs[1].path }], links: [{ source: 'a', target: 'b', relation: 'depends_on', confidence: 'INFERRED', confidence_score: 0.8, source_file: docs[0].path, source_location: 'L5' }] };
  const result = buildProjection({ ...options, documents: docs, graph, sourcePaths: [...docs.map((d) => d.path), 'lib/module.ts'] });
  const note = result.files['Documentacion/docs/architecture/a.md'];
  assert.ok(note.startsWith('---\nowner: Director\n---\n'));
  assert.match(note, /\[B\]\(<b.md#detail>\)/);
  assert.match(note, /`\[code\]\(b.md\)`/);
  assert.match(note, /```md\n\[example\]\(b.md\)\n```/);
  assert.match(note, /\[B wiki\]\(<b.md#detail>\)/);
  assert.match(note, /\[ref\]: <b.md> "title"/);
  assert.ok(note.includes(`/blob/${revision}/lib/module.ts#L4`));
  assert.equal(result.warnings.length, 0);
  const map = JSON.parse(result.files['Mapa/mapa.json']);
  assert.equal(map.topics.length, 8); assert.equal(TOPICS.length, 8);
  assert.equal(map.classifications[0].confidence, 'CLASSIFICATION');
  assert.equal(map.relations[0].confidence, 'INFERRED');
  assert.equal(map.relations[0].evidence[0].source_location, 'L5');
  assert.equal(map.relations[0].evidence[0].confidence_score, 0.8);
  assert.equal(map.relations.length, 1);
  assert.deepEqual(result, buildProjection({ ...options, documents: docs, graph, sourcePaths: [...docs.map((d) => d.path), 'lib/module.ts'] }));
});

test('missing and ambiguous targets remain visible without fabricated content or evidence', () => {
  const docs = [document('README.md', '[missing](missing.md)\n[[shared]]\n'), document('docs/architecture/shared.md', '# One\n'), document('docs/runbooks/shared.md', '# Two\n')];
  const projected = buildProjection({ ...options, documents: docs, graph: emptyGraph });
  assert.deepEqual(projected.warnings.map((w) => w.type), ['missing-link-target', 'ambiguous-link']);
  assert.ok(projected.files['Documentacion/README.md'].includes('[missing](missing.md)'));
  assert.equal(JSON.parse(projected.files['Mapa/mapa.json']).relations.length, 0);
  assert.equal(projected.files['Documentacion/missing.md'], undefined);
});

test('renamed and retired documents leave stable notices for personal backlinks', () => {
  const original = document('docs/architecture/old.md', '# Stable body\n');
  const previous = buildProjection({ ...options, documents: [original], graph: emptyGraph });
  const renamed = document('docs/architecture/new.md', original.content);
  const result = buildProjection({ ...options, documents: [renamed], graph: emptyGraph, previousManifest: { metadata: { documentPaths: previous.documentPaths } } });
  assert.match(result.files['Documentacion/docs/architecture/old.md'], /trasladó.*new.md/);
  assert.equal(result.documentPaths[original.path].retired, true);
  const retired = buildProjection({ ...options, documents: [], graph: emptyGraph, previousManifest: { metadata: { documentPaths: result.documentPaths } } });
  assert.match(retired.files['Documentacion/docs/architecture/old.md'], /retirado/);
  assert.match(retired.files['Documentacion/docs/architecture/new.md'], /retirado/);
});

test('changed YAML changes provenance; malformed graph or mismatched source hashes fail', () => {
  const a = document('README.md', '---\nstatus: proposed\n---\n# Body\n');
  const b = document('README.md', '---\nstatus: approved\n---\n# Body\n');
  const one = buildProjection({ ...options, documents: [a], graph: emptyGraph });
  const two = buildProjection({ ...options, documents: [b], graph: emptyGraph });
  assert.notEqual(one.documentPaths['README.md'].sha256, two.documentPaths['README.md'].sha256);
  assert.throws(() => buildProjection({ ...options, documents: [{ ...a, sha256: b.sha256 }], graph: emptyGraph }), /hash mismatch/);
  assert.throws(() => buildProjection({ ...options, documents: [a], graph: { nodes: [{ id: 'a' }], links: [{ source: 'a', target: 'absent' }] } }), /Dangling/);
});

test('publication is idempotent and leaves unknown personal files untouched', async (t) => {
  const vault = await fixture(t); await fs.writeFile(path.join(vault, 'Personal.md'), '# private');
  const projection = buildProjection({ ...options, documents: [document('README.md', '# Hello\n')], graph: emptyGraph });
  const metadata = { revision, documentPaths: projection.documentPaths };
  const first = await publishVault({ vaultPath: vault, files: projection.files, metadata });
  const before = (await fs.stat(output(vault, 'Indice.md'))).mtimeMs;
  assert.equal(first.changed, true);
  const second = await publishVault({ vaultPath: vault, files: projection.files, metadata });
  assert.equal(second.changed, false);
  assert.equal((await fs.stat(output(vault, 'Indice.md'))).mtimeMs, before);
  assert.equal(await fs.readFile(path.join(vault, 'Personal.md'), 'utf8'), '# private');
  assert.equal((await checkVault(vault)).ok, true);
});

test('manual edits, missing notes and unowned destinations block overwrite', async (t) => {
  const vault = await fixture(t);
  await publishVault({ vaultPath: vault, files: { 'Documentacion/a.md': 'original' } });
  await fs.writeFile(output(vault, 'Documentacion/a.md'), 'manual');
  const state = await checkVault(vault); assert.equal(state.ok, false);
  assert.equal(state.conflicts[0].reason, 'MODIFIED_MANAGED_FILE');
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Documentacion/a.md': 'updated' } }), { code: 'VAULT_CONFLICT' });
  assert.equal(await read(vault, 'Documentacion/a.md'), 'manual');
  await fs.writeFile(output(vault, 'Documentacion/a.md'), 'original');
  await fs.rename(output(vault, 'Documentacion/a.md'), output(vault, 'Documentacion/renamed.md'));
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Documentacion/a.md': 'updated' } }), { code: 'VAULT_CONFLICT' });
  await fs.rename(output(vault, 'Documentacion/renamed.md'), output(vault, 'Documentacion/a.md'));
  await fs.writeFile(output(vault, 'Documentacion/other.md'), 'user note');
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Documentacion/a.md': 'original', 'Documentacion/other.md': 'generator' } }), { code: 'VAULT_CONFLICT' });
  assert.equal(await read(vault, 'Documentacion/other.md'), 'user note');
});

test('async validation failure and concurrent writers preserve the previous complete output', async (t) => {
  const vault = await fixture(t);
  await publishVault({ vaultPath: vault, files: { 'Indice.md': 'baseline' } });
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Indice.md': 'new' }, beforeCommit: async () => { throw new Error('semantic extraction failed'); } }), /semantic extraction failed/);
  assert.equal(await read(vault, 'Indice.md'), 'baseline');
  assert.equal((await checkVault(vault)).ok, true);
  let resolveGate; let arrived;
  const gate = new Promise((resolve) => { resolveGate = resolve; });
  const waiting = new Promise((resolve) => { arrived = resolve; });
  const first = publishVault({ vaultPath: vault, files: { 'Indice.md': 'first' }, beforeCommit: async () => { arrived(); await gate; } });
  await waiting;
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Indice.md': 'second' } }), { code: 'LOCKED' });
  resolveGate(); await first;
  assert.equal(await read(vault, 'Indice.md'), 'first');
  assert.equal((await checkVault(vault)).ok, true);
});

test('manual changes during async source validation are preserved', async (t) => {
  const vault = await fixture(t);
  await publishVault({ vaultPath: vault, files: { 'Indice.md': 'baseline' } });
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Indice.md': 'new' }, beforeCommit: async () => { await fs.writeFile(output(vault, 'Indice.md'), 'manual while validating'); } }), { code: 'VAULT_CONFLICT' });
  assert.equal(await read(vault, 'Indice.md'), 'manual while validating');
  assert.equal((await fs.readdir(vault)).some((p) => p.startsWith('.knowledge-stage-')), false);
});

test('paths are confined and Windows name/case collisions are rejected', async (t) => {
  const vault = await fixture(t);
  for (const unsafe of ['../outside.md', 'C:/outside.md', 'Dir/../outside.md', 'nul.md', 'a./x.md', 'A\\B.md', '.knowledge-manifest.json']) {
    await assert.rejects(publishVault({ vaultPath: vault, files: { [unsafe]: 'bad' } }), { code: 'UNSAFE_PATH' });
  }
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'A.md': 'one', 'a.md': 'two' } }), { code: 'UNSAFE_PATH' });
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'dir': 'file', 'dir/file.md': 'other' } }), { code: 'UNSAFE_PATH' });
  assert.deepEqual(await fs.readdir(vault), []);
});

test('junction/symlink destinations are rejected without touching the target', async (t) => {
  const temp = await fixture(t); const vault = path.join(temp, 'vault'); const outside = path.join(temp, 'outside');
  await fs.mkdir(vault); await fs.mkdir(outside);
  try { await fs.symlink(outside, path.join(vault, 'Generado'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Host does not permit fixture symlinks'); return; } throw error; }
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Indice.md': 'bad' } }), { code: 'UNSAFE_PATH' });
  assert.deepEqual(await fs.readdir(outside), []);
});

test('interrupted transaction is rolled back on next publication; user conflicts stop recovery', async (t) => {
  const vault = await fixture(t); const stage = '.knowledge-stage-00000000-0000-0000-0000-000000000001';
  await publishVault({ vaultPath: vault, files: { 'Indice.md': 'baseline' } });
  await fs.mkdir(path.join(vault, stage, 'backups'), { recursive: true }); await fs.mkdir(path.join(vault, stage, 'next'));
  await fs.writeFile(path.join(vault, stage, 'backups', '0'), 'baseline');
  await fs.writeFile(output(vault, 'Indice.md'), 'interrupted replacement');
  const journal = { schemaVersion: 1, publisher: 'dtd-knowledge-v1', vault: path.resolve(vault), stage, entries: [{ relative: 'Indice.md', before: sha('baseline'), after: sha('interrupted replacement'), backup: 'backups/0', next: 'next/0' }] };
  await fs.writeFile(path.join(vault, '.knowledge-journal.json'), JSON.stringify(journal));
  assert.equal((await checkVault(vault)).ok, false);
  const recovered = await publishVault({ vaultPath: vault, files: { 'Indice.md': 'baseline' } });
  assert.equal(recovered.recovered, true); assert.equal(recovered.changed, false);
  assert.equal(await read(vault, 'Indice.md'), 'baseline');
  await fs.mkdir(path.join(vault, stage, 'backups'), { recursive: true }); await fs.mkdir(path.join(vault, stage, 'next'));
  await fs.writeFile(path.join(vault, stage, 'backups', '0'), 'baseline');
  await fs.writeFile(path.join(vault, '.knowledge-journal.json'), JSON.stringify(journal));
  await fs.writeFile(output(vault, 'Indice.md'), 'user intervened');
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Indice.md': 'new' } }), { code: 'RECOVERY_CONFLICT' });
  assert.equal(await read(vault, 'Indice.md'), 'user intervened');
  assert.equal(await fs.readFile(path.join(vault, stage, 'backups', '0'), 'utf8'), 'baseline');
});


test('worktree previews identify their revision and link attachments without copying or embedding', () => {
  const preview = buildProjection({ ...options, revision: 'WORKTREE:' + revision, documents: [document('README.md', '# Preview\n\n![Diagram](assets/map.png)\n')], graph: emptyGraph, sourcePaths: ['README.md', 'assets/map.png'] });
  const note = preview.files['Documentacion/README.md'];
  assert.ok(note.includes('WORKTREE:' + revision));
  assert.ok(note.includes('/blob/' + revision + '/assets/map.png'));
  assert.ok(note.includes('[Diagram](<https://'));
  assert.ok(!note.includes('![Diagram]'));
  assert.equal(preview.files['Documentacion/assets/map.png'], undefined);
});

test('failed replacement after manifest write rolls back the complete prior snapshot', async (t) => {
  const vault = await fixture(t);
  await publishVault({ vaultPath: vault, files: { 'Indice.md': 'baseline', 'other.md': 'old' } });
  const manifestBefore = await read(vault, '.knowledge-manifest.json');
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Indice.md': 'new', 'other.md': 'new' }, beforeCommit: async () => {
    const stage = (await fs.readdir(vault)).find((name) => name.startsWith('.knowledge-stage-'));
    await fs.writeFile(path.join(vault, stage, 'next', '1'), 'corrupted temporary output');
  } }), { code: 'STAGE_CONFLICT' });
  assert.equal(await read(vault, 'Indice.md'), 'baseline');
  assert.equal(await read(vault, 'other.md'), 'old');
  assert.equal(await read(vault, '.knowledge-manifest.json'), manifestBefore);
  assert.equal((await checkVault(vault)).ok, true);
  assert.equal((await fs.readdir(vault)).some((name) => name.startsWith('.knowledge-')), false);
});

test('inline code spanning lines and longer fenced delimiters retain literal links', () => {
  const body = '# Links\n\n`first line\n[example](b.md)`\n\n~~~~md\n[example](b.md)\n~~~\n[still code](b.md)\n~~~~\n\n[real](b.md)\n';
  const projection = buildProjection({ ...options, documents: [document('a.md', body), document('b.md', '# B')], graph: emptyGraph });
  const note = projection.files['Documentacion/a.md'];
  assert.equal((note.match(/\[example\]\(b.md\)/g) ?? []).length, 2);
  assert.ok(note.includes('[still code](b.md)'));
  assert.ok(note.includes('[real](<b.md>)'));
});

test('explicit recovery returns the previous manifest before building retirement notices', async (t) => {
  const vault = await fixture(t);
  const original = buildProjection({ ...options, documents: [document('README.md', '# Original')], graph: emptyGraph });
  await publishVault({ vaultPath: vault, files: original.files, metadata: { revision, documentPaths: original.documentPaths } });
  const baseline = await read(vault, '.knowledge-manifest.json');
  const partial = JSON.parse(baseline);
  partial.metadata.documentPaths = { 'uncommitted.md': { path: 'Documentacion/uncommitted.md', sha256: sha('bad') } };
  const incomplete = JSON.stringify(partial);
  const stage = '.knowledge-stage-00000000-0000-0000-0000-000000000002';
  await fs.mkdir(path.join(vault, stage, 'backups'), { recursive: true }); await fs.mkdir(path.join(vault, stage, 'next'));
  await fs.writeFile(path.join(vault, stage, 'backups', '0'), baseline);
  await fs.writeFile(output(vault, '.knowledge-manifest.json'), incomplete);
  await fs.writeFile(path.join(vault, '.knowledge-journal.json'), JSON.stringify({
    schemaVersion: 1, publisher: 'dtd-knowledge-v1', vault: path.resolve(vault), stage,
    entries: [{ relative: '.knowledge-manifest.json', before: sha(baseline), after: sha(incomplete), backup: 'backups/0', next: 'next/0' }],
  }));
  const reported = await checkVault(vault);
  assert.equal(reported.conflicts.at(-1).reason, 'INCOMPLETE_PUBLICATION');
  const recovered = await recoverVault(vault);
  assert.equal(recovered.ok, true); assert.equal(recovered.recovered, true);
  assert.deepEqual(recovered.manifest.metadata.documentPaths, original.documentPaths);
  assert.equal(recovered.warnings.includes('PUBLICATION_LOCK_PRESENT'), false);
  const next = buildProjection({ ...options, documents: [], graph: emptyGraph, previousManifest: recovered.manifest });
  assert.ok(next.files['Documentacion/README.md']);
  assert.equal(next.files['Documentacion/uncommitted.md'], undefined);
});

test('simultaneous processes reclaim one dead publisher without deleting a live replacement lock', async (t) => {
  const vault = await fixture(t);
  await publishVault({ vaultPath: vault, files: { 'Indice.md': 'baseline' } });
  const departed = spawn(process.execPath, ['-e', ''], { windowsHide: true, stdio: 'ignore' });
  const deadPid = departed.pid;
  await new Promise((resolve, reject) => { departed.once('error', reject); departed.once('exit', resolve); });
  assert.throws(() => process.kill(deadPid, 0), { code: 'ESRCH' });
  await fs.writeFile(path.join(vault, '.knowledge-publish.lock'), JSON.stringify({ publisher: 'dtd-knowledge-v1', host: os.hostname(), pid: deadPid, token: 'departed-publisher' }));
  const moduleUrl = new URL('../lib/knowledge-vault.mjs', import.meta.url).href;
  const source = `
    import fs from 'node:fs/promises';
    import path from 'node:path';
    import { publishVault } from ${JSON.stringify(moduleUrl)};
    const vault = process.argv[1];
    console.log('READY');
    await new Promise((resolve) => process.stdin.once('data', resolve));
    try {
      await publishVault({ vaultPath: vault, files: { 'Indice.md': 'writer ' + process.pid }, beforeCommit: async () => {
        const marker = path.join(vault, 'test-critical-section');
        const handle = await fs.open(marker, 'wx');
        try {
          const before = JSON.parse(await fs.readFile(path.join(vault, '.knowledge-publish.lock'), 'utf8'));
          if (before.pid !== process.pid) throw new Error('LOCK_STOLEN');
          await new Promise((resolve) => setTimeout(resolve, 150));
          const after = JSON.parse(await fs.readFile(path.join(vault, '.knowledge-publish.lock'), 'utf8'));
          if (after.token !== before.token) throw new Error('LOCK_STOLEN');
        } finally { await handle.close(); await fs.unlink(marker); }
      } });
      console.log(JSON.stringify({ result: 'OK', pid: process.pid }));
    } catch (error) { console.log(JSON.stringify({ result: error.code ?? error.message, pid: process.pid })); }
  `;
  const workers = Array.from({ length: 6 }, () => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source, vault], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let readyResolve;
    const ready = new Promise((resolve) => { readyResolve = resolve; });
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.includes('READY\n')) readyResolve(); });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const done = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => {
        if (code !== 0) reject(new Error(stderr || `Child exited ${code}`));
        else resolve(JSON.parse(stdout.trim().split('\n').at(-1)));
      });
    });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    return { child, ready, done };
  });
  await Promise.all(workers.map((w) => w.ready));
  for (const worker of workers) worker.child.stdin.end('GO');
  const results = await Promise.all(workers.map((w) => w.done));
  assert.ok(results.some((result) => result.result === 'OK'));
  assert.ok(results.every((result) => ['OK', 'LOCKED'].includes(result.result)), JSON.stringify(results));
  const state = await checkVault(vault);
  assert.equal(state.ok, true); assert.deepEqual(state.warnings, []);
  assert.equal((await fs.readdir(vault)).some((name) => name.startsWith('.knowledge-')), false);
});

test('an unknown recovery mutex is preserved instead of guessed stale', async (t) => {
  const vault = await fixture(t);
  await fs.writeFile(path.join(vault, '.knowledge-reaper.lock'), 'unknown owner');
  await fs.writeFile(path.join(vault, '.knowledge-publish.lock'), 'unknown owner');
  await assert.rejects(recoverVault(vault), { code: 'LOCKED' });
  assert.equal(await fs.readFile(path.join(vault, '.knowledge-reaper.lock'), 'utf8'), 'unknown owner');
  assert.equal(await fs.readFile(path.join(vault, '.knowledge-publish.lock'), 'utf8'), 'unknown owner');
});

test('projection baseline is checked under the publication lock and cannot prune newer outputs', async (t) => {
  const vault = await fixture(t);
  const first = await publishVault({ vaultPath: vault, files: { 'Indice.md': 'first' }, expectedManifest: null });
  const second = await publishVault({ vaultPath: vault, files: { 'Indice.md': 'second', 'Documentacion/new.md': 'new source' }, expectedManifest: first.manifest });
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Indice.md': 'stale projection' }, expectedManifest: first.manifest }), { code: 'PROJECTION_STALE' });
  await assert.rejects(publishVault({ vaultPath: vault, files: { 'Indice.md': 'stale initial projection' }, expectedManifest: null }), { code: 'PROJECTION_STALE' });
  assert.equal(await read(vault, 'Indice.md'), 'second');
  assert.equal(await read(vault, 'Documentacion/new.md'), 'new source');
  assert.deepEqual((await checkVault(vault)).manifest, second.manifest);
  assert.equal((await fs.readdir(vault)).some((name) => name.startsWith('.knowledge-')), false);
});

test('handoffs use visible Obsidian folders while source identities and links remain canonical', () => {
  const source = '.agents/handoffs/task.md';
  const projected = buildProjection({ ...options, documents: [document(source, '# Task\n\n[Project](../../README.md)\n'), document('README.md', '# Project\n\n[Task](.agents/handoffs/task.md)\n')], graph: emptyGraph });
  const notePath = 'Documentacion/Agentes/handoffs/task.md';
  assert.ok(projected.files[notePath]);
  assert.equal(projected.files['Documentacion/.agents/handoffs/task.md'], undefined);
  assert.equal(projected.documentPaths[source].path, notePath);
  assert.ok(projected.files[notePath].includes(`/blob/${revision}/.agents/handoffs/task.md`));
  assert.ok(projected.files[notePath].includes('[Project](<../../README.md>)'));
  assert.ok(projected.files['Documentacion/README.md'].includes('[Task](<Agentes/handoffs/task.md>)'));
  assert.ok(projected.files['Mapa/handoffs.md'].includes('../Documentacion/Agentes/handoffs/task.md'));
  const retired = buildProjection({ ...options, documents: [], graph: emptyGraph, previousManifest: { metadata: { documentPaths: projected.documentPaths } } });
  assert.match(retired.files[notePath], /retirado/);
  assert.equal(retired.documentPaths[source].path, notePath);
});

test('only approved Director and Worker skills have visible notes and canonical links', () => {
  const director = '.agents/skills/director/SKILL.md';
  const worker = '.agents/skills/worker/SKILL.md';
  const projected = buildProjection({ ...options, documents: [
    document('AGENTS.md', '# Rules\n\n[Director](.agents/skills/director/SKILL.md)\n'),
    document('docs/README.md', '# Master index\n'),
    document(director, '---\nname: director\n---\n# Director\n\n[Worker](../worker/SKILL.md)\n'),
    document(worker, '# Worker\n'),
  ], graph: emptyGraph });
  const visible = 'Documentacion/Agentes/skills/director/SKILL.md';
  assert.ok(projected.files[visible].startsWith('---\nname: director\n---\n'));
  assert.equal(projected.documentPaths[director].path, visible);
  assert.ok(projected.files[visible].includes(`/blob/${revision}/${director}`));
  assert.ok(projected.files['Documentacion/AGENTS.md'].includes('[Director](<Agentes/skills/director/SKILL.md>)'));
  assert.ok(projected.files[visible].includes('[Worker](<../worker/SKILL.md>)'));
  assert.ok(projected.files['Documentacion/docs/README.md']);
  assert.throws(() => buildProjection({ ...options, documents: [document('.agents/skills/other/SKILL.md', '# Other')], graph: emptyGraph }), /Hidden source/);
});

test('MDX is rendered as a distinct Markdown note and retirement preserves that path', () => {
  const projected = buildProjection({ ...options, documents: [document('docs/architecture/page.md', '# MD\n\n[MDX](page.mdx)\n'), document('docs/architecture/page.mdx', '# MDX\n\n<Component prop="kept" />\n')], graph: emptyGraph });
  assert.ok(projected.files['Documentacion/docs/architecture/page.md']);
  assert.ok(projected.files['Documentacion/docs/architecture/page.mdx.md']);
  assert.ok(projected.files['Documentacion/docs/architecture/page.md'].includes('[MDX](<page.mdx.md>)'));
  assert.ok(projected.files['Documentacion/docs/architecture/page.mdx.md'].includes('<Component prop="kept" />'));
  assert.equal(projected.documentPaths['docs/architecture/page.mdx'].path, 'Documentacion/docs/architecture/page.mdx.md');
  const retired = buildProjection({ ...options, documents: [], graph: emptyGraph, previousManifest: { metadata: { documentPaths: projected.documentPaths } } });
  assert.match(retired.files['Documentacion/docs/architecture/page.mdx.md'], /retirado/);
});

test('unapproved hidden paths and output collisions are rejected', () => {
  for (const source of ['.other/note.md', 'docs/.private/note.md', '.agents/handoffs/.private.md']) {
    assert.throws(() => buildProjection({ ...options, documents: [document(source, '# Note')], graph: emptyGraph }), /Hidden source/);
  }
  assert.throws(() => buildProjection({ ...options, documents: [document('.agents/handoffs/a.md', '# One'), document('Agentes/handoffs/a.md', '# Two')], graph: emptyGraph }), /colliding Obsidian note/);
  assert.throws(() => buildProjection({ ...options, documents: [document('docs/architecture/a.mdx', '# MDX'), document('docs/architecture/a.mdx.md', '# MD')], graph: emptyGraph }), /colliding Obsidian note/);
});

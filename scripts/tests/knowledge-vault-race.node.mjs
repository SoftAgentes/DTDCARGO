import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { publishVault, checkVault, recoverVault } from '../lib/knowledge-vault.mjs';

const sha = (content) => createHash('sha256').update(content).digest('hex');
const output = (root, relative = 'Indice.md') => path.join(root, 'Generado', relative);
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-race-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return root;
}
async function retained(root, directory) {
  const stage = (await fs.readdir(root)).find((name) => name.startsWith('.knowledge-stage-'));
  assert.ok(stage, 'The conflicting transaction remains available');
  const entries = await fs.readdir(path.join(root, stage, directory));
  return Promise.all(entries.map((name) => fs.readFile(path.join(root, stage, directory, name), 'utf8')));
}
async function interrupted(t, { gap = false } = {}) {
  const root = await fixture(t);
  await publishVault({ vaultPath: root, files: { 'Indice.md': 'baseline' } });
  const stage = '.knowledge-stage-00000000-0000-0000-0000-000000000099';
  await fs.mkdir(path.join(root, stage, 'backups'), { recursive: true });
  await fs.mkdir(path.join(root, stage, 'next'));
  await fs.writeFile(path.join(root, stage, 'backups/0'), 'baseline');
  const entry = { relative: 'Indice.md', before: sha('baseline'), after: sha('interrupted'), backup: 'backups/0', next: 'next/0' };
  if (gap) {
    entry.capture = 'captures/0'; entry.rollbackCapture = 'rollback/0';
    await fs.mkdir(path.join(root, stage, 'captures'));
    await fs.rename(output(root), path.join(root, stage, 'captures/0'));
  } else await fs.writeFile(output(root), 'interrupted');
  await fs.writeFile(path.join(root, '.knowledge-journal.json'), JSON.stringify({
    schemaVersion: 1, publisher: 'dtd-knowledge-v1', vault: path.resolve(root), stage, entries: [entry],
  }));
  return root;
}

test('a manual save at the last replacement boundary is captured and preserved', async (t) => {
  const root = await fixture(t); const target = output(root);
  await publishVault({ vaultPath: root, files: { 'Indice.md': 'baseline' } });
  const rename = fs.rename.bind(fs); let injected = false;
  t.mock.method(fs, 'rename', async (from, to) => {
    // The first case reproduces the old replacing rename. The second targets
    // the new capture boundary immediately after the publisher's last read.
    if (!injected && (path.resolve(to) === target || path.resolve(from) === target)) {
      injected = true; await fs.writeFile(target, 'personal save at replacement');
    }
    return rename(from, to);
  });
  await assert.rejects(publishVault({ vaultPath: root, files: { 'Indice.md': 'updated' } }), { code: 'RECOVERY_CONFLICT' });
  assert.equal(injected, true);
  assert.equal(await fs.readFile(target, 'utf8'), 'personal save at replacement');
  assert.ok((await retained(root, 'captures')).includes('personal save at replacement'));
  assert.equal((await checkVault(root)).ok, false);
});

test('a destination created just before exclusive install is never overwritten', async (t) => {
  const root = await fixture(t); const target = output(root);
  await publishVault({ vaultPath: root, files: { 'other.md': 'baseline' } });
  const link = fs.link.bind(fs); let injected = false;
  t.mock.method(fs, 'link', async (from, to) => {
    if (!injected && path.resolve(to) === target) {
      injected = true; await fs.writeFile(target, 'personal newly created note');
    }
    return link(from, to);
  });
  await assert.rejects(publishVault({ vaultPath: root, files: { 'Indice.md': 'generated', 'other.md': 'baseline' } }), { code: 'RECOVERY_CONFLICT' });
  assert.equal(injected, true);
  assert.equal(await fs.readFile(target, 'utf8'), 'personal newly created note');
  assert.equal((await checkVault(root)).ok, false);
});

test('a save between capture and install keeps both personal content and the original backup', async (t) => {
  const root = await fixture(t); const target = output(root);
  await publishVault({ vaultPath: root, files: { 'Indice.md': 'baseline' } });
  const link = fs.link.bind(fs); let injected = false;
  t.mock.method(fs, 'link', async (from, to) => {
    if (!injected && path.resolve(to) === target && String(from).includes(path.sep + 'next' + path.sep)) {
      injected = true; await fs.writeFile(target, 'personal save in capture gap');
    }
    return link(from, to);
  });
  await assert.rejects(publishVault({ vaultPath: root, files: { 'Indice.md': 'generated' } }), { code: 'RECOVERY_CONFLICT' });
  assert.equal(await fs.readFile(target, 'utf8'), 'personal save in capture gap');
  assert.ok((await retained(root, 'captures')).includes('baseline'));
});

test('changed captured bytes are retained instead of discarded during cleanup', async (t) => {
  const root = await fixture(t); const target = output(root);
  await publishVault({ vaultPath: root, files: { 'Indice.md': 'baseline' } });
  const link = fs.link.bind(fs); let injected = false;
  t.mock.method(fs, 'link', async (from, to) => {
    if (!injected && path.resolve(to) === target && String(from).includes(path.sep + 'next' + path.sep)) {
      injected = true;
      const stage = (await fs.readdir(root)).find((name) => name.startsWith('.knowledge-stage-'));
      const captures = path.join(root, stage, 'captures');
      for (const name of await fs.readdir(captures)) {
        const file = path.join(captures, name);
        if (await fs.readFile(file, 'utf8') === 'baseline') await fs.writeFile(file, 'personal bytes through captured inode');
      }
    }
    return link(from, to);
  });
  await assert.rejects(publishVault({ vaultPath: root, files: { 'Indice.md': 'generated' } }), { code: 'RECOVERY_CONFLICT' });
  assert.ok((await retained(root, 'captures')).includes('personal bytes through captured inode'));
  assert.equal((await checkVault(root)).ok, false);
});

test('recovery preserves a save at its own last replacement boundary', async (t) => {
  const root = await interrupted(t); const target = output(root);
  const rename = fs.rename.bind(fs); let injected = false;
  t.mock.method(fs, 'rename', async (from, to) => {
    if (!injected && (path.resolve(from) === target || path.resolve(to) === target)) {
      injected = true; await fs.writeFile(target, 'personal during recovery');
    }
    return rename(from, to);
  });
  await assert.rejects(recoverVault(root), { code: 'RECOVERY_CONFLICT' });
  assert.equal(await fs.readFile(target, 'utf8'), 'personal during recovery');
  assert.ok((await retained(root, 'rollback')).includes('personal during recovery'));
});

test('recovery preserves a newly created target instead of replacing it with a backup', async (t) => {
  const root = await interrupted(t); const target = output(root);
  const link = fs.link.bind(fs); let injected = false;
  t.mock.method(fs, 'link', async (from, to) => {
    if (!injected && path.resolve(to) === target) {
      injected = true; await fs.writeFile(target, 'personal while restoring');
    }
    return link(from, to);
  });
  await assert.rejects(recoverVault(root), { code: 'RECOVERY_CONFLICT' });
  assert.equal(await fs.readFile(target, 'utf8'), 'personal while restoring');
  assert.ok((await retained(root, 'backups')).includes('baseline'));
});

test('recovery handles a crash between capture and exclusive install', async (t) => {
  const root = await interrupted(t, { gap: true });
  const result = await recoverVault(root);
  assert.equal(result.recovered, true); assert.equal(result.ok, true);
  assert.equal(await fs.readFile(output(root), 'utf8'), 'baseline');
  assert.equal((await fs.readdir(root)).some((name) => name.startsWith('.knowledge-')), false);
});

test('a crash while cleaning an already committed transaction resumes cleanup', async (t) => {
  const root = await fixture(t);
  await publishVault({ vaultPath: root, files: { 'Indice.md': 'baseline' } });
  const unlink = fs.unlink.bind(fs); let injected = false;
  t.mock.method(fs, 'unlink', async (file) => {
    if (!injected && String(file).includes(path.sep + 'captures' + path.sep)) {
      injected = true; throw Object.assign(new Error('simulated cleanup interruption'), { code: 'EIO' });
    }
    return unlink(file);
  });
  await assert.rejects(publishVault({ vaultPath: root, files: { 'Indice.md': 'committed' } }), { code: 'RECOVERY_CONFLICT' });
  const journal = JSON.parse(await fs.readFile(path.join(root, '.knowledge-journal.json'), 'utf8'));
  assert.equal(journal.phase, 'committed');
  assert.equal(await fs.readFile(output(root), 'utf8'), 'committed');
  const result = await recoverVault(root);
  assert.equal(result.recovered, true); assert.equal(result.ok, true);
  assert.equal(await fs.readFile(output(root), 'utf8'), 'committed');
  assert.equal((await fs.readdir(root)).some((name) => name.startsWith('.knowledge-')), false);
});


test('a filesystem without hard-link support fails before moving any existing note', async (t) => {
  const root = await fixture(t);
  await publishVault({ vaultPath: root, files: { 'Indice.md': 'baseline' } });
  const originalManifest = await fs.readFile(output(root, '.knowledge-manifest.json'), 'utf8');
  t.mock.method(fs, 'link', async () => { throw Object.assign(new Error('hard links unsupported'), { code: 'ENOTSUP' }); });
  await assert.rejects(publishVault({ vaultPath: root, files: { 'Indice.md': 'updated' } }), { code: 'ENOTSUP' });
  assert.equal(await fs.readFile(output(root), 'utf8'), 'baseline');
  assert.equal(await fs.readFile(output(root, '.knowledge-manifest.json'), 'utf8'), originalManifest);
  assert.equal((await checkVault(root)).ok, true);
  assert.equal((await fs.readdir(root)).some((name) => name.startsWith('.knowledge-')), false);
});

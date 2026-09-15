import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';

const PUBLISHER = 'dtd-knowledge-v1';
const GENERATED = 'Generado';
const MANIFEST = '.knowledge-manifest.json';
const LOCK = '.knowledge-publish.lock';
const REAPER = '.knowledge-reaper.lock';
const JOURNAL = '.knowledge-journal.json';
const digest = (content) => createHash('sha256').update(content).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const serial = (value) => JSON.stringify(value, null, 2) + '\n';

function failure(code, message, conflicts = []) {
  return Object.assign(new Error(message), { code, conflicts });
}
function safeRelative(relative, { internal = false } = {}) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.posix.isAbsolute(relative)) throw failure('UNSAFE_PATH', `Unsafe relative path: ${relative}`);
  const parts = relative.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[:<>"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw failure('UNSAFE_PATH', `Unsafe relative path: ${relative}`);
  if (!internal && parts.some((part) => part.toLowerCase().startsWith('.knowledge-'))) throw failure('UNSAFE_PATH', `Reserved relative path: ${relative}`);
  return relative;
}
function inside(root, relative, options) {
  safeRelative(relative, options);
  const target = path.resolve(root, ...relative.split('/'));
  const displacement = path.relative(root, target);
  if (!displacement || displacement === '..' || displacement.startsWith(`..${path.sep}`) || path.isAbsolute(displacement)) throw failure('UNSAFE_PATH', `Path escapes vault: ${relative}`);
  return target;
}
async function statMaybe(target) { try { return await fs.lstat(target); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
// lstat every ancestor, including the supplied root: Windows junctions/reparse
// links must not redirect publication into another folder.
async function noLinks(target) {
  const absolute = path.resolve(target); const root = path.parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await statMaybe(current);
    if (!stat) continue;
    if (stat.isSymbolicLink()) throw failure('UNSAFE_PATH', `Symbolic link/junction is not a publication destination: ${current}`);
    if (current !== absolute && !stat.isDirectory()) throw failure('UNSAFE_PATH', `Non-directory ancestor: ${current}`);
  }
}
async function readMaybe(target) {
  await noLinks(target);
  try { return await fs.readFile(target); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function validManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.publisher !== PUBLISHER || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) throw failure('INVALID_MANIFEST', 'Unknown or invalid generated manifest; existing content is preserved');
  const seen = new Set();
  for (const [relative, sha] of Object.entries(manifest.files)) {
    safeRelative(relative);
    if (!/^[a-f0-9]{64}$/.test(sha)) throw failure('INVALID_MANIFEST', `Invalid file hash: ${relative}`);
    if (seen.has(relative.toLowerCase())) throw failure('INVALID_MANIFEST', `Case collision: ${relative}`);
    seen.add(relative.toLowerCase());
  }
  return manifest;
}
async function inspect(vaultPath) {
  const root = path.resolve(vaultPath); await noLinks(root);
  const manifestPath = inside(root, `${GENERATED}/${MANIFEST}`, { internal: true });
  const bytes = await readMaybe(manifestPath);
  if (!bytes) return { ok: false, manifest: null, conflicts: [], warnings: ['NOT_PUBLISHED'] };
  let manifest;
  try { manifest = validManifest(JSON.parse(bytes.toString('utf8'))); } catch (error) { return { ok: false, manifest: null, conflicts: [{ path: `${GENERATED}/${MANIFEST}`, reason: error.code ?? 'INVALID_MANIFEST' }], warnings: [] }; }
  const conflicts = [];
  for (const [relative, sha] of Object.entries(manifest.files)) {
    const content = await readMaybe(inside(root, `${GENERATED}/${relative}`));
    if (content === null) conflicts.push({ path: relative, reason: 'MISSING_MANAGED_FILE' });
    else if (digest(content) !== sha) conflicts.push({ path: relative, reason: 'MODIFIED_MANAGED_FILE' });
  }
  return { ok: conflicts.length === 0, manifest, conflicts, warnings: [] };
}

/** Read-only: never repairs locks, files or interrupted transactions. */
export async function checkVault(vaultPath) {
  try {
    const state = await inspect(vaultPath);
    if (await statMaybe(inside(path.resolve(vaultPath), JOURNAL, { internal: true }))) {
      state.ok = false; state.conflicts.push({ path: JOURNAL, reason: 'INCOMPLETE_PUBLICATION' });
    }
    if (await statMaybe(inside(path.resolve(vaultPath), LOCK, { internal: true }))) state.warnings.push('PUBLICATION_LOCK_PRESENT');
    if (await statMaybe(inside(path.resolve(vaultPath), REAPER, { internal: true }))) state.warnings.push('RECOVERY_MUTEX_PRESENT');
    return state;
  } catch (error) {
    return { ok: false, manifest: null, conflicts: [{ path: vaultPath, reason: error.code ?? 'READ_FAILED', message: error.message }], warnings: [] };
  }
}

async function releaseOwnedLock(lockPath, token) {
  const current = await readMaybe(lockPath);
  if (!current) return;
  let lock;
  try { lock = JSON.parse(current.toString('utf8')); } catch { throw failure('LOCKED', 'A lock changed unexpectedly; preserved for inspection'); }
  if (lock.token === token) await fs.unlink(lockPath);
}

async function reapDeadPublisher(root) {
  // Reclamation needs its own exclusive mutex: checking a dead PID followed by
  // unlink is otherwise vulnerable to a second reaper deleting a new live lock.
  const reaperPath = inside(root, REAPER, { internal: true }); await noLinks(reaperPath);
  const mutex = { publisher: PUBLISHER, pid: process.pid, host: os.hostname(), token: randomUUID() };
  try { await fs.writeFile(reaperPath, serial(mutex), { flag: 'wx' }); }
  catch (error) { if (error.code === 'EEXIST') throw failure('LOCKED', 'Publication lock recovery is already claimed; the recovery mutex is preserved'); throw error; }
  try {
    const lockPath = inside(root, LOCK, { internal: true });
    const bytes = await readMaybe(lockPath);
    if (!bytes) return;
    let existing;
    try { existing = JSON.parse(bytes.toString('utf8')); } catch { throw failure('LOCKED', 'Unknown publication lock; preserved for inspection'); }
    if (existing.publisher !== PUBLISHER || existing.host !== os.hostname() || !Number.isSafeInteger(existing.pid) || existing.pid < 1 || typeof existing.token !== 'string') throw failure('LOCKED', 'Publication lock cannot be attributed to this machine');
    try { process.kill(existing.pid, 0); throw failure('LOCKED', 'Another publisher is active'); }
    catch (check) { if (check.code !== 'ESRCH') throw failure('LOCKED', 'Another publisher is active or cannot be checked'); }
    const checked = await readMaybe(lockPath);
    if (!checked?.equals(bytes)) throw failure('LOCKED', 'Publication lock changed while being checked');
    await fs.unlink(lockPath);
  } finally { await releaseOwnedLock(reaperPath, mutex.token); }
}

async function acquireLock(root) {
  const lockPath = inside(root, LOCK, { internal: true });
  await noLinks(lockPath);
  const lock = { publisher: PUBLISHER, pid: process.pid, host: os.hostname(), token: randomUUID() };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fs.writeFile(lockPath, serial(lock), { flag: 'wx' });
      return () => releaseOwnedLock(lockPath, lock.token);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await reapDeadPublisher(root);
    }
  }
  throw failure('LOCKED', 'Cannot acquire publication lock');
}
async function removeKnownStage(root, stageName, journal) {
  const stage = inside(root, stageName, { internal: true }); await noLinks(stage);
  // Remove only transaction-owned files, never recursively enumerate and delete.
  for (const entry of journal.entries) {
    for (const relative of [entry.backup, entry.next, entry.backup ? `${entry.backup}.restore` : null]) {
      if (!relative) continue;
      const target = inside(stage, relative, { internal: true }); await noLinks(target);
      await fs.unlink(target).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  for (const relative of ['backups', 'next']) await fs.rmdir(inside(stage, relative, { internal: true })).catch((error) => { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error; });
  await fs.rmdir(stage).catch((error) => { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error; });
}
function validJournal(journal, root) {
  if (journal?.schemaVersion !== 1 || journal.publisher !== PUBLISHER || journal.vault !== root || !/^\.knowledge-stage-[a-f0-9-]{36}$/.test(journal.stage ?? '') || !Array.isArray(journal.entries)) throw failure('INVALID_JOURNAL', 'Unknown interrupted transaction; preserved for inspection');
  const seen = new Set();
  for (const [index, entry] of journal.entries.entries()) {
    safeRelative(entry.relative, { internal: entry.relative === MANIFEST });
    if (seen.has(entry.relative.toLowerCase())) throw failure('INVALID_JOURNAL', 'Duplicate journal target');
    seen.add(entry.relative.toLowerCase());
    for (const key of ['before', 'after']) if (entry[key] !== null && !/^[a-f0-9]{64}$/.test(entry[key] ?? '')) throw failure('INVALID_JOURNAL', 'Invalid transaction hash');
    if (entry.backup !== (entry.before === null ? null : `backups/${index}`) || entry.next !== (entry.after === null ? null : `next/${index}`)) throw failure('INVALID_JOURNAL', 'Invalid transaction staging path');
  }
  return journal;
}
async function rollback(root, journal) {
  validJournal(journal, root);
  const stage = inside(root, journal.stage, { internal: true });
  const operations = [];
  for (const entry of journal.entries) {
    const target = inside(root, `${GENERATED}/${entry.relative}`, { internal: true });
    const content = await readMaybe(target); const current = content === null ? null : digest(content);
    if (current !== entry.before && current !== entry.after) throw failure('RECOVERY_CONFLICT', `Manual change during interrupted publication: ${entry.relative}`);
    if (current === entry.before) continue;
    if (entry.before !== null) {
      const backup = await readMaybe(inside(stage, entry.backup, { internal: true }));
      if (!backup || digest(backup) !== entry.before) throw failure('RECOVERY_CONFLICT', `Missing or changed backup: ${entry.relative}`);
      operations.push({ entry, target, backup });
    } else operations.push({ entry, target, backup: null });
  }
  for (const { entry, target, backup } of operations.reverse()) {
    await noLinks(target);
    const current = await readMaybe(target);
    if ((current === null ? null : digest(current)) !== entry.after) throw failure('RECOVERY_CONFLICT', `File changed during rollback: ${entry.relative}`);
    if (backup === null) await fs.unlink(target).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      // Restore by rename, keeping the original backup for a further interrupted recovery.
      const restore = inside(stage, `${entry.backup}.restore`, { internal: true });
      const pending = await readMaybe(restore);
      if (pending && digest(pending) !== entry.before) throw failure('RECOVERY_CONFLICT', `Changed recovery staging file: ${entry.relative}`);
      if (!pending) await fs.writeFile(restore, backup, { flag: 'wx' });
      await fs.rename(restore, target);
    }
  }
  await fs.unlink(inside(root, JOURNAL, { internal: true }));
  await removeKnownStage(root, journal.stage, journal);
}
async function recover(root) {
  const bytes = await readMaybe(inside(root, JOURNAL, { internal: true }));
  if (!bytes) return false;
  let journal;
  try { journal = JSON.parse(bytes.toString('utf8')); } catch { throw failure('INVALID_JOURNAL', 'Unreadable recovery journal; preserved'); }
  await rollback(root, validJournal(journal, root));
  return true;
}

/** Mutating recovery gate: call only after publication authorization, before building
 * a projection from the previous manifest. A partial manifest is never a safe base. */
export async function recoverVault(vaultPath) {
  const root = path.resolve(vaultPath); await noLinks(root);
  if (!await statMaybe(root)) return { ...(await checkVault(root)), recovered: false };
  const release = await acquireLock(root);
  try {
    const recovered = await recover(root);
    return { ...(await inspect(root)), recovered };
  } finally { await release(); }
}
/** Publish only owned files. Callers must authorize revision/corpus before invoking. */
export async function publishVault({ vaultPath, files, metadata = {}, expectedManifest, beforeCommit }) {
  const root = path.resolve(vaultPath); await noLinks(root);
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw failure('INVALID_FILES', 'Expected a relative-path/content map');
  const entries = Object.entries(files).sort(([a], [b]) => compare(a, b));
  const seen = new Set();
  for (const [relative, content] of entries) {
    safeRelative(relative);
    if (typeof content !== 'string') throw failure('INVALID_FILES', `Expected UTF-8 text: ${relative}`);
    if (seen.has(relative.toLowerCase())) throw failure('UNSAFE_PATH', `Case-colliding output: ${relative}`);
    seen.add(relative.toLowerCase());
  }
  // Detect file/directory collisions even on a case-sensitive development host.
  for (const relative of seen) for (let at = relative.indexOf('/'); at >= 0; at = relative.indexOf('/', at + 1)) if (seen.has(relative.slice(0, at))) throw failure('UNSAFE_PATH', `File/directory collision: ${relative}`);
  await fs.mkdir(root, { recursive: true }); await noLinks(root);
  const release = await acquireLock(root); let journal = null; let journalWritten = false;
  try {
    const recovered = await recover(root);
    const initial = await inspect(root);
    if (initial.conflicts.length) throw failure('VAULT_CONFLICT', 'Managed notes changed; publication stopped', initial.conflicts);
    const prior = initial.manifest;
    if (expectedManifest !== undefined && !isDeepStrictEqual(prior, expectedManifest)) throw failure('PROJECTION_STALE', 'The vault manifest changed after projection; rebuild from the current manifest');
    const manifest = { schemaVersion: 1, publisher: PUBLISHER, metadata, files: Object.fromEntries(entries.map(([relative, content]) => [relative, digest(content)])) };
    const nextFiles = new Map(entries); nextFiles.set(MANIFEST, serial(manifest));
    const candidates = [...new Set([...Object.keys(prior?.files ?? {}), ...nextFiles.keys()])].sort(compare);
    const changes = [];
    for (const relative of candidates) {
      const target = inside(root, `${GENERATED}/${relative}`, { internal: true });
      const current = await readMaybe(target); const content = nextFiles.get(relative);
      const expected = relative === MANIFEST ? (prior ? digest(serial(prior)) : null) : prior?.files[relative] ?? null;
      if (current !== null && expected === null) throw failure('VAULT_CONFLICT', `Unknown file would be overwritten: ${relative}`, [{ path: relative, reason: 'UNOWNED_FILE' }]);
      // The actual manifest bytes may differ in formatting; capture those bytes as the
      // rollback baseline. Files managed by it were checked above against their hashes.
      if (relative !== MANIFEST && (current === null ? null : digest(current)) !== expected) throw failure('VAULT_CONFLICT', `File changed during preparation: ${relative}`);
      const next = content === undefined ? null : Buffer.from(content, 'utf8');
      if (current === null && next === null || current && next && current.equals(next)) continue;
      changes.push({ relative, current, next });
    }
    if (!changes.length) {
      if (beforeCommit) await beforeCommit();
      const final = await inspect(root);
      if (!final.ok) throw failure('VAULT_CONFLICT', 'Vault changed during final validation', final.conflicts);
      return { changed: false, recovered, manifest, filesWritten: 0 };
    }
    journal = { schemaVersion: 1, publisher: PUBLISHER, vault: root, stage: `.knowledge-stage-${randomUUID()}`, entries: [] };
    const stage = inside(root, journal.stage, { internal: true });
    await fs.mkdir(stage); await fs.mkdir(path.join(stage, 'backups')); await fs.mkdir(path.join(stage, 'next'));
    for (const [index, change] of changes.entries()) {
      const entry = { relative: change.relative, before: change.current === null ? null : digest(change.current), after: change.next === null ? null : digest(change.next), backup: change.current === null ? null : `backups/${index}`, next: change.next === null ? null : `next/${index}` };
      journal.entries.push(entry);
      if (entry.backup) await fs.writeFile(inside(stage, entry.backup, { internal: true }), change.current, { flag: 'wx' });
      if (entry.next) await fs.writeFile(inside(stage, entry.next, { internal: true }), change.next, { flag: 'wx' });
    }
    if (beforeCommit) await beforeCommit();
    // Recheck every original, including outputs unchanged by this run, after the
    // asynchronous corpus validation. User edits are never accepted as a baseline.
    const validated = await inspect(root);
    if (validated.conflicts.length || JSON.stringify(validated.manifest) !== JSON.stringify(prior)) throw failure('VAULT_CONFLICT', 'Vault changed during validation', validated.conflicts);
    for (const entry of journal.entries) {
      const current = await readMaybe(inside(root, `${GENERATED}/${entry.relative}`, { internal: true }));
      if ((current === null ? null : digest(current)) !== entry.before) throw failure('VAULT_CONFLICT', `File appeared or changed during validation: ${entry.relative}`);
    }
    await fs.writeFile(inside(root, JOURNAL, { internal: true }), serial(journal), { flag: 'wx' }); journalWritten = true;
    for (const entry of journal.entries) {
      const target = inside(root, `${GENERATED}/${entry.relative}`, { internal: true }); await noLinks(target);
      const current = await readMaybe(target);
      if ((current === null ? null : digest(current)) !== entry.before) throw failure('VAULT_CONFLICT', `File changed during publication: ${entry.relative}`);
      if (entry.after === null) await fs.unlink(target);
      else {
        const staged = inside(stage, entry.next, { internal: true });
        const next = await readMaybe(staged);
        if (!next || digest(next) !== entry.after) throw failure('STAGE_CONFLICT', `Staged file changed: ${entry.relative}`);
        await fs.mkdir(path.dirname(target), { recursive: true }); await noLinks(target);
        await fs.rename(staged, target);
      }
    }
    const final = await inspect(root);
    if (!final.ok) throw failure('VAULT_CONFLICT', 'Vault changed during publication', final.conflicts);
    await fs.unlink(inside(root, JOURNAL, { internal: true })); journalWritten = false;
    await removeKnownStage(root, journal.stage, journal); journal = null;
    return { changed: true, recovered, manifest, filesWritten: changes.length - 1 };
  } catch (error) {
    if (journalWritten) {
      try { await rollback(root, journal); journalWritten = false; journal = null; }
      catch (recoveryError) { throw failure('RECOVERY_CONFLICT', `${error.message}; rollback stopped to preserve conflicting content: ${recoveryError.message}`, recoveryError.conflicts); }
    }
    if (journal) await removeKnownStage(root, journal.stage, journal);
    throw error;
  } finally { await release(); }
}

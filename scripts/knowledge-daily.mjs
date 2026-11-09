// Corrida diaria mecánica de conocimiento (SDD-0623).
//
// Una sola corrida programada al día, en la PC de Sam, desde el checkout
// principal: trae main por fast-forward y ejecuta lo mecánico —
// `graphify update .`, `knowledge:visual`, `knowledge:publish` y
// `knowledge:check`—. La parte semántica sigue siendo manual (Director).
//
// Garantías: para sin tocar nada si no está en el checkout principal, si no
// está en main, si hay cambios rastreados o si el fast-forward no es posible.
// Nunca hace commit, push, stash, reset ni borra archivos rastreados. Escribe
// una línea de resumen en un log fuera del repo y sale con código distinto de 0
// si algo falla.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXIT = Object.freeze({ OK: 0, STEP_FAILED: 1, PRECONDITION: 2, LOCKED: 3, USAGE: 64 });

export function defaultLogPath(env = process.env) {
  const base = env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'state');
  return path.join(base, 'dtd-cargo', 'knowledge-daily.log');
}

export function parseArgs(argv, env = process.env) {
  const options = { root: process.cwd(), log: env.KNOWLEDGE_DAILY_LOG || defaultLogPath(env), python: env.GRAPHIFY_PYTHON || null, dryRun: false };
  const args = [...argv];
  while (args.length) {
    const arg = args.shift();
    if (arg === '--') continue;
    if (arg === '--dry-run') { options.dryRun = true; continue; }
    if (['--root', '--log', '--python'].includes(arg)) {
      const value = args.shift();
      if (!value || value.startsWith('--')) throw new Error('Falta valor: ' + arg);
      options[arg.slice(2)] = value;
      continue;
    }
    throw new Error('Uso: knowledge-daily.mjs [--root ruta] [--log archivo] [--python ruta] [--dry-run]');
  }
  return options;
}

/** Ejecutor real: sin shell, salida capturada. Los dobles de prueba lo reemplazan. */
export function spawnRunner(command, args, { cwd }) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  return { status: result.error ? null : result.status, stdout: result.stdout ?? '', stderr: result.error ? String(result.error.message) : (result.stderr ?? '') };
}

const lastLine = (text) => (text || '').trim().split(/\r?\n/).pop().slice(0, 300);

function git(runner, root, args) {
  const result = runner('git', args, { cwd: root });
  return { ...result, out: (result.stdout || '').trim() };
}

/** Los cuatro pasos mecánicos. `graphify` corre con el Python fijado del runbook. */
export function mechanicalSteps({ root, python }) {
  const node = process.execPath;
  return [
    { name: 'structure', command: python, args: ['-m', 'graphify', 'update', '.'] },
    { name: 'visual', command: node, args: [path.join(root, 'scripts', 'knowledge-visual.mjs'), 'build'] },
    { name: 'publish', command: node, args: [path.join(root, 'scripts', 'knowledge-sync.mjs'), 'publish'] },
    { name: 'check', command: node, args: [path.join(root, 'scripts', 'knowledge-sync.mjs'), 'check'] },
  ];
}

/** Toma del JSON de `knowledge:check` los campos del resumen; tolera salida inválida. */
export function summarizeCheck(stdout) {
  let status;
  try { status = JSON.parse(stdout); } catch { return { structure: 'UNKNOWN', archify: 'UNKNOWN', obsidian: 'UNKNOWN', semanticPending: 'UNKNOWN' }; }
  const pilot = status.semanticCoverage?.pilot;
  const global = status.semanticCoverage?.global;
  const pilotPending = pilot ? (pilot.targetCount ?? 0) - (pilot.verifiedCount ?? 0) : '?';
  return {
    structure: status.structural?.status ?? status.structural ?? 'UNKNOWN',
    archify: status.archify?.status ?? 'UNKNOWN',
    obsidian: status.obsidian?.status ?? 'UNKNOWN',
    semanticPending: 'piloto=' + pilotPending + ' global=' + (global?.pendingCount ?? '?'),
  };
}

export function formatLine(record) {
  const fields = [record.date, 'rev=' + (record.revision || '-'), 'resultado=' + record.outcome,
    'estructura=' + record.structure, 'archify=' + record.archify, 'obsidian=' + record.obsidian,
    'semantico_pendiente=' + record.semanticPending];
  if (record.reason) fields.push('motivo=' + JSON.stringify(record.reason));
  return fields.join(' ');
}

function appendLog(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, line + '\n', 'utf8');
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

/** Candado junto al log, fuera del repo. Un candado de un proceso vivo nunca se toca. */
function acquireLock(logFile) {
  const lock = logFile + '.lock';
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const holder = Number.parseInt(fs.readFileSync(lock, 'utf8'), 10);
    if (pidAlive(holder)) return null;
    fs.writeFileSync(lock, String(process.pid));
  }
  return () => { try { if (fs.readFileSync(lock, 'utf8') === String(process.pid)) fs.unlinkSync(lock); } catch { /* ya no está */ } };
}

/**
 * Comprobaciones previas. Solo lectura: devuelve {ok:false, reason} sin
 * modificar nada, o {ok:true, ...} con el estado medido.
 */
export function preflight(runner, root) {
  const top = git(runner, root, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) return { ok: false, reason: 'NOT_A_REPOSITORY: ' + (top.stderr || '').trim() };
  const gitDir = git(runner, root, ['rev-parse', '--absolute-git-dir']).out;
  const commonDir = git(runner, root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).out;
  if (!gitDir || path.resolve(gitDir) !== path.resolve(commonDir)) return { ok: false, reason: 'NOT_MAIN_CHECKOUT: la corrida diaria va en el checkout principal, no en un worktree' };
  const branch = git(runner, root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (branch.status !== 0 || branch.out !== 'main') return { ok: false, reason: 'NOT_MAIN: rama actual ' + (branch.out || 'HEAD separado') };
  const dirty = git(runner, root, ['status', '--porcelain', '--untracked-files=no']);
  if (dirty.status !== 0) return { ok: false, reason: 'GIT_STATUS_FAILED: ' + (dirty.stderr || '').trim() };
  if (dirty.out) return { ok: false, reason: 'DIRTY: cambios rastreados en ' + dirty.out.split(/\r?\n/).length + ' archivo(s)' };
  return { ok: true, top: top.out, head: git(runner, root, ['rev-parse', 'HEAD']).out };
}

/**
 * Corrida completa. `runner` y `steps` se inyectan en las pruebas; `now`
 * fija la fecha del resumen.
 */
export function runDaily(options, { runner = spawnRunner, steps, now = () => new Date(), resolvePython } = {}) {
  const root = path.resolve(options.root);
  const record = { date: now().toISOString(), revision: null, outcome: 'FAILED', structure: 'NOT_RUN', archify: 'NOT_RUN', obsidian: 'NOT_RUN', semanticPending: 'NOT_RUN', reason: null };
  const finish = (code, outcome, reason) => {
    record.outcome = outcome; record.reason = reason;
    const line = formatLine(record);
    appendLog(options.log, line);
    return { code, line, record };
  };

  const release = acquireLock(options.log);
  if (!release) return finish(EXIT.LOCKED, 'LOCKED', 'otra corrida diaria sigue activa');
  try {
    const before = preflight(runner, root);
    if (!before.ok) return finish(EXIT.PRECONDITION, 'STOPPED', before.reason);
    record.revision = before.head.slice(0, 12);

    const fetched = git(runner, root, ['fetch', '--quiet', 'origin', 'main']);
    if (fetched.status !== 0) return finish(EXIT.PRECONDITION, 'STOPPED', 'FETCH_FAILED: ' + lastLine(fetched.stderr));
    const ancestor = git(runner, root, ['merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main']);
    if (ancestor.status !== 0) return finish(EXIT.PRECONDITION, 'STOPPED', 'FF_IMPOSSIBLE: main local no es ancestro de origin/main');
    if (options.dryRun) return finish(EXIT.OK, 'DRY_RUN', 'precondiciones cumplidas; no se ejecutó nada');
    const merged = git(runner, root, ['merge', '--ff-only', '--quiet', 'refs/remotes/origin/main']);
    if (merged.status !== 0) return finish(EXIT.PRECONDITION, 'STOPPED', 'FF_FAILED: ' + lastLine(merged.stderr));
    record.revision = git(runner, root, ['rev-parse', 'HEAD']).out.slice(0, 12);

    let plan = steps;
    if (!plan) {
      let python = options.python;
      if (!python) {
        try { python = (resolvePython ?? (() => null))(root); } catch (error) { return finish(EXIT.STEP_FAILED, 'FAILED', 'PYTHON: ' + error.message); }
      }
      if (!python) return finish(EXIT.STEP_FAILED, 'FAILED', 'PYTHON: Graphify Python no localizado');
      plan = mechanicalSteps({ root, python });
    }
    // Tras la primera falla se saltan los pasos que escriben, pero `check`
    // (lectura) corre siempre para que el resumen diga en qué estado quedó.
    let failure = null;
    for (const step of plan) {
      if (failure && step.name !== 'check') continue;
      const result = runner(step.command, step.args, { cwd: root });
      if (step.name === 'check') Object.assign(record, summarizeCheck(result.stdout));
      if (step.name === 'structure' && result.status !== 0) record.structure = 'UPDATE_FAILED';
      if (result.status !== 0 && !failure) {
        const tail = (result.stderr || result.stdout || '').trim().split(/\r?\n/).slice(-1)[0] || 'exit ' + result.status;
        failure = step.name.toUpperCase() + '_FAILED: ' + tail.slice(0, 300);
      }
    }
    if (failure) return finish(EXIT.STEP_FAILED, 'FAILED', failure);

    // Lo mecánico no debe tocar archivos rastreados; si los tocó, se informa y no se revierte.
    const after = git(runner, root, ['status', '--porcelain', '--untracked-files=no']);
    if (after.status !== 0 || after.out) return finish(EXIT.STEP_FAILED, 'FAILED', 'TRACKED_CHANGED: la corrida dejó cambios rastreados; revisar a mano');
    return finish(EXIT.OK, 'OK', null);
  } finally {
    release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exit(EXIT.USAGE); }
  const { resolvePython } = await import('./lib/knowledge-state.mjs');
  try {
    const { code, line } = runDaily(options, { resolvePython });
    console.log(line);
    process.exitCode = code;
  } catch (error) {
    console.error('knowledge-daily: ' + error.message);
    try { appendLog(options.log, new Date().toISOString() + ' resultado=ERROR motivo=' + JSON.stringify(error.message)); } catch { /* sin log */ }
    process.exitCode = EXIT.STEP_FAILED;
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runDaily, spawnRunner, summarizeCheck, parseArgs, EXIT } from '../knowledge-daily.mjs';

// Git real en carpetas temporales; Graphify, Archify y la bóveda son dobles:
// cada paso mecánico es un `node -e` que deja constancia en un archivo.
const script = fileURLToPath(new URL('../knowledge-daily.mjs', import.meta.url));

function g(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=Prueba', '-c', 'user.email=prueba@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

function fixture(t) {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-daily-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const origin = path.join(base, 'origin.git');
  const seed = path.join(base, 'seed');
  const root = path.join(base, 'principal');
  g(base, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  g(base, 'init', '--quiet', '--initial-branch=main', seed);
  fs.writeFileSync(path.join(seed, 'README.md'), 'uno\n');
  g(seed, 'add', 'README.md');
  g(seed, 'commit', '--quiet', '-m', 'uno');
  g(seed, 'remote', 'add', 'origin', origin);
  g(seed, 'push', '--quiet', 'origin', 'main');
  g(base, 'clone', '--quiet', origin, root);
  const advanceOrigin = (content = 'dos\n') => {
    fs.writeFileSync(path.join(seed, 'README.md'), content);
    g(seed, 'commit', '--quiet', '-am', 'avance');
    g(seed, 'push', '--quiet', 'origin', 'main');
    return g(seed, 'rev-parse', 'HEAD');
  };
  const trace = path.join(base, 'pasos.log');
  const log = path.join(base, 'fuera-del-repo', 'knowledge-daily.log');
  return { base, origin, root, advanceOrigin, trace, log };
}

const checkJson = JSON.stringify({ ok: true, structural: { status: 'CURRENT' }, archify: { status: 'CURRENT' }, obsidian: { status: 'CURRENT' },
  semanticCoverage: { pilot: { targetCount: 16, verifiedCount: 16 }, global: { pendingCount: 1057 } } });

function fakeSteps(trace, { fail, touch, checkStatus = 0 } = {}) {
  const record = (name, extra = '') => `require('fs').appendFileSync(${JSON.stringify(trace)}, ${JSON.stringify(name)} + '\\n');${extra}`;
  const step = (name) => {
    let body = record(name);
    if (touch === name) body += "require('fs').writeFileSync('README.md', 'tocado\\n');";
    if (name === 'check') body += `process.stdout.write(${JSON.stringify(checkJson)});process.exitCode=${checkStatus};`;
    if (fail === name) body += "console.error('se cayó ' + " + JSON.stringify(name) + ");process.exitCode=1;";
    return { name, command: process.execPath, args: ['-e', body] };
  };
  return ['structure', 'visual', 'publish', 'check'].map(step);
}

const steps = (trace) => (fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n') : []);
const logLines = (log) => fs.readFileSync(log, 'utf8').trim().split('\n');
const now = () => new Date('2026-11-10T02:00:00.000Z');

function snapshot(root) {
  return { head: g(root, 'rev-parse', 'HEAD'), status: g(root, 'status', '--porcelain'), readme: fs.readFileSync(path.join(root, 'README.md'), 'utf8'),
    originMain: g(root, 'rev-parse', 'refs/remotes/origin/main') };
}

test('checkout sucio: para sin ejecutar nada ni tocar el árbol', (t) => {
  const f = fixture(t);
  f.advanceOrigin();
  fs.writeFileSync(path.join(f.root, 'README.md'), 'cambio sin commit\n');
  const before = snapshot(f.root);
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace), now });
  assert.equal(result.code, EXIT.PRECONDITION);
  assert.match(result.line, /resultado=STOPPED .*DIRTY/);
  assert.deepEqual(snapshot(f.root), before, 'ni fetch, ni merge, ni limpieza');
  assert.deepEqual(steps(f.trace), []);
  assert.equal(logLines(f.log).length, 1);
});

test('otra rama: para sin ejecutar nada', (t) => {
  const f = fixture(t);
  f.advanceOrigin();
  g(f.root, 'switch', '--quiet', '-c', 'otra');
  const before = snapshot(f.root);
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace), now });
  assert.equal(result.code, EXIT.PRECONDITION);
  assert.match(result.line, /NOT_MAIN: rama actual otra/);
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(g(f.root, 'branch', '--show-current'), 'otra');
  assert.deepEqual(steps(f.trace), []);
});

test('HEAD separado: para sin ejecutar nada', (t) => {
  const f = fixture(t);
  g(f.root, 'switch', '--quiet', '--detach');
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace), now });
  assert.equal(result.code, EXIT.PRECONDITION);
  assert.match(result.line, /NOT_MAIN: rama actual HEAD separado/);
  assert.deepEqual(steps(f.trace), []);
});

test('fast-forward imposible: para sin merge ni pasos', (t) => {
  const f = fixture(t);
  f.advanceOrigin();
  fs.writeFileSync(path.join(f.root, 'local.txt'), 'commit local\n');
  g(f.root, 'add', 'local.txt');
  g(f.root, 'commit', '--quiet', '-m', 'local');
  const head = g(f.root, 'rev-parse', 'HEAD');
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace), now });
  assert.equal(result.code, EXIT.PRECONDITION);
  assert.match(result.line, /FF_IMPOSSIBLE/);
  assert.equal(g(f.root, 'rev-parse', 'HEAD'), head, 'el commit local sigue en su sitio');
  assert.equal(g(f.root, 'status', '--porcelain'), '');
  assert.deepEqual(steps(f.trace), []);
});

test('worktree enlazado: no es el checkout principal', (t) => {
  const f = fixture(t);
  const linked = path.join(f.base, 'enlazado');
  g(f.root, 'worktree', 'add', '--quiet', linked, '-b', 'main-copia');
  const result = runDaily({ root: linked, log: f.log }, { steps: fakeSteps(f.trace), now });
  assert.equal(result.code, EXIT.PRECONDITION);
  assert.match(result.line, /NOT_MAIN_CHECKOUT/);
  assert.deepEqual(steps(f.trace), []);
});

test('corrida feliz: fast-forward, cuatro pasos en orden y resumen de una línea', (t) => {
  const f = fixture(t);
  const target = f.advanceOrigin();
  fs.writeFileSync(path.join(f.root, 'sin-seguimiento.txt'), 'se conserva\n');
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace), now });
  assert.equal(result.code, EXIT.OK, result.line);
  assert.equal(g(f.root, 'rev-parse', 'HEAD'), target);
  assert.deepEqual(steps(f.trace), ['structure', 'visual', 'publish', 'check']);
  assert.equal(result.line, `2026-11-10T02:00:00.000Z rev=${target.slice(0, 12)} resultado=OK estructura=CURRENT archify=CURRENT obsidian=CURRENT semantico_pendiente=piloto=0 global=1057`);
  assert.deepEqual(logLines(f.log), [result.line]);
  assert.ok(fs.existsSync(path.join(f.root, 'sin-seguimiento.txt')));
  // Nunca publica: origin/main del bare sigue en el mismo commit y no hay commits nuevos.
  assert.equal(g(f.origin, 'rev-parse', 'main'), target);
  assert.equal(g(f.root, 'rev-list', '--count', 'HEAD'), '2');
});

test('idempotente: la segunda corrida sin novedades queda igual y suma otra línea', (t) => {
  const f = fixture(t);
  f.advanceOrigin();
  const first = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace), now });
  const second = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace), now });
  assert.equal(second.code, EXIT.OK);
  assert.equal(second.line, first.line);
  assert.equal(logLines(f.log).length, 2);
});

test('un paso que falla: salida 1, salta los que escriben y check igual informa', (t) => {
  const f = fixture(t);
  f.advanceOrigin();
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace, { fail: 'visual' }), now });
  assert.equal(result.code, EXIT.STEP_FAILED);
  assert.deepEqual(steps(f.trace), ['structure', 'visual', 'check']);
  assert.match(result.line, /resultado=FAILED .*archify=CURRENT .*motivo="VISUAL_FAILED: se cayó visual"/);
});

test('check en rojo: salida 1 con el estado medido', (t) => {
  const f = fixture(t);
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace, { checkStatus: 1 }), now });
  assert.equal(result.code, EXIT.STEP_FAILED);
  assert.match(result.line, /CHECK_FAILED/);
});

test('si un paso cambia un archivo rastreado, falla y no lo revierte', (t) => {
  const f = fixture(t);
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace, { touch: 'publish' }), now });
  assert.equal(result.code, EXIT.STEP_FAILED);
  assert.match(result.line, /TRACKED_CHANGED/);
  assert.equal(fs.readFileSync(path.join(f.root, 'README.md'), 'utf8'), 'tocado\n');
});

test('candado de un proceso vivo: no corre', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.dirname(f.log), { recursive: true });
  fs.writeFileSync(f.log + '.lock', String(process.pid));
  const result = runDaily({ root: f.root, log: f.log }, { steps: fakeSteps(f.trace), now });
  assert.equal(result.code, EXIT.LOCKED);
  assert.deepEqual(steps(f.trace), []);
  assert.equal(fs.readFileSync(f.log + '.lock', 'utf8'), String(process.pid), 'el candado ajeno sigue');
});

test('--dry-run: comprueba y no hace merge', (t) => {
  const f = fixture(t);
  f.advanceOrigin();
  const head = g(f.root, 'rev-parse', 'HEAD');
  const result = runDaily({ root: f.root, log: f.log, dryRun: true }, { steps: fakeSteps(f.trace), now });
  assert.equal(result.code, EXIT.OK);
  assert.match(result.line, /resultado=DRY_RUN/);
  assert.equal(g(f.root, 'rev-parse', 'HEAD'), head);
  assert.deepEqual(steps(f.trace), []);
});

test('el guion nunca invoca commit, push, reset, stash, clean ni rm', (t) => {
  const f = fixture(t);
  f.advanceOrigin();
  const calls = [];
  const runner = (command, args, opts) => { calls.push([command, ...args]); return spawnRunner(command, args, opts); };
  runDaily({ root: f.root, log: f.log }, { runner, steps: fakeSteps(f.trace), now });
  const gitVerbs = calls.filter(([command]) => command === 'git').map(([, verb]) => verb);
  for (const verb of ['commit', 'push', 'reset', 'stash', 'clean', 'rm', 'checkout', 'restore']) assert.ok(!gitVerbs.includes(verb), verb);
  assert.deepEqual([...new Set(gitVerbs)].sort(), ['fetch', 'merge', 'merge-base', 'rev-parse', 'status', 'symbolic-ref']);
});

test('CLI: checkout sucio sale con 2 y escribe el log indicado', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'README.md'), 'sucio\n');
  const result = spawnSync(process.execPath, [script, '--root', f.root, '--log', f.log], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, EXIT.PRECONDITION, result.stderr);
  assert.match(result.stdout, /DIRTY/);
  assert.match(fs.readFileSync(f.log, 'utf8'), /DIRTY/);
});

test('CLI: opción desconocida sale con 64', () => {
  const result = spawnSync(process.execPath, [script, '--commit'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, EXIT.USAGE);
});

test('resumen y argumentos', () => {
  assert.deepEqual(summarizeCheck('no es json'), { structure: 'UNKNOWN', archify: 'UNKNOWN', obsidian: 'UNKNOWN', semanticPending: 'UNKNOWN' });
  assert.equal(summarizeCheck(checkJson).semanticPending, 'piloto=0 global=1057');
  const parsed = parseArgs(['--root', 'x', '--dry-run'], { LOCALAPPDATA: 'C:\\L' });
  assert.equal(parsed.root, 'x');
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.log, path.join('C:\\L', 'dtd-cargo', 'knowledge-daily.log'));
  assert.throws(() => parseArgs(['--log']), /Falta valor/);
});

/**
 * scripts/verify-runner.mjs — cómo corre `verify` UN paso: preflight,
 * intentos, absolvedor, watchdog y clasificación del resultado.
 *
 * Vive fuera de `verify.mjs` para probarlo con pasos falsos sin correr el gate
 * entero (SDD-0454): el contrato de un paso colgado —FALLÓ con motivo, sin
 * reintento ni absolución, y el gate sigue con el paso siguiente— se verifica
 * contra ESTE código, no contra una copia.
 */
import { spawnSync } from "node:child_process";
import {
  describeKill,
  describeTimeout,
  monotonicNow,
  runWatched,
} from "./verify-watchdog.mjs";

export const C = { green: "\x1b[32m", red: "\x1b[31m", dim: "\x1b[2m", yellow: "\x1b[33m", nc: "\x1b[0m" };

/** Las líneas del gate. Las pruebas reemplazan `write` para leerlas. */
export function createReporter(write = (linea) => console.log(linea)) {
  return {
    line: write,
    ok: (m) => write(`${C.green}[OK]${C.nc}   ${m}`),
    fail: (m) => write(`${C.red}[FAIL]${C.nc} ${m}`),
    skip: (m) => write(`${C.yellow}[SKIP]${C.nc} ${m}`),
    warn: (m) => write(`${C.yellow}[AVISO]${C.nc} ${m}`),
  };
}

/**
 * Contrato de salida de los pasos que DEGRADAN CON GRACIA (sql-tests,
 * schema-rebuild, edge-functions, migrations-applied): 0 = corrio y paso ·
 * 1 = fallo · 3 = NO CORRIO. Antes el salto salia 0 y era indistinguible de un
 * verde. Si agregas un paso que puede auto-omitirse, sale con este codigo.
 */
export const EXIT_SKIPPED = 3;

const exitDe = (r) => (r ? (r.status ?? "señal " + r.signal) : "—");

/**
 * Corre `step` y devuelve lo que el resumen necesita:
 * `{ outcome, attempts, skipped?, failure? }`, con `failure = { name, reason }`.
 * `reason` es null en un fallo común; sólo el watchdog pone uno (COLGADO/TIMEOUT).
 *
 * Un paso con `watchdog` (`{ idleMs, totalMs, idleVar, totalVar }`) corre bajo
 * `runWatched`; los demás, con `spawnSync` heredando la terminal, como siempre.
 */
export async function runStep(step, {
  out = createReporter(),
  cwd = process.cwd(),
  baseEnv = process.env,
  beforeAttempt = () => {},
  stdout = process.stdout,
  stderr = process.stderr,
  syncStdio = "inherit",
  now = monotonicNow,
} = {}) {
  out.line(`\n${C.dim}── ${step.name} ──────────────────────────────────${C.nc}`);
  let preflightEnv = null;
  if (step.preflight) {
    const pf = step.preflight();
    if (pf?.skip) {
      out.skip(`${step.name}: ${pf.reason}`);
      return { outcome: "skipped", attempts: 0, skipped: { name: step.name, reason: pf.reason } };
    }
    if (pf?.note) out.line(`${C.dim}   ${pf.note}${C.nc}`);
    preflightEnv = pf?.env ?? null;
  }
  const env =
    step.env || preflightEnv
      ? { ...baseEnv, ...step.env, ...preflightEnv }
      : baseEnv;
  const attempts = (step.retry ?? 0) + 1;
  const limites = step.watchdog ?? null;
  // Un solo presupuesto para el paso ENTERO, reintento incluido.
  const deadlineAt = limites ? now() + limites.totalMs : null;
  let r = null;
  let absuelto = null;
  let colgado = null;
  let intentos = 0;
  for (let i = 1; i <= attempts; i++) {
    beforeAttempt();
    if (limites) {
      if (now() >= deadlineAt) {
        colgado = { kind: "total", beforeAttempt: true, previous: exitDe(r) };
        break;
      }
      intentos = i;
      r = await runWatched({
        command: process.execPath,
        args: step.argv,
        cwd,
        env,
        idleMs: limites.idleMs,
        deadlineAt,
        stdout,
        stderr,
        now,
        onTimeout: (motivo) =>
          out.warn(
            `${step.name}: ${describeTimeout(motivo, limites)} → el watchdog termina sólo el árbol de procesos de este paso`,
          ),
      });
      // Un cuelgue no se reintenta ni se absuelve: no es un test flaky, y
      // reintentarlo sólo duplicaría la espera — o lo pintaría de verde.
      if (r.timedOut) {
        colgado = r.timedOut;
        break;
      }
    } else {
      intentos = i;
      r = spawnSync(process.execPath, step.argv, { stdio: syncStdio, cwd, env });
    }
    // Un SALTO no se reintenta: falta Docker/Deno/credenciales, y eso no cambia
    // por correrlo de nuevo — sólo imprimiría el mismo [SKIP] dos veces.
    if (r.status === 0 || r.status === EXIT_SKIPPED) break;
    // Antes de gastar un reintento: ¿el proceso se fue mal habiendo pasado todo?
    absuelto = step.absolver ? step.absolver() : null;
    if (absuelto) break;
    if (i < attempts) {
      out.line(`${C.dim}   ${step.name} falló (exit ${exitDe(r)}) → reintento ${i}/${attempts - 1} (flaky conocido)${C.nc}`);
    }
  }

  if (colgado) {
    // FALLÓ, nunca SKIP ni verde: el paso corrió y no terminó.
    const reason = describeTimeout(colgado, limites);
    if (r?.kill) out.warn(describeKill(r.kill));
    out.fail(`${step.name} — ${reason}`);
    return { outcome: "failed", attempts: intentos, failure: { name: step.name, reason } };
  }
  if (r.status === EXIT_SKIPPED) {
    // El hijo se auto-omitio (sin Docker, sin Deno, sin credenciales). Antes
    // salia 0 y aca se imprimia [OK]: el gate no podia distinguir "paso" de
    // "no corrio", y un cierre declaraba TODO VERDE con pasos apagados.
    out.warn(`${step.name}: OMITIDO — no se midio`);
    return {
      outcome: "skipped",
      attempts: intentos,
      skipped: { name: step.name, reason: "no se midio (ver su [SKIP] arriba)" },
    };
  }
  if (r.status === 0) {
    out.ok(step.name);
    return { outcome: "ok", attempts: intentos };
  }
  if (absuelto) {
    // Amarillo, no verde: pasó, pero que se vea que hubo una anomalía.
    out.warn(absuelto);
    out.ok(`${step.name} (con aviso)`);
    return { outcome: "absolved", attempts: intentos };
  }
  out.fail(`${step.name} (exit ${exitDe(r)})`);
  return { outcome: "failed", attempts: intentos, failure: { name: step.name, reason: null } };
}

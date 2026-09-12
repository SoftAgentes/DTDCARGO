/**
 * scripts/verify-watchdog.mjs — watchdog de los pasos de `verify` que pueden
 * colgarse sin terminar nunca (SDD-0454).
 *
 * El 2026-09-11, con varios Workers corriendo `verify` a la vez en worktrees
 * distintos, el e2e dejó de escribir salida durante más de 30 y 48 minutos
 * (handoffs L21 y L08; L09 y L13 ya mostraban el patrón). El gate no tenía
 * salida: `spawnSync` espera para siempre, y hubo que reconstruir a mano el
 * árbol corepack → verify.mjs → Playwright → next dev → Chrome para cortarlo
 * con `taskkill /T /F`.
 *
 * El `timeout` de `spawnSync` no alcanza: mata sólo al hijo DIRECTO y deja
 * huérfanos al `next dev` (con su puerto), a los workers y a los navegadores.
 * Matar el grupo de procesos tampoco: en POSIX Playwright lanza el webServer y
 * los navegadores `detached`, cada uno en su propio grupo.
 *
 * Qué hace: corre el paso con la salida canalizada —se reenvía tal cual, y así
 * se mide la inactividad—, vigila dos límites (silencio y duración total) y, si
 * vence uno, termina el árbol que cuelga de SU hijo. El árbol se arma por
 * parentesco (PID → PPID) desde ese hijo: nunca por nombre, puerto ni ruta,
 * porque otros worktrees corren los mismos binarios, y el `next dev` que el
 * gate reusa de este worktree no es suyo.
 */
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MINUTO = 60_000;
const MAX_MINUTOS = 24 * 60;

/** Variables que configuran el watchdog del e2e, en minutos (admiten decimales). */
export const WATCHDOG_ENV = Object.freeze({
  idle: "VERIFY_E2E_IDLE_MIN",
  total: "VERIFY_E2E_TIMEOUT_MIN",
});

/**
 * Límites por defecto, en minutos.
 *
 * - Inactividad 10. El silencio legítimo más largo de una corrida sana es el
 *   cierre de un worker que no sale: Playwright 1.60 lo espera 300 s, lo mata y
 *   ESCRIBE el error (`PWTEST_CHILD_PROCESS_TIMEOUT`, `lib/runner/index.js`).
 *   El `webServer` tiene 120 s y cada test 60 s. Diez minutos es el doble del
 *   peor silencio sano; los cuelgues observados pasaron de 30.
 * - Total 60, para el paso completo con su reintento. Una pasada entera midió
 *   11–14 min (L13, L21), más ~5 de cierre; dos pasadas quedan cerca de 40. Es
 *   el respaldo ante una salida que gotea sin terminar nunca, que la
 *   inactividad no ve.
 */
export const WATCHDOG_DEFAULTS_MIN = Object.freeze({ idle: 10, total: 60 });

/** Reloj monotónico: un ajuste de la hora del sistema no dispara ni frena el watchdog. */
export const monotonicNow = () => performance.now();

/**
 * Límites del entorno. Un valor inválido ROMPE el gate antes de correr nada,
 * igual que una política de pasos incompleta: un watchdog mal configurado en
 * silencio es peor que ninguno. No se puede apagar: `0` es inválido.
 */
export function resolveWatchdogLimits(env = process.env) {
  const leer = (clave) => {
    const nombre = WATCHDOG_ENV[clave];
    const crudo = env[nombre];
    if (crudo === undefined || String(crudo).trim() === "") return WATCHDOG_DEFAULTS_MIN[clave];
    const texto = String(crudo).trim();
    const minutos = /^\d+(?:\.\d+)?$/.test(texto) ? Number(texto) : Number.NaN;
    if (!(minutos > 0) || minutos > MAX_MINUTOS) {
      throw new Error(
        `${nombre}="${crudo}" inválido: minutos > 0 y ≤ ${MAX_MINUTOS} (admite decimales; el watchdog no se apaga).`,
      );
    }
    return minutos;
  };
  const idleMin = leer("idle");
  const totalMin = leer("total");
  return Object.freeze({
    idleMs: Math.round(idleMin * MINUTO),
    totalMs: Math.round(totalMin * MINUTO),
    idleVar: WATCHDOG_ENV.idle,
    totalVar: WATCHDOG_ENV.total,
  });
}

export function formatDuration(ms) {
  const redondeo = (n) => String(Math.round(n * 10) / 10);
  return ms >= MINUTO ? `${redondeo(ms / MINUTO)} min` : `${redondeo(ms / 1000)} s`;
}

/** Motivo del FALLÓ. Empieza siempre por COLGADO/TIMEOUT: es lo que se cita al cerrar. */
export function describeTimeout(timedOut, limits) {
  if (timedOut.kind === "idle") {
    return (
      `COLGADO/TIMEOUT: sin salida durante ${formatDuration(timedOut.silentMs)}; ` +
      `límite de inactividad ${formatDuration(limits.idleMs)} (${limits.idleVar})`
    );
  }
  if (timedOut.beforeAttempt) {
    return (
      `COLGADO/TIMEOUT: agotó el límite total del paso, ${formatDuration(limits.totalMs)}, ` +
      `antes del reintento; el intento anterior salió con exit ${timedOut.previous} (${limits.totalVar})`
    );
  }
  return `COLGADO/TIMEOUT: superó el límite total del paso, ${formatDuration(limits.totalMs)} (${limits.totalVar})`;
}

/** Evidencia del corte: qué se terminó y si quedó algo vivo. */
export function describeKill(report) {
  if (!report) return "watchdog: sin informe de terminación.";
  const partes = [`raíz PID ${report.rootPid}`];
  if (report.inventory === "ok") {
    const porNombre = new Map();
    for (const p of report.targets) porNombre.set(p.name, (porNombre.get(p.name) ?? 0) + 1);
    const detalle = [...porNombre]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([nombre, cuantos]) => `${nombre}×${cuantos}`)
      .join(", ");
    partes.push(`${report.targets.length} proceso(s) del árbol propio terminados (${detalle})`);
  } else {
    partes.push(`inventario ${report.inventory}; se cortó sólo desde la raíz`);
  }
  const vivos = report.survivors ?? [];
  partes.push(
    vivos.length === 0
      ? "sobrevivientes: 0"
      : `SOBREVIVIENTES: ${vivos.length} (${vivos.map((p) => `PID ${p.pid} ${p.name}`).join(", ")}) — revisar a mano`,
  );
  const enCierre = report.closing ?? [];
  if (enCierre.length > 0) partes.push(`${enCierre.length} aún en cierre del sistema, ya no corren`);
  if (report.error) partes.push(`error: ${report.error}`);
  return `watchdog: ${partes.join("; ")}.`;
}

const PS_WINDOWS =
  "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-CimInstance Win32_Process | ForEach-Object { " +
  "'{0}|{1}|{2}|{3}' -f $_.ProcessId,$_.ParentProcessId," +
  "$(if($_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{''}),$_.Name }";

/**
 * Tabla de procesos del sistema: `{ pid, ppid, created, name }`. En Windows
 * trae la hora de creación, que hace falta porque allí un PPID puede apuntar a
 * un padre muerto cuyo PID ya se reusó. En POSIX el huérfano se re-parenta, así
 * que el PPID siempre es de un proceso vivo y no hace falta.
 */
export async function listProcesses({ platform = process.platform, timeoutMs = 30_000 } = {}) {
  const opciones = { encoding: "utf8", timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true };
  if (platform === "win32") {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", PS_WINDOWS],
      opciones,
    );
    return parseProcessTable(stdout, "windows");
  }
  const { stdout } = await execFileAsync("ps", ["-A", "-o", "pid=,ppid=,comm="], opciones);
  return parseProcessTable(stdout, "ps");
}

export function parseProcessTable(text, format) {
  const filas = [];
  for (const linea of String(text).split(/\r?\n/)) {
    if (!linea.trim()) continue;
    if (format === "windows") {
      const [pid, ppid, created, ...nombre] = linea.split("|");
      filas.push({ pid: Number(pid), ppid: Number(ppid), created: created || null, name: nombre.join("|").trim() || "?" });
    } else {
      const m = linea.match(/^\s*(\d+)\s+(\d+)\s*(.*)$/);
      if (m) filas.push({ pid: Number(m[1]), ppid: Number(m[2]), created: null, name: m[3].trim() || "?" });
    }
  }
  return filas.filter((p) => Number.isInteger(p.pid) && Number.isInteger(p.ppid));
}

function anterior(a, b) {
  return a.length === b.length ? a < b : Date.parse(a) < Date.parse(b);
}

function mismoProceso(conocido, actual) {
  return Boolean(actual) && (conocido.created == null || actual.created == null || conocido.created === actual.created);
}

/**
 * Descendientes alcanzables desde `semillas` (Map pid → proceso ya conocido)
 * que la tabla todavía muestra como EL MISMO proceso. Un hijo no puede ser
 * anterior a su padre: si lo es, el parentesco es un PID reusado y se descarta.
 */
function descendientesNuevos(semillas, tabla) {
  const porPid = new Map(tabla.map((p) => [p.pid, p]));
  const hijos = new Map();
  for (const p of tabla) {
    if (p.pid === p.ppid) continue; // Idle/System en Windows: su propio padre
    if (!hijos.has(p.ppid)) hijos.set(p.ppid, []);
    hijos.get(p.ppid).push(p);
  }
  const vistos = new Set(semillas.keys());
  const cola = [...semillas.values()].filter((s) => mismoProceso(s, porPid.get(s.pid)));
  const nuevos = [];
  while (cola.length > 0) {
    const padre = cola.shift();
    for (const hijo of hijos.get(padre.pid) ?? []) {
      if (vistos.has(hijo.pid)) continue;
      if (padre.created && hijo.created && anterior(hijo.created, padre.created)) continue;
      vistos.add(hijo.pid);
      nuevos.push(hijo);
      cola.push(hijo);
    }
  }
  return nuevos;
}

/** La raíz y todo lo que cuelga de ella según la tabla. */
export function descendantsOf(rootPid, table) {
  const raiz = table.find((p) => p.pid === rootPid) ?? { pid: rootPid, ppid: null, created: null, name: "?" };
  return [raiz, ...descendientesNuevos(new Map([[raiz.pid, raiz]]), table)];
}

/** ¿Sigue corriendo? En Linux un zombi responde a la señal 0 pero ya no retiene nada. */
export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
  } catch (error) {
    return error.code === "EPERM";
  }
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const estado = stat.slice(stat.lastIndexOf(")") + 2).charAt(0);
    if (estado === "Z" || estado === "X") return false;
  } catch {}
  return true;
}

const primeraLinea = (error) => String(error?.message ?? error).split(/\r?\n/)[0];
const dormir = (ms) => new Promise((listo) => setTimeout(listo, ms));

async function esperarQueTerminen(procesos, { isAlive, settleMs, pollMs }) {
  const limite = monotonicNow() + settleMs;
  let vivos = procesos.filter((p) => isAlive(p.pid));
  while (vivos.length > 0 && monotonicNow() < limite) {
    await dormir(pollMs);
    vivos = vivos.filter((p) => isAlive(p.pid));
  }
  return vivos;
}

async function confirmarMismos(procesos, list) {
  try {
    const actual = new Map((await list()).map((p) => [p.pid, p]));
    return procesos.filter((p) => mismoProceso(p, actual.get(p.pid)));
  } catch {
    return null; // sin tabla no se re-mata nada: el PID podría ser de otro
  }
}

/**
 * Termina `rootPid` y sus descendientes, y sólo a ellos.
 *
 * Ronda 0: inventario y corte de todo el árbol de una vez, por PID (el mismo
 * TerminateProcess/SIGKILL que `taskkill /F`). Rondas siguientes: lo que haya
 * nacido de un proceso del árbol mientras tanto. No se usa `taskkill /T`, que
 * arma el árbol sin mirar la hora de creación y con un PID reusado puede
 * alcanzar a un proceso ajeno; queda sólo como respaldo si no hay inventario.
 * Antes de acusar —o re-matar— a un sobreviviente se confirma que su PID sigue
 * siendo el mismo proceso.
 */
export async function killProcessTree(rootPid, {
  platform = process.platform,
  list = () => listProcesses({ platform }),
  kill = (pid) => process.kill(pid, "SIGKILL"),
  treeFallback = platform === "win32"
    ? (pid) => execFileAsync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, timeout: 30_000 })
    : async () => {},
  isAlive = isProcessAlive,
  rounds = 3,
  settleMs = 20_000,
  pollMs = 250,
} = {}) {
  const informe = { rootPid, inventory: "ok", targets: [], survivors: [], error: null };
  const conocidos = new Map();
  const matar = (p) => {
    try {
      kill(p.pid);
    } catch (error) {
      if (error?.code !== "ESRCH" && !informe.error) informe.error = `PID ${p.pid}: ${error?.code ?? primeraLinea(error)}`;
    }
  };

  for (let ronda = 0; ronda < rounds; ronda++) {
    let tabla;
    try {
      tabla = await list();
    } catch (error) {
      if (ronda === 0) {
        // Sin inventario no hay forma segura de ver el árbol: queda la raíz,
        // que es nuestra con certeza, y el corte de árbol del sistema.
        informe.inventory = `no disponible (${primeraLinea(error)})`;
        const raiz = { pid: rootPid, ppid: null, created: null, name: "?" };
        conocidos.set(rootPid, raiz);
        await Promise.resolve()
          .then(() => treeFallback(rootPid))
          .catch(() => {});
        matar(raiz);
      }
      break;
    }
    const nuevos = ronda === 0 ? descendantsOf(rootPid, tabla) : descendientesNuevos(conocidos, tabla);
    if (nuevos.length === 0) break;
    for (const p of nuevos) conocidos.set(p.pid, p);
    for (const p of nuevos) matar(p);
  }
  informe.targets = [...conocidos.values()];

  let vivos = await esperarQueTerminen(informe.targets, { isAlive, settleMs, pollMs });
  if (vivos.length > 0 && informe.inventory === "ok") {
    const mismos = await confirmarMismos(vivos, list);
    if (mismos) {
      for (const p of mismos) matar(p);
      vivos = await esperarQueTerminen(mismos, { isAlive, settleMs: Math.min(settleMs, 5_000), pollMs });
      if (vivos.length > 0) vivos = (await confirmarMismos(vivos, list)) ?? vivos;
    }
  }
  informe.survivors = vivos.map(({ pid, name }) => ({ pid, name }));
  // Un proceso ya terminado puede seguir listado mientras el sistema cierra su
  // E/S pendiente (Chrome tardó hasta ~3 min en la validación de SDD-0454; en
  // POSIX es el zombi aún sin recoger). No corre código y el sistema lo libera
  // solo: se informa aparte, nunca como sobreviviente.
  const terminados = informe.targets.filter((p) => !vivos.some((v) => v.pid === p.pid));
  informe.closing =
    informe.inventory === "ok"
      ? ((await confirmarMismos(terminados, list)) ?? []).map(({ pid, name }) => ({ pid, name }))
      : [];
  return informe;
}

/**
 * Corre `command` con la salida canalizada hacia `stdout`/`stderr` y lo vigila.
 *
 * Vence si pasan `idleMs` sin un solo byte de salida, o al llegar a
 * `deadlineAt` (en el reloj `now`). Entonces llama `onTimeout`, termina el
 * árbol con `killTree` y resuelve con `timedOut` y el informe del corte. Una
 * corrida que termina sola resuelve con su `status`/`signal`, sin tocar nada.
 *
 * Nunca espera sin límite: si la raíz no confirma su salida tras el corte, o
 * un descendiente retiene el pipe después de que la raíz salió, la espera se
 * acota con `closeGraceMs`.
 */
export function runWatched({
  command,
  args = [],
  cwd = process.cwd(),
  env = process.env,
  idleMs,
  deadlineAt,
  stdout = process.stdout,
  stderr = process.stderr,
  now = monotonicNow,
  pollMs = Math.min(1_000, Math.max(20, Math.floor(idleMs / 20))),
  closeGraceMs = 5_000,
  killTree = killProcessTree,
  onTimeout = () => {},
}) {
  return new Promise((resolve) => {
    const inicio = now();
    let ultimaSalida = inicio;
    let salida = null;
    let timedOut = null;
    let corte = null;
    let errorDeSpawn = null;
    let resuelto = false;
    let espera = null;
    let vigia = null;

    const child = spawn(command, args, { cwd, env, stdio: ["inherit", "pipe", "pipe"] });

    const terminar = async () => {
      if (resuelto) return;
      resuelto = true;
      clearInterval(vigia);
      clearTimeout(espera);
      const kill = corte ? await corte : null;
      resolve({ status: salida?.code ?? null, signal: salida?.signal ?? null, error: errorDeSpawn, timedOut, kill });
    };
    const soltarCanales = () => {
      child.stdout.destroy();
      child.stderr.destroy();
    };
    const reenviar = (destino) => (chunk) => {
      ultimaSalida = now();
      destino.write(chunk);
    };
    child.stdout.on("data", reenviar(stdout));
    child.stderr.on("data", reenviar(stderr));

    const vencido = () => {
      const t = now();
      if (t - ultimaSalida >= idleMs) return { kind: "idle", silentMs: t - ultimaSalida, elapsedMs: t - inicio };
      if (t >= deadlineAt) return { kind: "total", silentMs: t - ultimaSalida, elapsedMs: t - inicio };
      return null;
    };

    vigia = setInterval(() => {
      if (timedOut || salida || resuelto || !vencido()) return;
      // Antes de acusar: la salida que ya llegó y espera en la cola de E/S cuenta.
      setImmediate(() => {
        if (timedOut || salida || resuelto) return;
        const motivo = vencido();
        if (!motivo) return;
        timedOut = motivo;
        clearInterval(vigia);
        try {
          onTimeout(motivo);
        } catch {}
        corte = Promise.resolve()
          .then(() => killTree(child.pid))
          .catch((error) => ({
            rootPid: child.pid,
            inventory: "error",
            targets: [],
            survivors: [],
            error: primeraLinea(error),
          }));
        corte.then(() => {
          if (salida || resuelto) return;
          // La raíz no confirmó su salida: se la fuerza por su handle y, pasada
          // la gracia, se deja de esperarla. El corte no puede colgar el gate.
          try {
            child.kill("SIGKILL");
          } catch {}
          espera = setTimeout(() => {
            soltarCanales();
            child.unref();
            terminar();
          }, closeGraceMs);
        });
      });
    }, pollMs);

    child.on("error", (error) => {
      errorDeSpawn = error;
      if (!child.pid) terminar(); // no arrancó: no habrá 'exit'
    });
    child.on("exit", (code, signal) => {
      salida = { code, signal };
      clearInterval(vigia);
      // 'close' llega cuando se vació la salida. Un descendiente que heredó el
      // pipe y sigue vivo lo retendría para siempre: la gracia lo acota.
      clearTimeout(espera);
      espera = setTimeout(() => {
        soltarCanales();
        terminar();
      }, closeGraceMs);
    });
    child.on("close", (code, signal) => {
      if (!salida) salida = { code, signal };
      terminar();
    });
  });
}

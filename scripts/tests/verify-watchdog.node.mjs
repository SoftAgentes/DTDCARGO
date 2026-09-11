import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { envParaSalidaCanalizada } from "../verify-e2e.mjs";
import { EXIT_SKIPPED, createReporter, runStep } from "../verify-runner.mjs";
import { buildVerifyVerdict } from "../verify-step-policy.mjs";
import {
  WATCHDOG_ENV,
  describeKill,
  describeTimeout,
  descendantsOf,
  isProcessAlive,
  killProcessTree,
  monotonicNow,
  parseProcessTable,
  resolveWatchdogLimits,
  runWatched,
} from "../verify-watchdog.mjs";

// Procesos de prueba. Sin `${}`: el texto va tal cual al archivo.
const FIXTURES = {
  // Árbol de tres niveles que, una vez completo, calla para siempre. El nivel 0
  // late mientras el árbol se arma, así el silencio empieza con los tres vivos.
  "arbol-colgado.mjs": `
import { spawn } from "node:child_process";
import fs from "node:fs";
const [nivel, hasta, listo] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
console.log("PID " + nivel + " " + process.pid);
if (nivel < hasta) spawn(process.execPath, [process.argv[1], String(nivel + 1), String(hasta), listo], { stdio: "inherit" });
else fs.writeFileSync(listo, String(process.pid));
if (nivel === 0) {
  const latido = setInterval(() => {
    if (!fs.existsSync(listo)) return void console.log("esperando al arbol");
    clearInterval(latido);
    console.log("ARBOL LISTO");
  }, 100);
}
setInterval(() => {}, 1 << 30);
`,
  // Escribe sin parar y no termina nunca: la inactividad no lo ve.
  "charlatan.mjs": `
let n = 0;
setInterval(() => { n += 1; (n % 2 ? process.stdout : process.stderr).write("latido " + n + "\\n"); }, 100);
`,
  // Termina sola con el exit pedido, escribiendo por ambos canales.
  "normal.mjs": `
console.log("salida normal");
console.error("aviso normal");
process.exitCode = Number(process.argv[2] ?? 0);
`,
  // Dura más que el límite de inactividad, pero sin callar nunca.
  "lento-activo.mjs": `
const hasta = Date.now() + Number(process.argv[2]);
const t = setInterval(() => { console.log("sigo vivo"); if (Date.now() >= hasta) clearInterval(t); }, 100);
`,
  // Cuenta sus lanzamientos en un archivo: así se ve si el runner reintentó.
  "contador.mjs": `
import fs from "node:fs";
const [archivo, modo] = process.argv.slice(2);
fs.appendFileSync(archivo, "x");
const intento = fs.readFileSync(archivo, "utf8").length;
console.log("intento " + intento);
if (modo === "cuelga") setInterval(() => {}, 1 << 30);
else if (modo === "falla-luego-pasa") process.exitCode = intento === 1 ? 1 : 0;
else process.exitCode = Number(modo);
`,
};

const node = process.execPath;
const LENTO = { timeout: 120_000 };

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "dtd-verify-watchdog-"));
  for (const [nombre, codigo] of Object.entries(FIXTURES)) writeFileSync(path.join(dir, nombre), codigo);
  t.after(() => {
    // Único destino de borrado recursivo: el temporal de esta prueba.
    const destino = path.resolve(dir);
    const relativo = path.relative(path.resolve(tmpdir()), destino);
    assert.ok(relativo && !relativo.startsWith("..") && !path.isAbsolute(relativo));
    assert.ok(path.basename(destino).startsWith("dtd-verify-watchdog-"));
    rmSync(destino, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  return (nombre) => path.join(dir, nombre);
}

function sumidero() {
  const trozos = [];
  return {
    write(chunk) {
      trozos.push(String(chunk));
      return true;
    },
    texto: () => trozos.join(""),
  };
}

const limites = (idleMs, totalMs) => ({ idleMs, totalMs, idleVar: WATCHDOG_ENV.idle, totalVar: WATCHDOG_ENV.total });
const pidsDe = (texto) => [...texto.matchAll(/^PID (\d+) (\d+)\r?$/gm)].map((m) => ({ nivel: Number(m[1]), pid: Number(m[2]) }));

function matarSiVive(pid) {
  try {
    process.kill(pid, "SIGKILL");
  } catch {}
}

function salidaDePrueba() {
  const lineas = [];
  return {
    lineas,
    opciones: { out: createReporter((linea) => lineas.push(linea)), stdout: sumidero(), stderr: sumidero(), syncStdio: "ignore" },
  };
}

test("límites: defaults, minutos con decimales y rechazo explícito de lo inválido", () => {
  const base = resolveWatchdogLimits({});
  assert.equal(base.idleMs, 10 * 60_000);
  assert.equal(base.totalMs, 60 * 60_000);
  assert.equal(base.idleVar, "VERIFY_E2E_IDLE_MIN");
  assert.equal(base.totalVar, "VERIFY_E2E_TIMEOUT_MIN");
  assert.deepEqual(resolveWatchdogLimits({ VERIFY_E2E_IDLE_MIN: "", VERIFY_E2E_TIMEOUT_MIN: "  " }), base);

  const propio = resolveWatchdogLimits({ VERIFY_E2E_IDLE_MIN: " 0.5 ", VERIFY_E2E_TIMEOUT_MIN: "90" });
  assert.equal(propio.idleMs, 30_000);
  assert.equal(propio.totalMs, 90 * 60_000);

  // `0` no apaga el watchdog: es inválido, igual que cualquier otro valor raro.
  for (const malo of ["0", "0.0", "-1", "abc", "1e3", "Infinity", "10min", "1441", "NaN"]) {
    assert.throws(
      () => resolveWatchdogLimits({ VERIFY_E2E_IDLE_MIN: malo }),
      (error) => error.message.includes(`VERIFY_E2E_IDLE_MIN="${malo}"`),
    );
    assert.throws(() => resolveWatchdogLimits({ VERIFY_E2E_TIMEOUT_MIN: malo }), /VERIFY_E2E_TIMEOUT_MIN/);
  }
});

test("el motivo empieza por COLGADO/TIMEOUT y nombra el límite que venció", () => {
  const base = resolveWatchdogLimits({});
  assert.equal(
    describeTimeout({ kind: "idle", silentMs: 600_400 }, base),
    "COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)",
  );
  assert.equal(
    describeTimeout({ kind: "total", silentMs: 2_000 }, base),
    "COLGADO/TIMEOUT: superó el límite total del paso, 60 min (VERIFY_E2E_TIMEOUT_MIN)",
  );
  assert.match(
    describeTimeout({ kind: "total", beforeAttempt: true, previous: 1 }, base),
    /^COLGADO\/TIMEOUT: agotó el límite total del paso, 60 min, antes del reintento; el intento anterior salió con exit 1/,
  );
  assert.equal(
    describeTimeout({ kind: "idle", silentMs: 1_540 }, limites(1_500, 60_000)),
    "COLGADO/TIMEOUT: sin salida durante 1.5 s; límite de inactividad 1.5 s (VERIFY_E2E_IDLE_MIN)",
  );
});

test("el árbol se arma por PPID, descarta PIDs reusados y deja fuera a los procesos ajenos", () => {
  const windows = parseProcessTable(
    [
      "4|4|2026-09-11T00:00:00.0000000Z|System",
      "100|50|2026-09-11T10:00:00.0000000Z|node.exe",
      "101|100|2026-09-11T10:00:01.0000000Z|cmd.exe",
      "102|101|2026-09-11T10:00:02.0000000Z|node.exe",
      "103|100|2026-09-11T10:00:03.0000000Z|chrome-headless-shell.exe",
      // PPID 100 pero ANTERIOR a la raíz: su padre real murió y el PID 100 se reusó.
      "104|100|2026-09-11T09:00:00.0000000Z|node.exe",
      "105|104|2026-09-11T10:00:05.0000000Z|node.exe",
      // Mismo binario, otro árbol (otro worktree).
      "200|50|2026-09-11T10:00:00.0000000Z|node.exe",
      "201|200|2026-09-11T10:00:01.0000000Z|node.exe",
      // Un ciclo de PPIDs no puede colgar el recorrido.
      "300|301|2026-09-11T10:00:00.0000000Z|a.exe",
      "301|300|2026-09-11T10:00:01.0000000Z|b.exe",
    ].join("\r\n"),
    "windows",
  );
  const pids = (lista) => lista.map((p) => p.pid).sort((a, b) => a - b);
  assert.deepEqual(pids(descendantsOf(100, windows)), [100, 101, 102, 103]);
  assert.deepEqual(pids(descendantsOf(300, windows)), [300, 301]);
  assert.deepEqual(pids(descendantsOf(4, windows)), [4]);

  const posix = parseProcessTable("    1     0 systemd\n  300     1 node\n  301   300 sh\n  302   301 chrome\n  400     1 node\n", "ps");
  assert.deepEqual(pids(descendantsOf(300, posix)), [300, 301, 302]);
  // Raíz que ya no figura: queda sólo ella, sin adivinar parientes.
  assert.deepEqual(pids(descendantsOf(999, posix)), [999]);
});

test("una corrida que termina sola no se toca: exit, salida y canales intactos", LENTO, async (t) => {
  const f = fixture(t);
  for (const codigo of [0, 1, EXIT_SKIPPED]) {
    const stdout = sumidero();
    const stderr = sumidero();
    let cortes = 0;
    const r = await runWatched({
      command: node,
      args: [f("normal.mjs"), String(codigo)],
      idleMs: 30_000,
      deadlineAt: monotonicNow() + 60_000,
      stdout,
      stderr,
      killTree: async () => {
        cortes += 1;
        return null;
      },
    });
    assert.equal(r.status, codigo);
    assert.equal(r.timedOut, null);
    assert.equal(r.kill, null);
    assert.equal(cortes, 0);
    assert.match(stdout.texto(), /salida normal/);
    assert.match(stderr.texto(), /aviso normal/);
    assert.doesNotMatch(stdout.texto(), /aviso normal/);
  }
});

test("la inactividad se mide por salida: un proceso lento que escribe no se corta", LENTO, async (t) => {
  const f = fixture(t);
  const stdout = sumidero();
  const inicio = monotonicNow();
  const r = await runWatched({
    command: node,
    args: [f("lento-activo.mjs"), "5000"],
    idleMs: 3_000,
    deadlineAt: monotonicNow() + 60_000,
    stdout,
    stderr: sumidero(),
    killTree: async () => {
      throw new Error("no debía cortarse");
    },
  });
  assert.equal(r.timedOut, null);
  assert.equal(r.status, 0);
  // Dura más que el límite: sólo pasa si cada línea reinicia la cuenta.
  assert.ok(monotonicNow() - inicio >= 3_000);
  assert.ok((stdout.texto().match(/sigo vivo/g) ?? []).length >= 20);
});

test("un árbol que calla se corta entero por inactividad, y sólo ese árbol", LENTO, async (t) => {
  const f = fixture(t);
  // Mismo script, mismo binario, fuera del árbol: no puede caer.
  const ajeno = spawn(node, [f("arbol-colgado.mjs"), "0", "0", f("ajeno-listo.txt")], { stdio: "ignore" });
  t.after(() => matarSiVive(ajeno.pid));
  const stdout = sumidero();
  const avisos = [];
  const r = await runWatched({
    command: node,
    args: [f("arbol-colgado.mjs"), "0", "2", f("listo.txt")],
    idleMs: 1_500,
    deadlineAt: monotonicNow() + 120_000,
    stdout,
    stderr: sumidero(),
    onTimeout: (motivo) => avisos.push(motivo),
  });
  const pids = pidsDe(stdout.texto());
  t.after(() => pids.forEach(({ pid }) => matarSiVive(pid)));

  assert.match(stdout.texto(), /ARBOL LISTO/);
  assert.deepEqual(pids.map((p) => p.nivel).sort(), [0, 1, 2]);
  assert.equal(r.timedOut?.kind, "idle");
  assert.ok(r.timedOut.silentMs >= 1_500);
  assert.equal(avisos.length, 1);
  assert.equal(r.kill.inventory, "ok");
  const cortados = new Set(r.kill.targets.map((p) => p.pid));
  for (const { nivel, pid } of pids) {
    assert.ok(cortados.has(pid), `nivel ${nivel} (PID ${pid}) no figura en el corte`);
    assert.equal(isProcessAlive(pid), false, `nivel ${nivel} (PID ${pid}) sigue vivo`);
  }
  assert.deepEqual(r.kill.survivors, []);
  assert.equal(cortados.has(ajeno.pid), false);
  assert.equal(isProcessAlive(ajeno.pid), true, "el proceso ajeno no debía tocarse");
  assert.match(describeKill(r.kill), /^watchdog: raíz PID \d+; \d+ proceso\(s\) del árbol propio terminados \(.+\); sobrevivientes: 0\.$/);
});

test("una salida que gotea sin terminar se corta por el límite total", LENTO, async (t) => {
  const f = fixture(t);
  const stdout = sumidero();
  const r = await runWatched({
    command: node,
    args: [f("charlatan.mjs")],
    idleMs: 60_000,
    deadlineAt: monotonicNow() + 1_500,
    stdout,
    stderr: sumidero(),
  });
  t.after(() => matarSiVive(r.kill?.rootPid));
  assert.equal(r.timedOut?.kind, "total");
  assert.ok(r.timedOut.elapsedMs >= 1_500);
  assert.match(stdout.texto(), /latido/);
  assert.deepEqual(r.kill.survivors, []);
  assert.equal(isProcessAlive(r.kill.rootPid), false);
});

test("sin inventario de procesos el corte se limita a la raíz y lo declara", async () => {
  const muertos = [];
  const informe = await killProcessTree(4242, {
    platform: "linux",
    list: async () => {
      throw new Error("ps no disponible");
    },
    kill: (pid) => muertos.push(pid),
    isAlive: () => false,
  });
  assert.deepEqual(muertos, [4242]);
  assert.equal(informe.inventory, "no disponible (ps no disponible)");
  assert.match(describeKill(informe), /se cortó sólo desde la raíz; sobrevivientes: 0/);
});

test("el corte alcanza a lo que nace durante el corte, y nunca a un PID reusado", async () => {
  const tabla = (texto) => parseProcessTable(texto, "windows");
  const raiz = "10|1|2026-09-11T10:00:00.0000000Z|node.exe";
  const hijo = "11|10|2026-09-11T10:00:01.0000000Z|chrome.exe";

  // Un nieto nace entre la foto y el corte: la ronda siguiente lo encuentra.
  const fotos = [tabla([raiz, hijo].join("\n")), tabla([raiz, hijo, "12|11|2026-09-11T10:00:02.0000000Z|chrome.exe"].join("\n"))];
  const muertos = [];
  const informe = await killProcessTree(10, {
    platform: "win32",
    list: async () => fotos[Math.min(fotos.length - 1, muertos.length > 1 ? 1 : 0)],
    kill: (pid) => muertos.push(pid),
    isAlive: () => false,
  });
  assert.deepEqual(muertos, [10, 11, 12]);
  assert.deepEqual(informe.survivors, []);

  // El PID 11 sigue "vivo", pero ya es OTRO proceso: no se re-mata ni se acusa.
  let listados = 0;
  const muertos2 = [];
  const reusado = await killProcessTree(10, {
    platform: "win32",
    list: async () => (listados++ === 0 ? tabla([raiz, hijo].join("\n")) : tabla("11|99|2026-09-11T10:05:00.0000000Z|otro.exe")),
    kill: (pid) => muertos2.push(pid),
    isAlive: (pid) => pid === 11,
    settleMs: 50,
    pollMs: 10,
  });
  assert.deepEqual(muertos2, [10, 11]);
  assert.deepEqual(reusado.survivors, []);

  // Si de verdad sobrevive, se reintenta una vez y se acusa con nombre.
  const muertos3 = [];
  const terco = await killProcessTree(10, {
    platform: "win32",
    list: async () => tabla([raiz, hijo].join("\n")),
    kill: (pid) => muertos3.push(pid),
    isAlive: (pid) => pid === 11,
    settleMs: 50,
    pollMs: 10,
  });
  assert.deepEqual(muertos3, [10, 11, 11]);
  assert.deepEqual(terco.survivors, [{ pid: 11, name: "chrome.exe" }]);
  assert.match(describeKill(terco), /SOBREVIVIENTES: 1 \(PID 11 chrome\.exe\) — revisar a mano/);
});

test("verify: un paso colgado queda FALLÓ con motivo, sin reintento ni absolución, y el gate sigue", LENTO, async (t) => {
  const f = fixture(t);
  const { lineas, opciones } = salidaDePrueba();
  const contador = f("intentos-e2e.txt");
  let absoluciones = 0;
  const colgado = await runStep(
    {
      name: "e2e",
      argv: [f("contador.mjs"), contador, "cuelga"],
      retry: 1,
      watchdog: limites(2_000, 120_000),
      absolver: () => {
        absoluciones += 1;
        return "no debía absolverse";
      },
    },
    opciones,
  );
  // El paso siguiente corre igual: el gate no se quedó esperando.
  const build = await runStep({ name: "build", argv: [f("normal.mjs"), "0"] }, opciones);

  assert.equal(colgado.outcome, "failed");
  assert.equal(colgado.attempts, 1);
  assert.ok((existsSync(contador) ? readFileSync(contador, "utf8").length : 0) <= 1);
  assert.equal(absoluciones, 0);
  assert.equal(colgado.skipped, undefined);
  assert.equal(colgado.failure.name, "e2e");
  assert.match(colgado.failure.reason, /^COLGADO\/TIMEOUT: sin salida durante .+ \(VERIFY_E2E_IDLE_MIN\)$/);

  const texto = lineas.join("\n");
  assert.match(texto, /\[AVISO\].* e2e: COLGADO\/TIMEOUT: .* el watchdog termina sólo el árbol de procesos de este paso/);
  assert.match(texto, /\[AVISO\].* watchdog: raíz PID \d+; .*sobrevivientes: 0\./);
  assert.match(texto, /\[FAIL\].* e2e — COLGADO\/TIMEOUT: sin salida durante/);
  assert.doesNotMatch(texto, /reintento|\[SKIP\]|OMITIDO|\[OK\].*e2e/);
  assert.equal(build.outcome, "ok");

  const verdict = buildVerifyVerdict({ stepNames: ["e2e", "build"], skipped: [], failures: [colgado.failure] });
  assert.equal(verdict.kind, "failed");
  assert.equal(verdict.exitCode, 1);
  assert.equal(verdict.message, `verify: 1 fallo(s) → e2e [${colgado.failure.reason}]`);
});

test("verify: bajo watchdog, reintento, salto, absolución y preflight siguen como antes", LENTO, async (t) => {
  const f = fixture(t);
  const { opciones } = salidaDePrueba();
  const vigia = limites(30_000, 120_000);

  const flaky = await runStep(
    { name: "e2e", argv: [f("contador.mjs"), f("flaky.txt"), "falla-luego-pasa"], retry: 1, watchdog: vigia, absolver: () => null },
    opciones,
  );
  assert.equal(flaky.outcome, "ok");
  assert.equal(flaky.attempts, 2);
  assert.equal(readFileSync(f("flaky.txt"), "utf8"), "xx");

  const salto = await runStep(
    { name: "sql-tests", argv: [f("contador.mjs"), f("salto.txt"), String(EXIT_SKIPPED)], retry: 1, watchdog: vigia },
    opciones,
  );
  assert.deepEqual(salto, { outcome: "skipped", attempts: 1, skipped: { name: "sql-tests", reason: "no se midio (ver su [SKIP] arriba)" } });

  const rojo = await runStep(
    { name: "lint", argv: [f("contador.mjs"), f("rojo.txt"), "1"], retry: 1, watchdog: vigia },
    opciones,
  );
  assert.deepEqual(rojo, { outcome: "failed", attempts: 2, failure: { name: "lint", reason: null } });

  const absuelto = await runStep(
    { name: "e2e", argv: [f("contador.mjs"), f("absuelto.txt"), "1"], retry: 1, watchdog: vigia, absolver: () => "aviso de prueba" },
    opciones,
  );
  assert.deepEqual(absuelto, { outcome: "absolved", attempts: 1 });

  const preflight = await runStep(
    { name: "e2e", argv: [f("normal.mjs")], watchdog: vigia, preflight: () => ({ skip: true, reason: "sin navegadores" }) },
    opciones,
  );
  assert.deepEqual(preflight, { outcome: "skipped", attempts: 0, skipped: { name: "e2e", reason: "sin navegadores" } });

  // Sin watchdog, el camino de siempre (spawnSync) da el mismo resultado.
  const sinVigia = await runStep({ name: "lint", argv: [f("contador.mjs"), f("sin-vigia.txt"), "1"], retry: 1 }, opciones);
  assert.deepEqual(sinVigia, { outcome: "failed", attempts: 2, failure: { name: "lint", reason: null } });
  assert.equal(readFileSync(f("sin-vigia.txt"), "utf8"), "xx");
});

test("verify: si el reintento ya no cabe en el límite total, no se lanza y el motivo lo dice", LENTO, async (t) => {
  const f = fixture(t);
  const { opciones } = salidaDePrueba();
  let reloj = 0;
  const r = await runStep(
    {
      name: "e2e",
      argv: [f("contador.mjs"), f("presupuesto.txt"), "1"],
      retry: 1,
      watchdog: limites(30_000, 60_000),
      // El primer intento "consumió" todo el presupuesto del paso.
      absolver: () => {
        reloj += 61_000;
        return null;
      },
    },
    { ...opciones, now: () => reloj },
  );
  assert.equal(r.outcome, "failed");
  assert.equal(r.attempts, 1);
  assert.equal(readFileSync(f("presupuesto.txt"), "utf8"), "x");
  assert.match(r.failure.reason, /antes del reintento; el intento anterior salió con exit 1 \(VERIFY_E2E_TIMEOUT_MIN\)$/);
});

test("con la salida canalizada, una terminal real conserva el aspecto de Playwright", () => {
  assert.deepEqual(envParaSalidaCanalizada({ isTTY: false }, {}), {});
  assert.deepEqual(envParaSalidaCanalizada(undefined, {}), {});
  assert.deepEqual(envParaSalidaCanalizada({ isTTY: true, columns: 132, rows: 50 }, {}), { PLAYWRIGHT_FORCE_TTY: "132x50" });
  assert.deepEqual(envParaSalidaCanalizada({ isTTY: true }, {}), { PLAYWRIGHT_FORCE_TTY: "100x40" });
  assert.deepEqual(envParaSalidaCanalizada({ isTTY: true, columns: 132, rows: 50 }, { PLAYWRIGHT_FORCE_TTY: "0" }), {});
});

test("verify cablea el watchdog al paso e2e y corre estas pruebas en su harness", async () => {
  const source = await readFile(new URL("../verify.mjs", import.meta.url), "utf8");
  assert.match(source, /resolveWatchdogLimits\(process\.env\)/);
  assert.match(source, /await runStep\(step, /);
  assert.match(source, /"scripts\/tests\/verify-watchdog\.node\.mjs"/);
  const e2e = source.match(/\{\s*name: "e2e",[\s\S]*?\n {2}\},\n/);
  assert.ok(e2e, "no se encontró el paso e2e en STEPS");
  assert.match(e2e[0], /watchdog: e2eWatchdog,/);
  assert.match(e2e[0], /envParaSalidaCanalizada\(process\.stdout\)/);
  assert.match(e2e[0], /retry: 1,/);
});

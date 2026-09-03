/**
 * SDD-0378: WebKit/Windows puede emitir exit0 sin cerrar stdio heredado.
 * El proceso ya terminó; Playwright espera close antes de retirar el worker.
 * Sólo liberamos nuestros canales tras 15s de drenaje. Nunca matar PID,
 * emitir close artificialmente ni convertir un resultado fallido en éxito.
 */
import path from "node:path";
import childProcess from "node:child_process";
import { createRequire, syncBuiltinESMExports } from "node:module";

export function installWebKitExitGuard({
  platform,
  executablePath,
  spawnModule,
  schedule = setTimeout,
  cancel = clearTimeout,
  warn = console.warn,
}) {
  const noOp = { restore() {} };
  if (platform !== "win32" || typeof executablePath !== "string" ||
      !path.win32.isAbsolute(executablePath)) return noOp;
  const target = path.win32.normalize(executablePath).toLowerCase();
  const original = spawnModule.spawn;
  const expectedStdio = ["ignore", "pipe", "pipe", "pipe", "pipe"];
  const pending = new Set();
  let active = true;

  function guardedSpawn(...args) {
    const child = Reflect.apply(original, this, args);
    const [command, browserArgs, options] = args;
    if (!active || typeof command !== "string" || !path.win32.isAbsolute(command) ||
        path.win32.normalize(command).toLowerCase() !== target ||
        !Array.isArray(browserArgs) || !browserArgs.includes("--inspector-pipe") ||
        !options || (options.shell !== undefined && options.shell !== false) ||
        !Array.isArray(options.stdio) ||
        options.stdio.length !== expectedStdio.length ||
        !options.stdio.every((entry, i) => entry === expectedStdio[i])) return child;

    let closed = false;
    let timer;
    child.once("exit", (code, signal) => {
      if (!active || closed || code !== 0 || signal !== null) return;
      timer = schedule(() => {
        pending.delete(timer);
        if (!active || closed || child.exitCode !== 0 || child.signalCode !== null) return;
        const streams = child.stdio.filter((stream) => stream && !stream.destroyed);
        if (streams.length === 0) return;
        warn("[e2e] WebKit terminó con exit0; liberando sólo sus canales propios pendientes de cierre.");
        for (const stream of streams) stream.destroy();
      }, 15_000);
      pending.add(timer);
      timer.unref();
    });
    child.once("close", () => {
      closed = true;
      if (timer !== undefined) {
        cancel(timer);
        pending.delete(timer);
      }
    });
    return child;
  }

  spawnModule.spawn = guardedSpawn;
  return {
    restore() {
      active = false;
      for (const timer of pending) cancel(timer);
      pending.clear();
      if (spawnModule.spawn === guardedSpawn) spawnModule.spawn = original;
    },
  };
}

// Sólo el wrapper aislado precarga este módulo. No se instala al importarlo
// desde Vitest ni llega al comando Next: no usamos NODE_OPTIONS.
if (process.platform === "win32" && process.env.VERIFY_DIST_DIR === ".next-verify-e2e") {
  const fromHere = createRequire(import.meta.url);
  const fromTest = createRequire(fromHere.resolve("@playwright/test"));
  installWebKitExitGuard({
    platform: process.platform,
    executablePath: fromTest("playwright").webkit.executablePath(),
    spawnModule: childProcess,
  });
  syncBuiltinESMExports();
}

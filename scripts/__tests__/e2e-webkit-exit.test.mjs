// @vitest-environment node
/** SDD-0378: sólo liberar pipes propios después de una salida0 confirmada. */
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installWebKitExitGuard } from "../e2e/webkit-exit.mjs";
const executablePath = "C:\\synthetic\\webkit-9999\\Playwright.exe";
const inspectorArgs = ["--inspector-pipe", "--headless"];
const stdioShape = ["ignore", "pipe", "pipe", "pipe", "pipe"];
const restorers = [];

afterEach(() => {
  for (const restore of restorers.splice(0).reverse()) restore();
});

function stream(destroyed = false) {
  return { destroyed, destroy: vi.fn(function () { this.destroyed = true; }) };
}

function childProcess() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.stdio = [null, stream(), stream(), stream(), stream()];
  child.kill = vi.fn();
  return child;
}

function fixture(overrides = {}) {
  const child = childProcess();
  const original = vi.fn(function () { return child; });
  const spawnModule = { spawn: original };
  const timers = [];
  let now = 0;
  const schedule = vi.fn((callback, delay) => {
    const timer = { callback, delay, due: now + delay, cancelled: false, fired: false, unref: vi.fn() };
    timers.push(timer);
    return timer;
  });
  const cancel = vi.fn((timer) => { timer.cancelled = true; });
  const warn = vi.fn();
  const config = { platform: "win32", executablePath, spawnModule, schedule, cancel, warn, ...overrides };
  const installation = installWebKitExitGuard(config);
  restorers.push(() => installation.restore());
  const spawn = (command = executablePath, args = inspectorArgs, options = { stdio: [...stdioShape] }) =>
    spawnModule.spawn(command, args, options);
  const advance = (milliseconds) => {
    now += milliseconds;
    for (const timer of timers) {
      if (!timer.cancelled && !timer.fired && timer.due <= now) {
        timer.fired = true;
        timer.callback();
      }
    }
  };
  const exit = (code = 0, signal = null) => {
    child.exitCode = code;
    child.signalCode = signal;
    child.emit("exit", code, signal);
  };
  return { child, original, spawnModule, schedule, cancel, warn, timers, spawn, advance, exit, installation };
}

function expectUntouched(f) {
  for (const pipe of f.child.stdio.filter(Boolean)) expect(pipe.destroy).not.toHaveBeenCalled();
  expect(f.child.kill).not.toHaveBeenCalled();
  expect(f.warn).not.toHaveBeenCalled();
}

describe("installWebKitExitGuard · límite exacto del proceso", () => {
  it("preserva this, argumentos por identidad y ChildProcess retornado", () => {
    const f = fixture();
    const receiver = { synthetic: true };
    const args = [...inspectorArgs];
    const options = { stdio: [...stdioShape], env: { SYNTHETIC: "unchanged" } };
    const returned = f.spawnModule.spawn.call(receiver, executablePath, args, options);
    expect(returned).toBe(f.child);
    expect(f.original.mock.contexts[0]).toBe(receiver);
    expect(f.original.mock.calls[0][0]).toBe(executablePath);
    expect(f.original.mock.calls[0][1]).toBe(args);
    expect(f.original.mock.calls[0][2]).toBe(options);
    expect(options).toEqual({ stdio: stdioShape, env: { SYNTHETIC: "unchanged" } });
  });

  it("no intercepta ni reemplaza un error original de spawn", () => {
    const sentinel = new Error("Synthetic spawn error");
    const spawnModule = { spawn: vi.fn(() => { throw sentinel; }) };
    const installation = installWebKitExitGuard({ platform: "win32", executablePath, spawnModule });
    restorers.push(() => installation.restore());
    try {
      spawnModule.spawn(executablePath, inspectorArgs, { stdio: [...stdioShape] });
      throw new Error("El error original debía propagarse");
    } catch (error) {
      expect(error).toBe(sentinel);
    }
  });

  it("acepta sólo diferencias de mayúsculas del ejecutable absoluto Windows", () => {
    const f = fixture();
    f.spawn(executablePath.toUpperCase());
    f.exit();
    f.advance(15000);
    expect(f.child.stdio[3].destroy).toHaveBeenCalledOnce();
  });

  it.each(["linux", "darwin", undefined])("no actúa fuera de win32: %s", (platform) => {
    const f = fixture({ platform });
    f.spawn(); f.exit(); f.advance(30000);
    expectUntouched(f);
    expect(f.schedule).not.toHaveBeenCalled();
  });

  it.each([
    "Playwright.exe", ".\\Playwright.exe", "webkit-9999\\Playwright.exe",
    "C:\\synthetic\\other\\Playwright.exe", `${executablePath}.bak`, `"${executablePath}"`,
  ])("no acepta otro comando o un basename: %s", (command) => {
    const f = fixture();
    f.spawn(command); f.exit(); f.advance(30000);
    expectUntouched(f);
    expect(f.schedule).not.toHaveBeenCalled();
  });

  it.each([[], ["--headless"], ["--inspector-pipe=1"], "--inspector-pipe", null].map((value) => [value]))("exige args con token inspector-pipe exacto: %j", (args) => {
    const f = fixture();
    f.spawn(executablePath, args); f.exit(); f.advance(30000);
    expectUntouched(f);
    expect(f.schedule).not.toHaveBeenCalled();
  });

  it.each([
    "pipe", ["pipe", "pipe", "pipe", "pipe", "pipe"], ["ignore", "pipe", "pipe"],
    ["ignore", "pipe", "pipe", "pipe", "pipe", "pipe"], ["ignore", "pipe", "pipe", "ipc", "pipe"],
    ["ignore", "pipe", "pipe", 3, "pipe"], null,
  ].map((value) => [value]))("exige stdio exacto, sin otros destinos: %j", (stdio) => {
    const f = fixture();
    f.spawn(executablePath, inspectorArgs, { stdio }); f.exit(); f.advance(30000);
    expectUntouched(f);
    expect(f.schedule).not.toHaveBeenCalled();
  });

  it.each([true, "cmd.exe", "false"])("rechaza shell activado o ambiguo: %s", (shell) => {
    const f = fixture();
    f.spawn(executablePath, inspectorArgs, { stdio: [...stdioShape], shell });
    f.exit(); f.advance(30000);
    expectUntouched(f);
    expect(f.schedule).not.toHaveBeenCalled();
  });

  it("conserva shell:false como llamada admisible", () => {
    const f = fixture();
    f.spawn(executablePath, inspectorArgs, { stdio: [...stdioShape], shell: false });
    f.exit(); f.advance(15000);
    expect(f.child.stdio[4].destroy).toHaveBeenCalledOnce();
  });
});

describe("installWebKitExitGuard · salida confirmada y pipes propios", () => {
  it("un proceso vivo no programa timer ni destruye pipes", () => {
    const f = fixture(); f.spawn(); f.advance(60000);
    expect(f.schedule).not.toHaveBeenCalled();
    expectUntouched(f);
    expect(f.child.exitCode).toBeNull();
    expect(f.child.signalCode).toBeNull();
  });

  it("tras exit0 espera15000ms, usa unref y sólo entonces destruye sus cuatro streams", () => {
    const f = fixture();
    const observedClose = vi.fn();
    f.child.on("close", observedClose);
    f.spawn(); f.exit();
    expect(f.schedule).toHaveBeenCalledTimes(1);
    expect(f.schedule.mock.calls[0][1]).toBe(15000);
    expect(f.timers[0].unref).toHaveBeenCalledOnce();
    f.advance(14999); expectUntouched(f);
    f.advance(1);
    for (const pipe of f.child.stdio.filter(Boolean)) expect(pipe.destroy).toHaveBeenCalledOnce();
    expect(f.warn).toHaveBeenCalledOnce();
    expect(f.child.kill).not.toHaveBeenCalled();
    expect(observedClose).not.toHaveBeenCalled();
    expect(f.child.exitCode).toBe(0);
    expect(f.child.signalCode).toBeNull();
  });

  it("close antes del plazo cancela el timer y no produce avisos ni destrucción", () => {
    const f = fixture(); f.spawn(); f.exit();
    f.advance(1000); f.child.emit("close", 0, null); f.advance(30000);
    expect(f.cancel).toHaveBeenCalledWith(f.timers[0]);
    expectUntouched(f);
  });

  it("close ya observado protege incluso frente a un callback cancelado que llegara tarde", () => {
    const f = fixture(); f.spawn(); f.exit();
    f.child.emit("close", 0, null);
    f.timers[0].callback();
    expectUntouched(f);
  });

  it.each([[1, null], [537300240, null], [null, "SIGTERM"], [0, "SIGTERM"], [undefined, null]])("no actúa tras exit %s y señal %s", (code, signal) => {
    const f = fixture(); f.spawn();
    f.child.exitCode = code; f.child.signalCode = signal;
    f.child.emit("exit", code, signal); f.advance(30000);
    expect(f.schedule).not.toHaveBeenCalled();
    expectUntouched(f);
  });

  it.each([[null, null], [1, null], [0, "SIGTERM"], [0, undefined]])("revalida estado del ChildProcess al vencer: %s / %s", (code, signal) => {
    const f = fixture(); f.spawn(); f.exit();
    f.child.exitCode = code; f.child.signalCode = signal; f.advance(15000);
    expectUntouched(f);
  });

  it("omite streams ya destruidos sin tocar streams externos", () => {
    const f = fixture();
    const foreign = stream();
    f.child.foreignStream = foreign;
    f.child.stdio[2].destroyed = true;
    f.spawn(); f.exit(); f.advance(15000);
    expect(f.child.stdio[1].destroy).toHaveBeenCalledOnce();
    expect(f.child.stdio[2].destroy).not.toHaveBeenCalled();
    expect(f.child.stdio[3].destroy).toHaveBeenCalledOnce();
    expect(f.child.stdio[4].destroy).toHaveBeenCalledOnce();
    expect(foreign.destroy).not.toHaveBeenCalled();
  });

  it("el cierre de un WebKit no destruye streams de otro ChildProcess todavía vivo", () => {
    const f = fixture();
    f.spawn();
    const otherChild = childProcess();
    f.original.mockReturnValueOnce(otherChild);
    expect(f.spawn()).toBe(otherChild);
    f.exit(); f.advance(15000);
    for (const pipe of otherChild.stdio.filter(Boolean)) expect(pipe.destroy).not.toHaveBeenCalled();
    expect(otherChild.kill).not.toHaveBeenCalled();
    expect(otherChild.exitCode).toBeNull();
    expect(f.child.stdio[3].destroy).toHaveBeenCalledOnce();
  });

  it("no avisa cuando todos los streams ya estaban destruidos", () => {
    const f = fixture();
    f.spawn(); f.exit();
    for (const pipe of f.child.stdio.filter(Boolean)) pipe.destroyed = true;
    f.advance(15000);
    expectUntouched(f);
  });

  it("el aviso no contiene ejecutable, argumentos, PID ni valores del entorno", () => {
    const f = fixture();
    f.child.pid = 424242;
    f.spawn(executablePath, [...inspectorArgs, "SYNTHETIC_PRIVATE_ARGUMENT"], {
      stdio: [...stdioShape], env: { PRIVATE_SENTINEL: "SYNTHETIC_PRIVATE_ENV" },
    });
    f.exit(); f.advance(15000);
    expect(f.warn).toHaveBeenCalledOnce();
    const warning = f.warn.mock.calls.flat().map(String).join(" ");
    for (const privateValue of [executablePath, "SYNTHETIC_PRIVATE_ARGUMENT", "SYNTHETIC_PRIVATE_ENV", "424242"]) {
      expect(warning).not.toContain(privateValue);
    }
  });
});

describe("installWebKitExitGuard · restauración respetuosa", () => {
  it("restore devuelve spawn original y es idempotente", () => {
    const f = fixture();
    expect(f.spawnModule.spawn).not.toBe(f.original);
    f.installation.restore();
    expect(f.spawnModule.spawn).toBe(f.original);
    f.installation.restore();
    expect(f.spawnModule.spawn).toBe(f.original);
    f.spawn(); f.exit(); f.advance(30000);
    expectUntouched(f);
    expect(f.schedule).not.toHaveBeenCalled();
  });

  it("restore no pisa un wrapper instalado después por otro consumidor", () => {
    const f = fixture();
    const foreignWrapper = vi.fn();
    f.spawnModule.spawn = foreignWrapper;
    f.installation.restore(); f.installation.restore();
    expect(f.spawnModule.spawn).toBe(foreignWrapper);
  });

  it("restore cancela el timer propio y desactiva cualquier callback tardío", () => {
    const f = fixture(); f.spawn(); f.exit();
    f.installation.restore();
    expect(f.cancel).toHaveBeenCalledWith(f.timers[0]);
    f.timers[0].callback();
    expectUntouched(f);
  });
});

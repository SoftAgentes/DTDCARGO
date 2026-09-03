// @vitest-environment node
import { existsSync, lstatSync, mkdirSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupWorktreeFixtures, createWorktreeFixture } from "./fixtures/worktree-fixture.mjs";
import { runWorktreeCommand } from "../harness-worktree.mjs";

const probe = vi.hoisted(() => ({ active: false, calls: [], corrupt: null, corrupted: 0 }));
vi.mock("node:child_process", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    spawnSync(command, args, options) {
      const result = real.spawnSync(command, args, options);
      if (!probe.active || command !== "git") return result;
      probe.calls.push([...args]);
      if (probe.corrupt && args.includes("--git-path") && result.status === 0) {
        probe.corrupted++;
        return { ...result, stdout: probe.corrupt(result.stdout, args) };
      }
      return result;
    },
  };
});

const names = ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "BISECT_LOG"];
let f;

// Un único repositorio sintético por archivo; cada marcador se retira en finally.
// No se toca cwd real ni se amplían timeouts. El cleanup valida token/ruta física.
beforeAll(() => { f = createWorktreeFixture().candidate(); });
afterAll(() => cleanupWorktreeFixtures());
beforeEach(() => {
  probe.active = false;
  probe.calls = [];
  probe.corrupt = null;
  probe.corrupted = 0;
  for (const key of Object.keys(process.env).filter((name) => /^GIT_/i.test(name))) vi.stubEnv(key, undefined);
  for (const [key, value] of Object.entries(f.gitEnvironment)) vi.stubEnv(key, value);
  vi.spyOn(process, "cwd").mockReturnValue(f.main);
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  probe.active = false;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function finish(extra = ["--dry-run"]) {
  probe.active = true;
  try { return runWorktreeCommand(f.finishArgs(extra)); }
  finally { probe.active = false; }
}

function expectPreserved(before) {
  expect(f.evidence()).toEqual(before);
  expect(existsSync(f.target)).toBe(true);
}

describe("SDD-0376 · consultas Git agrupadas con fixture y Git reales", () => {
  it("finish conserva doble inspección y resuelve seis estados en cuatro procesos, no24", () => {
    const before = f.evidence();
    expect(() => finish()).not.toThrow();
    const operations = probe.calls.filter((args) => args.includes("--git-path"));
    expect({ allGitProcesses: probe.calls.length, operationProbes: operations.length })
      .toEqual({ allGitProcesses: 52, operationProbes: 4 });
    for (const args of operations) {
      expect(args).toContain("--path-format=absolute");
      expect(args.filter((arg) => arg === "--git-path")).toHaveLength(6);
      expect(args.filter((_arg, index) => args[index - 1] === "--git-path")).toEqual(names);
    }
    const roots = operations.map((args) => path.resolve(args[args.indexOf("-C") + 1]));
    expect(roots.filter((root) => root === f.main)).toHaveLength(2);
    expect(roots.filter((root) => root === f.target)).toHaveLength(2);
    expectPreserved(before);
  });

  it.each(["main", "target"].flatMap((root) => names.map((name) => [root, name])))(
    "%s con %s bloquea sin retirar, borrar ni alterar evidencia",
    (root, name) => {
      const state = f.git(f[root], ["rev-parse", "--path-format=absolute", "--git-path", name]).out;
      const relative = path.relative(f.root, state);
      expect(path.isAbsolute(state)).toBe(true);
      expect(relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)).toBe(false);
      expect(existsSync(state)).toBe(false);
      const isDirectory = name.startsWith("rebase-");
      if (isDirectory) mkdirSync(state);
      else f.write(f.root, relative, `${f.head}\n`);
      try {
        const before = f.evidence();
        // No dry-run: si se pierde el guard, esta fixture podría ser retirada y
        // la prueba detectaría tanto ausencia de rechazo como pérdida de datos.
        expect(() => finish(["--delete-branch"])).toThrow(/operación Git en curso/);
        expect(probe.calls.some((args) => args.includes("--git-path"))).toBe(true);
        expect(probe.calls.some((args) => args.includes("remove") || args.includes("-d"))).toBe(false);
        expectPreserved(before);
        if (isDirectory) expect(lstatSync(state).isDirectory()).toBe(true);
        else expect(readFileSync(state, "utf8")).toBe(`${f.head}\n`);
      } finally {
        // Sólo marcador exacto creado por este caso; nunca borrado recursivo.
        if (existsSync(state)) {
          if (isDirectory) rmdirSync(state);
          else unlinkSync(state);
        }
      }
    },
  );

  it.each([
    ["truncada", (rows) => rows.slice(0, -1)],
    ["relativa", (rows) => rows.map((row, index) => index === 0 ? path.basename(row) : row)],
    ["mal ordenada", (rows) => rows.length === 1
      ? [path.join(path.dirname(rows[0]), "BISECT_LOG")]
      : rows.toReversed()],
    ["fila adicional", (rows) => [...rows, rows[0]]],
  ])("respuesta %s bloquea sin mutar el candidato", (_case, corrupt) => {
    const before = f.evidence();
    probe.corrupt = (stdout) => `${corrupt(stdout.trimEnd().split(/\r?\n/)).join("\n")}\n`;
    expect(() => finish(["--delete-branch", "--dry-run"])).toThrow();
    expect(probe.corrupted).toBeGreaterThan(0);
    expect(probe.calls.some((args) => args.includes("remove") || args.includes("-d"))).toBe(false);
    expectPreserved(before);
  });

  it("respuestas completas CRLF conservan rutas y todos los gates", () => {
    const before = f.evidence();
    probe.corrupt = (stdout) => stdout.replace(/\r?\n/g, "\r\n");
    expect(() => finish()).not.toThrow();
    expect(probe.corrupted).toBe(4);
    expectPreserved(before);
  });
});

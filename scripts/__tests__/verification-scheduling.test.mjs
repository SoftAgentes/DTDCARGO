// @vitest-environment node
import { describe, expect, it } from "vitest";
import config from "../../vitest.config.mts";

const cliPath = "scripts/__tests__/harness-worktree-safety.test.mjs";
const project = (name) => config.test.projects?.find((entry) => entry.test.name === name);

describe("SDD0378: CLI real después de la tanda paralela, sin perder cobertura", () => {
  it("mantiene exactamente dos proyectos que heredan entorno, aliases y setup", () => {
    expect(config.test.projects).toHaveLength(2);
    expect(project("unit")?.extends).toBe(true);
    expect(project("worktree-cli")?.extends).toBe(true);
    expect(config.test.setupFiles).toEqual(["./vitest.setup.ts"]);
    expect(config.resolve.alias["server-only"]).toMatch(/server-only\.stub\.ts$/);
  });
  it("sólo separa el archivo CLI: no lo omite ni lo ejecuta duplicado", () => {
    expect(project("unit")?.test.exclude).toEqual([cliPath]);
    expect(project("unit")?.test.include).toBeUndefined();
    expect(project("worktree-cli")?.test.include).toEqual([cliPath]);
    expect(config.test.exclude).not.toContain(cliPath);
  });
  it("termina la tanda unitaria antes de iniciar el proyecto CLI", () => {
    expect(project("unit")?.test.sequence?.groupOrder).toBe(0);
    expect(project("worktree-cli")?.test.sequence?.groupOrder).toBe(1);
    expect(project("worktree-cli")?.test.fileParallelism).toBe(false);
  });
  it("acota trabajadores en Windows sin ampliar timeouts", () => {
    expect(config.test.maxWorkers).toBe(process.platform === "win32" ? 4 : undefined);
    expect(project("unit")?.test.maxWorkers).toBeUndefined();
    expect(config.test.testTimeout).toBe(20_000);
    expect(config.test.hookTimeout).toBe(20_000);
    expect(project("worktree-cli")?.test.testTimeout).toBeUndefined();
  });
  it("conserva paralelismo por archivo en el grupo unitario", () => {
    expect(config.test.fileParallelism).toBeUndefined();
    expect(project("unit")?.test.fileParallelism).toBeUndefined();
  });
});

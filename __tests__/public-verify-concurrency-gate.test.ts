// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runner = resolve("scripts/check-public-verify-concurrency.mjs");

describe("SDD-0375 · reserva concurrente incluida en el gate", () => {
  it("ejecuta el runner sin legacy, reintento ni absolvedor que oculte fallos", () => {
    const source = readFileSync(resolve("scripts/verify.mjs"), "utf8");
    expect(source).toMatch(
      /\{\s*name:\s*"public-verify-concurrency",\s*argv:\s*\["scripts\/check-public-verify-concurrency\.mjs"\],?\s*\}/,
    );
  });

  it("SKIP explícito termina en 3, nunca lo presenta como prueba aprobada", () => {
    const result = spawnSync(process.execPath, [runner], {
      encoding: "utf8", timeout: 10000,
      env: { ...process.env, VERIFY_SKIP_SQL: "1" },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(3);
    expect(result.stdout).toContain("[SKIP]");
    expect(result.stdout).not.toContain("[LOCAL]");
    expect(result.stdout).not.toContain("[OK]");
  });

  it("un argumento desconocido falla antes de crear PostgreSQL", () => {
    const result = spawnSync(process.execPath, [runner, "--unknown"], {
      encoding: "utf8", timeout: 10000,
      env: { ...process.env, VERIFY_SKIP_SQL: "1" },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("[LOCAL]");
  });
});

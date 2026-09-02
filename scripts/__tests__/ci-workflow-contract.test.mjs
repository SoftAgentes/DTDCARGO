import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(resolve(".github/workflows/quality.yml"), "utf8");

describe("SDD-0349 · CI de calidad sin secretos", () => {
  it("se ejecuta en main y manualmente sin eventos privilegiados", () => {
    expect(workflow).toMatch(/^on:\s*$/m);
    expect(workflow).toMatch(/^  pull_request:\s*$/m);
    expect(workflow).toMatch(/^  push:\s*$/m);
    expect(workflow).toMatch(/^  workflow_dispatch:\s*$/m);
    expect(workflow.match(/^\s*-\s*main\s*$/gm)).toHaveLength(2);
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("workflow_run");
  });

  it("opera con permisos minimos y checkout sin credenciales persistentes", () => {
    expect(workflow).toMatch(/^permissions:\s*\n  contents: read\s*$/m);
    expect(workflow).toMatch(/^\s+persist-credentials: false\s*$/m);
    expect(workflow).not.toMatch(/:\s*write\s*$/m);
    expect(workflow).not.toMatch(/\bsecrets\./);
  });

  it("fija las acciones por SHA y el runtime soportado por el repo", () => {
    const usesLines = [...workflow.matchAll(/^\s+uses:\s+([^\s#]+)\s+#\s+(\S+)\s*$/gm)];

    expect(usesLines.map((match) => match[1])).toEqual([
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/setup@703c52620218391530e48b9e8870d5c0082e1b9b",
      "denoland/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed",
    ]);
    expect(usesLines.map((match) => match[2])).toEqual(["v7.0.1", "v2.1.0", "v2.0.5"]);
    expect(workflow).toMatch(/^\s+version: 11\.19\.0\s*$/m);
    expect(workflow).toMatch(/^\s+runtime: node@24\s*$/m);
    expect(workflow).toMatch(/^\s+deno-version: v2\.x\s*$/m);
  });

  it("ejecuta todos los gates locales elegibles en orden", () => {
    const commands = [...workflow.matchAll(/^\s+run:\s+(.+)$/gm)].map((match) => match[1]);

    expect(commands).toEqual([
      "pnpm install --frozen-lockfile",
      "pnpm lint",
      "node scripts/check-rsc-boundary.mjs",
      "pnpm typecheck",
      "pnpm edge:check",
      "pnpm test",
      "pnpm docs:check",
      "pnpm sdd:check",
      "node scripts/check-feature-constants.mjs",
      "pnpm components:check",
      "pnpm governance:check",
      "node scripts/check-build.mjs",
      "git diff --exit-code",
    ]);
  });

  it("deja fuera los gates que requieren Docker, navegador o estado alojado", () => {
    expect(workflow).not.toMatch(/run-sql-tests|check-schema-rebuild|test:e2e/i);
    expect(workflow).not.toMatch(/migrations-applied|supabase|vercel|deploy/i);
    expect(workflow).toMatch(/^\s+runs-on: ubuntu-24\.04\s*$/m);
    expect(workflow).toMatch(/^\s+timeout-minutes: 20\s*$/m);
    expect(workflow).toMatch(/^\s+cancel-in-progress: true\s*$/m);
  });

  it("fija heap explicito para TypeScript y build sin omitir sus fallos", () => {
    const steps = workflow.split(/^      - name: /m).slice(1);
    const configured = steps.filter((step) => /NODE_OPTIONS:/.test(step));

    expect(workflow.split(/^    steps:/m)[0]).not.toContain("NODE_OPTIONS");
    expect(configured.map((step) => step.split(/\r?\n/)[0])).toEqual([
      "TypeScript",
      "Build de produccion sin secretos",
    ]);
    for (const step of configured) {
      expect(step).toMatch(/^        env:\r?\n          NODE_OPTIONS: "--max-old-space-size=4096"\s*$/m);
    }
    expect(workflow).not.toMatch(/continue-on-error|ignoreBuildErrors/);
  });
});

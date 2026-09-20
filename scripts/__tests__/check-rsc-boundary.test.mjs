// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "check-rsc-boundary.mjs");
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function runFixture(files) {
  const root = mkdtempSync(join(tmpdir(), "dtd-rsc-boundary-"));
  roots.push(root);
  for (const [relativePath, source] of Object.entries(files)) {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source, "utf8");
  }
  return spawnSync(process.execPath, [SCRIPT, "app", "lib"], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("check-rsc-boundary · client→node: transitivo", () => {
  it("falla y muestra la traza completa hasta node:crypto", () => {
    const result = runFixture({
      "app/Client.tsx": '"use client";\nimport { VALUE } from "@/lib/shared";\nexport function Client() { return VALUE; }\n',
      "lib/shared.ts": 'export { VALUE } from "./server-helper";\n',
      "lib/server-helper.ts": 'import { randomUUID } from "node:crypto";\nexport const VALUE = randomUUID();\n',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("node:crypto");
    expect(result.stdout).toContain("alcanzable desde un módulo \"use client\"");
    expect(result.stdout).toContain(
      "traza: app/Client.tsx -> lib/shared.ts -> lib/server-helper.ts -> node:crypto",
    );
  });

  it("no atraviesa una frontera de Server Actions de archivo", () => {
    const result = runFixture({
      "app/Client.tsx": '"use client";\nimport { action } from "./actions";\nexport function Client() { return action; }\n',
      "app/actions.ts": '"use server";\nimport { randomUUID } from "node:crypto";\nexport async function action() { return randomUUID(); }\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("sin cruces server→client de valores ni client→node: transitivos");
  });

  it("ignora imports que TypeScript borra por ser sólo tipos", () => {
    const result = runFixture({
      "app/Client.tsx": '"use client";\nimport { type ServerShape } from "@/lib/server-helper";\nexport function Client(_props: ServerShape) { return null; }\n',
      "lib/server-helper.ts": 'import { randomUUID } from "node:crypto";\nexport type ServerShape = { id: ReturnType<typeof randomUUID> };\n',
    });

    expect(result.status).toBe(0);
  });
});

describe("check-rsc-boundary · server→client existente", () => {
  it("conserva la detección de valores no componente", () => {
    const result = runFixture({
      "app/page.tsx": 'import { clientHelper } from "./Client";\nexport default function Page() { return clientHelper(); }\n',
      "app/Client.tsx": '"use client";\nexport function clientHelper() { return "x"; }\n',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("importa el valor");
    expect(result.stdout).toContain("clientHelper");
  });
});

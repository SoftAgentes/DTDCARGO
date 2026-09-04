import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "app/api/m/push/subscribe/route.ts",
  "app/api/m/push/unsubscribe/route.ts",
  "app/api/m/push/resubscribe/route.ts",
  "app/api/m/tms/ping/route.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de rutas móviles", () => {
  it.each(routeFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(routeFiles)("crea el logger desde la petición en %s", (path) => {
    expect(source(path)).toContain("createRequestLogger(req");
  });

  it.each(routeFiles)("correlaciona todas las respuestas en %s", (path) => {
    const content = source(path);
    expect(content).toContain("logger.withResponse");
    expect(content).not.toMatch(/return\s+NextResponse\.json\s*\(/);
  });

  it("el ping usa tuteo venezolano", () => {
    expect(source("app/api/m/tms/ping/route.ts")).not.toMatch(/\bpedile\b/i);
  });
});

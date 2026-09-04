import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pushFiles = [
  "app/api/portal/push/subscribe/route.ts",
  "app/api/portal/push/unsubscribe/route.ts",
  "app/portal/_components/PortalPushOptIn.tsx",
  "lib/studio/notify/vapid.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de Web Push del Portal", () => {
  it.each(pushFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each([
    "app/api/portal/push/subscribe/route.ts",
    "app/api/portal/push/unsubscribe/route.ts",
  ])("correlaciona las respuestas HTTP en %s", (path) => {
    const content = source(path);
    expect(content).toContain("createRequestLogger");
    expect(content).toContain("logger.withResponse");
    expect(content).not.toMatch(/return\s+NextResponse\.json/);
  });
});

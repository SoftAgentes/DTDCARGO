import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const queryFiles = [
  "lib/studio/notifications/pipeline-adoption-queries.ts",
  "lib/studio/notifications/notification-history-queries.ts",
  "lib/studio/notifications/notification-staff-queries.ts",
  "lib/studio/notifications/client-notification-rules-queries.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de queries de avisos del Portal", () => {
  it.each(queryFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });
});

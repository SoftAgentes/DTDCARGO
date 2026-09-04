import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schedulingFiles = [
  "lib/studio/notifications/schedule-client-notifications.ts",
  "lib/studio/notifications/schedule-fanout.ts",
  "lib/studio/notifications/mark-notification-undelivered.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de agenda de avisos del Portal", () => {
  it.each(schedulingFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it("propaga el correlador al drain inline", () => {
    expect(
      source("lib/studio/notifications/schedule-client-notifications.ts"),
    ).toMatch(/drainClientNotifications\(admin, logger\)/);
  });
});

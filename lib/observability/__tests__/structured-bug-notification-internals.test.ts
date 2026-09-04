import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const internalFiles = [
  "lib/studio/bug-email-notify.ts",
  "lib/studio/notify/bug-notif-outbox.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de notificaciones de bugs", () => {
  it.each(internalFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it("propaga el correlador del cron al outbox", () => {
    expect(source("app/api/cron/bug-notifications-drain/route.ts")).toMatch(
      /drainBugNotificationOutbox\(admin, cron\.logger\)/,
    );
  });
});

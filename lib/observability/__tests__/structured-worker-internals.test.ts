import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const internalFiles = [
  "lib/studio/notify/operario-push-outbox.ts",
  "lib/studio/notify/send-operario-push.ts",
  "lib/studio/notify/send-user-push.ts",
  "lib/studio/notifications/drain-client-notifications.ts",
  "lib/studio/workflow/workflow-drain.ts",
];

const routeContracts = [
  {
    path: "app/api/cron/push-drain/route.ts",
    pattern: /drainOperarioPushOutbox\(admin, cron\.logger\)/,
  },
  {
    path: "app/api/cron/client-notifications-drain/route.ts",
    pattern: /drainClientNotifications\(admin, cron\.logger\)/,
  },
  {
    path: "app/api/cron/workflow-drain/route.ts",
    pattern: /drainWorkflowRuns\(admin, 100, cron\.logger\)/,
  },
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de internals de workers", () => {
  it.each(internalFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(routeContracts)("propaga el correlador en $path", ({ path, pattern }) => {
    expect(source(path)).toMatch(pattern);
  });
});

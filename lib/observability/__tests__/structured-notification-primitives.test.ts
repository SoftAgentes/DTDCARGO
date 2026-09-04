import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const primitiveFiles = [
  "lib/studio/notify/write-inapp.ts",
  "lib/studio/notify/send-user-telegram.ts",
  "lib/studio/notify/notify-dispatch-events.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de primitivas de notificación", () => {
  it.each(primitiveFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it("propaga el correlador de bugs a sus tres escrituras in-app", () => {
    const matches = source("lib/studio/bug-email-notify.ts").match(
      /markDelivered: channels\.inapp,\s*\},\s*logger,\s*\)/g,
    );
    expect(matches).toHaveLength(3);
  });
});

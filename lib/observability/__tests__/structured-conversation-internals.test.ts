import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const internalFiles = [
  "lib/studio/conversation-reply-push.ts",
  "lib/studio/conversation-inbound-notify.ts",
  "lib/studio/conversaciones/monthly-digest.ts",
  "lib/studio/conversaciones/digest-extract.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de internals de conversaciones", () => {
  it.each(internalFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(internalFiles)("acepta el logger canónico en %s", (path) => {
    const content = source(path);
    expect(content).toContain("createComponentLogger");
    expect(content).toContain("type StructuredLogger");
  });

  it("propaga el correlador por push, Telegram, IA y cron", () => {
    expect(source(internalFiles[0])).toMatch(
      /sendPushToUserDevices\([\s\S]{0,260}?logger\)/,
    );
    expect(source(internalFiles[1])).toMatch(
      /dispatchTelegramAlert\([\s\S]{0,520}?logger[,\s}]/,
    );
    expect(source(internalFiles[2])).toMatch(
      /summarizeMonthThread\([\s\S]{0,240}?logger,?\s*\)/,
    );
    expect(source(internalFiles[2])).toMatch(
      /summarizeMonthThreadForClient\([\s\S]{0,240}?logger,?\s*\)/,
    );
    expect(source("app/api/cron/conversation-digests/route.ts")).toContain(
      "cron.logger",
    );
  });
});

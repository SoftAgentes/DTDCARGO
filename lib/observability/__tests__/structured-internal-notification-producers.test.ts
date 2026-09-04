import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const producerFiles = [
  "lib/studio/bitacora/notify.ts",
  "lib/studio/change-request-notify.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de productores internos de avisos", () => {
  it.each(producerFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(producerFiles)("acepta el logger canónico en %s", (path) => {
    const content = source(path);
    expect(content).toContain("createComponentLogger");
    expect(content).toContain("type StructuredLogger");
  });

  it("propaga el correlador por las primitivas de entrega", () => {
    const content = producerFiles.map(source).join("\n");
    for (const primitive of [
      "writeInAppNotification",
      "enqueueUserPush",
      "drainOperarioPushOutbox",
      "sendTelegramToUser",
      "sendPushToUserDevices",
    ]) {
      expect(content).toMatch(new RegExp(`${primitive}\\([\\s\\S]{0,360}logger`));
    }
    expect(content).toContain("logger,");
  });
});

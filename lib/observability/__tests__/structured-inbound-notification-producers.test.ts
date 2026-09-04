import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const producerFiles = [
  "lib/studio/new-client-notify.ts",
  "lib/studio/cotizacion-request-notify.ts",
  "lib/studio/contact-lead-notify.ts",
  "lib/studio/estimado-lead-notify.ts",
  "lib/studio/payment-report-notify.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de productores de avisos de entrada", () => {
  it.each(producerFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(producerFiles)("acepta el logger canónico en %s", (path) => {
    const content = source(path);
    expect(content).toContain("createComponentLogger");
    expect(content).toContain("type StructuredLogger");
  });

  it.each(producerFiles)("propaga el correlador a Telegram en %s", (path) => {
    const content = source(path);
    expect(content).toMatch(
      /dispatchTelegramAlert\([\s\S]{0,500}?\{[\s\S]{0,160}?logger[,\s}]/,
    );
  });
});

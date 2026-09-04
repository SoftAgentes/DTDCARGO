import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const target = "lib/studio/collections-actions.ts";

function source() {
  return readFileSync(resolve(process.cwd(), target), "utf8");
}

describe("observabilidad contable de Cobranzas", () => {
  it("elimina los siete console.error legacy", () => {
    expect(source()).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each([
    "internal.collections.register",
    "internal.collections.register_unidentified",
    "internal.collections.identify",
    "internal.collections.void",
  ])("crea el logger de %s", (component) => {
    expect(source()).toContain(`createComponentLogger("${component}")`);
  });

  it.each([
    "collections.receipt_posting_failed",
    "collections.receipt_posting_exception",
    "collections.unidentified_posting_failed",
    "collections.unidentified_posting_exception",
    "collections.reclassification_failed",
    "collections.reclassification_exception",
    "collections.void_entries_failed",
  ])("emite el evento estructurado %s", (event) => {
    expect(source()).toContain(`logger.error("${event}"`);
  });

  it("no agrega identificadores o importes a los eventos", () => {
    const eventBlocks = source().match(/logger\.error\([\s\S]{0,280}?\}\);/g) ?? [];
    expect(eventBlocks).toHaveLength(7);
    for (const block of eventBlocks) {
      expect(block).not.toMatch(
        /\b(?:receipt|receiptCode|invoice|tenant|amount|currency|account|entryId)\s*:/i,
      );
      expect(block).toContain("error:");
      expect(block).toContain("operation:");
      expect(block).toContain("stage:");
    }
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/api/conversaciones/email/route.ts"), "utf8");

describe("webhook inbound · minimización de logs", () => {
  it("no copia la dirección del remitente en console.warn", () => {
    const warnBlocks = source.match(/console\.warn\([\s\S]*?\);/g) ?? [];
    expect(warnBlocks.length).toBeGreaterThanOrEqual(2);
    for (const block of warnBlocks) expect(block).not.toContain("fromEmail");
  });

  it("conserva correlación operativa sin PII", () => {
    expect(source).toContain("unmatched email_id=${emailId}");
    expect(source).toContain("ambiguous email_id=${emailId} matches=${result.matches}");
  });
});

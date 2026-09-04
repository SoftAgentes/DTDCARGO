import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const target = "lib/studio/mail/mail-rule-engine.ts";

function source() {
  return readFileSync(resolve(process.cwd(), target), "utf8");
}

describe("observabilidad del motor de reglas de correo", () => {
  it("elimina los seis logs libres", () => {
    expect(source()).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it("crea un logger canónico por invocación", () => {
    expect(source()).toContain(
      'createComponentLogger("internal.mail-rule-engine")',
    );
  });

  it.each([
    "mail_rules.read_failed",
    "mail_rules.template_unavailable",
    "mail_rules.recipients_unresolved",
    "mail_rules.send_failed",
    "mail_rules.metrics_update_failed",
    "mail_rules.execution_failed",
  ])("emite el evento estructurado %s", (event) => {
    expect(source()).toContain(`("${event}"`);
  });

  it("no agrega IDs ni datos de destinatarios a los eventos", () => {
    const eventBlocks =
      source().match(/logger\.(?:error|warn)\([\s\S]{0,300}?\}\);/g) ?? [];
    expect(eventBlocks).toHaveLength(6);
    for (const block of eventBlocks) {
      expect(block).not.toMatch(
        /\b(?:tenant|rule|ruleId|recipient|to|email|vars|sourceRef|payload)\s*:/i,
      );
      expect(block).toContain("operation:");
      expect(block).toContain("stage:");
    }
  });
});

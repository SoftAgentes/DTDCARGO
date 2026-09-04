import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actionFile = "app/studio/(app)/usuarios/actions.ts";

function source() {
  return readFileSync(resolve(process.cwd(), actionFile), "utf8");
}

describe("observabilidad de acciones de Usuarios", () => {
  it("elimina los ocho console.error legacy", () => {
    expect(source()).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each([
    "action.studio.users.invite",
    "action.studio.users.access_link",
    "action.studio.users.change_email",
  ])("crea el logger de %s", (component) => {
    expect(source()).toContain(`createComponentLogger("${component}")`);
  });

  it.each([
    "users.member_guard_skipped",
    "users.invitation_email_failed",
    "users.invitation_email_exception",
    "users.access_token_insert_failed",
    "users.access_link_email_failed",
    "users.access_link_email_exception",
    "users.access_token_revoke_failed",
    "users.invitation_revoke_failed",
  ])("emite el evento estructurado %s", (event) => {
    expect(source()).toContain(`logger.error("${event}"`);
  });

  it("no agrega identificadores o datos de personas a los eventos", () => {
    const eventBlocks = source().match(/logger\.error\([\s\S]{0,240}?\}\);/g) ?? [];
    expect(eventBlocks).toHaveLength(8);
    for (const block of eventBlocks) {
      expect(block).not.toMatch(/\b(?:email|token|userId|targetUserId|link|payload)\s*:/i);
      expect(block).toContain("error:");
      expect(block).toContain("operation:");
      expect(block).toContain("stage:");
    }
  });
});

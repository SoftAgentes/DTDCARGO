import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("anularFiniquitoAction · frontera SDD-0226", () => {
  const source = readFileSync(
    resolve(process.cwd(), "app/studio/(app)/nomina/actions.ts"),
    "utf8",
  );
  const start = source.indexOf("export async function anularFiniquitoAction");
  const end = source.indexOf("export async function listSettlementLinesAction", start);
  const action = source.slice(start, end);

  it("valida motivo y usa capability admin-only", () => {
    expect(action).toContain("validateAuditReason(reasonRaw)");
    expect(action).toContain('capabilityDenial(supabase, "void_payroll_settlement")');
    expect(action).not.toContain("moduleEditDenial");
  });

  it("delega una sola mutación al RPC gobernado", () => {
    expect(action).toContain('supabase.rpc("void_payroll_settlement_governed"');
    expect(action).toContain("p_request_ref: requestRef");
    expect(action).not.toContain("voidSettlementJournalEntry");
    expect(action).not.toContain('.from("nomina_settlements")');
  });

  it("traduce errores y no expone el mensaje SQL", () => {
    expect(action).toContain('error.code === "42501"');
    expect(action).toContain('error.code === "40001"');
    expect(action).not.toContain("error.message");
    expect(action).toContain("Referencia: ${requestRef}");
  });
});

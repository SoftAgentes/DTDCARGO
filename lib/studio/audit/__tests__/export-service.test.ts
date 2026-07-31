import { describe, expect, it } from "vitest";
import { auditExportManifest, neutralizeCsvCell, serializeAuditExport } from "../export-service";

describe("audit export E3", () => {
  it.each(["=1+1", "+cmd", "-2", "@SUM(A1)"])("neutraliza fórmula %s", (value) => {
    expect(neutralizeCsvCell(value)).toBe(`"'${value}"`);
  });

  it("solo serializa campos allowlisted seleccionados", () => {
    const body = serializeAuditExport("json", ["id", "event_type"], [{
      id: "1", entity_type: "invoice", entity_id: "2", actor_type: "user",
      event_type: "created", occurred_at: "2026-07-31T00:00:00Z",
      correlation_id: null, source: "rpc", result: "succeeded",
      sensitivity: "internal", schema_version: 1, timezone: "UTC",
    }]);
    expect(JSON.parse(body)).toEqual([{ id: "1", event_type: "created" }]);
    expect(body).not.toContain("entity_type");
  });

  it("sella hash y conteo reproducibles", () => {
    const a = auditExportManifest("r1", "json", ["id"], "[]", 0);
    const b = auditExportManifest("r1", "json", ["id"], "[]", 0);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(a.row_count).toBe(0);
  });
});


// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  mapChangeRequestRow,
  buildChangeRequestDiff,
} from "../change-request-types";

function row(over: Record<string, unknown> = {}) {
  return {
    id: "r1",
    tenant_id: "t1",
    client_id: "c1",
    proposed_name: null,
    proposed_rif: null,
    proposed_phone: null,
    prev_name: null,
    prev_rif: null,
    prev_phone: null,
    status: "approved",
    submitted_at: "2026-07-06T00:00:00Z",
    reviewed_at: "2026-07-06T01:00:00Z",
    reviewed_by: "u1",
    review_note: null,
    ...over,
  } as Parameters<typeof mapChangeRequestRow>[0];
}

describe("mapChangeRequestRow · source", () => {
  it("source ausente → 'client' (default defensivo, pre-migración)", () => {
    expect(mapChangeRequestRow(row()).source).toBe("client");
  });
  it("source='admin' → 'admin'", () => {
    expect(mapChangeRequestRow(row({ source: "admin" })).source).toBe("admin");
  });
  it("source basura → 'client'", () => {
    expect(mapChangeRequestRow(row({ source: "x" })).source).toBe("client");
  });
  it("status inválido → 'pending'", () => {
    expect(mapChangeRequestRow(row({ status: "raro" })).status).toBe("pending");
  });
});

describe("buildChangeRequestDiff", () => {
  it("lista SOLO los campos con proposed no-nulo", () => {
    const req = mapChangeRequestRow(
      row({ proposed_rif: "V-123", prev_rif: "V-999" }),
    );
    const diff = buildChangeRequestDiff(req, false);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ field: "doc", from: "V-999", to: "V-123" });
  });
  it("empresa → label 'RIF'; persona → 'Cédula / RIF'", () => {
    const req = mapChangeRequestRow(row({ proposed_rif: "J-1" }));
    expect(buildChangeRequestDiff(req, true)[0].label).toBe("RIF");
    expect(buildChangeRequestDiff(req, false)[0].label).toBe("Cédula / RIF");
  });
});

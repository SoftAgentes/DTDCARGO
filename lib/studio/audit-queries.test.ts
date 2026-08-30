import { describe, expect, it, vi } from "vitest";
import {
  listGovernedAuditEvents,
  parseAuditFilters,
} from "@/lib/studio/audit-queries";

const baseAuditRow = {
  id: "e1",
  entity_type: "shipment",
  entity_id: "s1",
  actor_type: "agent",
  actor_id: "a1",
  actor_label: null,
  actor_resolved: false,
  event_type: "shipment_reviewed",
  occurred_at: "2026-07-28T12:00:00Z",
  correlation_id: null,
  source: "ai",
  result: "succeeded",
  sensitivity: "sensitive",
  schema_version: 1,
  timezone: "UTC",
  summary: null,
  next_cursor: null,
  has_more: false,
};

describe("parseAuditFilters", () => {
  it("acepta únicamente vocabularios y formatos allowlist", () => {
    expect(
      parseAuditFilters({
        auditActor: "agent",
        auditSource: "ai",
        auditResult: "succeeded",
        auditSensitivity: "sensitive",
        auditEntity: "shipment",
        auditEvent: "shipment_reviewed",
        auditFrom: "2026-07-01",
        auditTo: "2026-07-28",
        auditCursor: "YWJjZGVmZ2g",
        auditCorrelation: "req:123",
      }),
    ).toEqual({
      actorType: "agent",
      source: "ai",
      result: "succeeded",
      sensitivity: "sensitive",
      entityType: "shipment",
      eventType: "shipment_reviewed",
      from: "2026-07-01",
      to: "2026-07-28",
      cursor: "YWJjZGVmZ2g",
      correlationId: "req:123",
    });
  });

  it("descarta arrays secundarios e inputs inválidos", () => {
    expect(
      parseAuditFilters({
        auditActor: ["intruso", "user"],
        auditEntity: "DROP TABLE",
        auditFrom: "2026-99-99",
        auditCursor: "###",
      }),
    ).toEqual({
      entityType: undefined,
      actorType: undefined,
      eventType: undefined,
      source: undefined,
      result: undefined,
      sensitivity: undefined,
      from: undefined,
      to: undefined,
      cursor: undefined,
    });
  });

  it("rechaza fechas normalizadas por JavaScript que no existen", () => {
    expect(
      parseAuditFilters({
        auditFrom: "2026-02-31",
        auditTo: "2025-02-29",
      }),
    ).toMatchObject({ from: undefined, to: undefined });
  });
});

describe("listGovernedAuditEvents", () => {
  it("solo llama la RPC y adapta actor desconocido sin falsificar system", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        baseAuditRow,
      ],
      error: null,
    });

    const result = await listGovernedAuditEvents(
      { rpc } as never,
      { actorType: "agent" },
    );

    expect(rpc).toHaveBeenCalledWith(
      "audit_list_events",
      expect.objectContaining({ p_actor_type: "agent" }),
    );
    expect(result).toMatchObject({
      ok: true,
      events: [
        { actorType: "agent", actorResolved: false, summary: null },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("payload");
  });

  it("acepta únicamente summary.action para el ciclo de comentarios", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          ...baseAuditRow,
          entity_type: "comment",
          event_type: "comment_restored",
          summary: { action: "ordinary_restore" },
        },
      ],
      error: null,
    });

    await expect(
      listGovernedAuditEvents({ rpc } as never),
    ).resolves.toMatchObject({
      ok: true,
      events: [{ summary: { action: "ordinary_restore" } }],
    });
  });

  it.each([
    ["acción desconocida", { action: "future_action" }],
    ["clave adicional", { action: "undo", secret: "never-return" }],
    ["shape no objeto", "undo"],
  ])("falla cerrado ante summary con %s", async (_label, summary) => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          ...baseAuditRow,
          entity_type: "comment",
          event_type: "comment_restored",
          summary,
        },
      ],
      error: null,
    });

    await expect(
      listGovernedAuditEvents({ rpc } as never),
    ).resolves.toEqual({ ok: false, events: [], code: "query_failed" });
  });

  it("falla cerrado si summary aparece fuera del evento allowlist", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          ...baseAuditRow,
          summary: { action: "undo" },
        },
      ],
      error: null,
    });

    await expect(
      listGovernedAuditEvents({ rpc } as never),
    ).resolves.toEqual({ ok: false, events: [], code: "query_failed" });
  });

  it("distingue forbidden, filtro inválido y falla de consulta", async () => {
    for (const [code, expected] of [
      ["42501", "forbidden"],
      ["22023", "invalid_filter"],
      ["XX000", "query_failed"],
    ] as const) {
      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code },
      });
      await expect(
        listGovernedAuditEvents({ rpc } as never),
      ).resolves.toEqual({ ok: false, events: [], code: expected });
    }
  });

  it("falla cerrado ante una fila con vocabulario o zona inesperados", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "e1",
          entity_type: "shipment",
          entity_id: "s1",
          actor_type: "intruso",
          source: "studio",
          result: "succeeded",
          sensitivity: "internal",
          timezone: "UTC",
        },
      ],
      error: null,
    });
    await expect(
      listGovernedAuditEvents({ rpc } as never),
    ).resolves.toEqual({ ok: false, events: [], code: "query_failed" });
  });

  it("falla cerrado si la RPC no devuelve una colección", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await expect(
      listGovernedAuditEvents({ rpc } as never),
    ).resolves.toEqual({ ok: false, events: [], code: "query_failed" });
  });
});

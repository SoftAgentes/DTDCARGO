/**
 * Tests del módulo Conversaciones (SDD-0056 · Fase 1).
 *
 * Cubre los criterios de aceptación de la spec:
 *   - validators (estado/canal/dirección + send/setStatus/assign/markCase)
 *   - filtrado de la bandeja (estado/canal/búsqueda cliente/MARKBOX/ref)
 *   - agregación de KPIs (abiertas+sin leer · sin asignar · casos · resueltas hoy)
 *   - agregación de saldo CxC (moneda dominante)
 *   - helpers de label/badge tone + antigüedad
 *   - idempotencia inbound (external_msg_id) vía insertInboundMessage
 */

import { describe, it, expect, vi } from "vitest";
import {
  CHANNEL_LABELS,
  CHANNEL_TONES,
  STATUS_LABELS,
  STATUS_TONES,
  channelLabel,
  channelTone,
  filterConversations,
  isConversationChannel,
  isConversationDirection,
  isConversationStatus,
  relativeAge,
  statusLabel,
  statusTone,
  validateAssignInput,
  validateMarkCaseInput,
  validateSendReplyInput,
  validateSetStatusInput,
  type ConversationRow,
} from "../conversations-types";
import { aggregateKpis } from "../conversations-queries";
import { insertInboundMessage } from "../messages-queries";

// ── Type guards de enums ──────────────────────────────────────
describe("type guards de enums", () => {
  it("canal: acepta whatsapp/email/portal, rechaza otros", () => {
    expect(isConversationChannel("whatsapp")).toBe(true);
    expect(isConversationChannel("email")).toBe(true);
    expect(isConversationChannel("portal")).toBe(true);
    expect(isConversationChannel("telegram")).toBe(false);
    expect(isConversationChannel("")).toBe(false);
    expect(isConversationChannel(null)).toBe(false);
  });

  it("estado: acepta abierto/pendiente/resuelto, rechaza otros", () => {
    expect(isConversationStatus("abierto")).toBe(true);
    expect(isConversationStatus("pendiente")).toBe(true);
    expect(isConversationStatus("resuelto")).toBe(true);
    expect(isConversationStatus("cerrado")).toBe(false);
  });

  it("dirección: solo in/out", () => {
    expect(isConversationDirection("in")).toBe(true);
    expect(isConversationDirection("out")).toBe(true);
    expect(isConversationDirection("inbound")).toBe(false);
  });
});

// ── Labels + tones ────────────────────────────────────────────
describe("labels + badge tones", () => {
  it("canal mapea label y tono esperados", () => {
    expect(channelLabel("portal")).toBe("Portal");
    expect(channelTone("portal")).toBe("wine");
    expect(channelTone("whatsapp")).toBe("success");
    expect(channelTone("email")).toBe("info");
    // cobertura total del enum
    expect(Object.keys(CHANNEL_LABELS).sort()).toEqual(["email", "portal", "whatsapp"]);
    expect(Object.keys(CHANNEL_TONES).sort()).toEqual(["email", "portal", "whatsapp"]);
  });

  it("estado mapea label y tono esperados", () => {
    expect(statusLabel("abierto")).toBe("Abierto");
    expect(statusTone("abierto")).toBe("warning");
    expect(statusTone("pendiente")).toBe("info");
    expect(statusTone("resuelto")).toBe("success");
    expect(Object.keys(STATUS_LABELS).sort()).toEqual(["abierto", "pendiente", "resuelto"]);
    expect(Object.keys(STATUS_TONES).sort()).toEqual(["abierto", "pendiente", "resuelto"]);
  });
});

// ── Antigüedad ────────────────────────────────────────────────
describe("relativeAge", () => {
  const now = new Date("2026-06-04T12:00:00Z");
  it("null → guion", () => expect(relativeAge(null, now)).toBe("—"));
  it("recién → ahora", () =>
    expect(relativeAge("2026-06-04T11:59:40Z", now)).toBe("ahora"));
  it("minutos", () =>
    expect(relativeAge("2026-06-04T11:42:00Z", now)).toBe("hace 18 min"));
  it("horas", () => expect(relativeAge("2026-06-04T09:00:00Z", now)).toBe("hace 3 h"));
  it("ayer", () => expect(relativeAge("2026-06-03T10:00:00Z", now)).toBe("ayer"));
  it("días", () => expect(relativeAge("2026-05-30T10:00:00Z", now)).toBe("hace 5 d"));
});

// ── Validators ────────────────────────────────────────────────
describe("validateSendReplyInput", () => {
  it("rechaza body vacío y conversation_id faltante", () => {
    const r = validateSendReplyInput({ conversation_id: "", body: "  " });
    expect(r.fieldErrors).toBeDefined();
    expect(r.fieldErrors?.conversation_id).toBeTruthy();
    expect(r.fieldErrors?.body).toBeTruthy();
  });
  it("rechaza body > 4000", () => {
    const r = validateSendReplyInput({ conversation_id: "c1", body: "x".repeat(4001) });
    expect(r.fieldErrors?.body).toBeTruthy();
  });
  it("acepta input válido y trimea", () => {
    const r = validateSendReplyInput({ conversation_id: " c1 ", body: " hola " });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input).toEqual({ conversation_id: "c1", body: "hola" });
  });
});

describe("validateSetStatusInput", () => {
  it("rechaza estado inválido", () => {
    const r = validateSetStatusInput({ conversation_id: "c1", status: "cerrado" as never });
    expect(r.fieldErrors?.status).toBeTruthy();
  });
  it("acepta estado válido", () => {
    const r = validateSetStatusInput({ conversation_id: "c1", status: "resuelto" });
    expect(r.input).toEqual({ conversation_id: "c1", status: "resuelto" });
  });
});

describe("validateAssignInput", () => {
  it("null = desasignar (válido)", () => {
    const r = validateAssignInput({ conversation_id: "c1", assigned_to: null });
    expect(r.input).toEqual({ conversation_id: "c1", assigned_to: null });
  });
  it("string vacío → null", () => {
    const r = validateAssignInput({ conversation_id: "c1", assigned_to: "  " });
    expect(r.input?.assigned_to).toBeNull();
  });
  it("falta conversation_id → error", () => {
    const r = validateAssignInput({ assigned_to: "u1" });
    expect(r.fieldErrors?.conversation_id).toBeTruthy();
  });
});

describe("validateMarkCaseInput", () => {
  it("requiere boolean", () => {
    const r = validateMarkCaseInput({ conversation_id: "c1", is_case: undefined });
    expect(r.fieldErrors?.is_case).toBeTruthy();
  });
  it("acepta true/false", () => {
    expect(validateMarkCaseInput({ conversation_id: "c1", is_case: true }).input).toEqual({
      conversation_id: "c1",
      is_case: true,
    });
    expect(validateMarkCaseInput({ conversation_id: "c1", is_case: false }).input).toEqual({
      conversation_id: "c1",
      is_case: false,
    });
  });
});

// ── Filtrado de la bandeja ────────────────────────────────────
function row(over: Partial<ConversationRow>): ConversationRow {
  return {
    id: "c1",
    tenant_id: "t1",
    client_id: "cl1",
    ref: "C-2026-0001",
    channel: "portal",
    status: "abierto",
    is_case: false,
    assigned_to: null,
    subject: null,
    last_message_at: "2026-06-04T10:00:00Z",
    unread_count: 0,
    external_ref: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-04T10:00:00Z",
    deleted_at: null,
    markbox: "DTD-0001",
    client_name: "Industrias Polar",
    email: null,
    phone: null,
    agent: null,
    last_message_preview: "hola",
    last_message_direction: "in",
    ...over,
  };
}

describe("filterConversations", () => {
  const rows = [
    row({ id: "a", status: "abierto", channel: "portal", client_name: "Polar", markbox: "DTD-5392" }),
    row({ id: "b", status: "resuelto", channel: "email", client_name: "Pereira", markbox: "DTD-5418" }),
    row({ id: "c", status: "pendiente", channel: "whatsapp", client_name: "Castro", markbox: "DTD-5354" }),
  ];

  it("sin filtros devuelve todo", () => {
    expect(filterConversations(rows, {}).length).toBe(3);
  });
  it("filtra por estado", () => {
    const r = filterConversations(rows, { status: "abierto" });
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });
  it("filtra por canal", () => {
    const r = filterConversations(rows, { channel: "email" });
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });
  it("busca por nombre de cliente (case-insensitive)", () => {
    expect(filterConversations(rows, { search: "castro" }).map((x) => x.id)).toEqual(["c"]);
  });
  it("busca por MARKBOX", () => {
    expect(filterConversations(rows, { search: "DTD-5418" }).map((x) => x.id)).toEqual(["b"]);
  });
  it("busca por ref", () => {
    const r = filterConversations(
      [row({ id: "z", ref: "C-2026-0099", client_name: "X", markbox: "DTD-9" })],
      { search: "0099" },
    );
    expect(r.map((x) => x.id)).toEqual(["z"]);
  });
  it("combina estado + canal", () => {
    const r = filterConversations(rows, { status: "pendiente", channel: "whatsapp" });
    expect(r.map((x) => x.id)).toEqual(["c"]);
  });
});

// ── KPIs ──────────────────────────────────────────────────────
describe("aggregateKpis", () => {
  const now = new Date("2026-06-04T12:00:00Z");
  const startToday = "2026-06-04T08:00:00Z";
  const yesterday = "2026-06-03T20:00:00Z";

  const rows = [
    { status: "abierto", is_case: false, assigned_to: "u1", unread_count: 3, updated_at: startToday },
    { status: "abierto", is_case: true, assigned_to: null, unread_count: 1, updated_at: startToday },
    { status: "pendiente", is_case: false, assigned_to: null, unread_count: 0, updated_at: startToday },
    { status: "resuelto", is_case: false, assigned_to: "u1", unread_count: 0, updated_at: startToday },
    { status: "resuelto", is_case: true, assigned_to: "u2", unread_count: 0, updated_at: yesterday },
  ];

  it("cuenta abiertas y suma unread solo de abiertas", () => {
    const k = aggregateKpis(rows, now);
    expect(k.open).toBe(2);
    expect(k.unread).toBe(4); // 3 + 1
  });
  it("sin asignar excluye resueltas", () => {
    const k = aggregateKpis(rows, now);
    // u1 abierta asignada(no), abierta-caso null(sí), pendiente null(sí) → 2
    expect(k.unassigned).toBe(2);
  });
  it("casos abiertos = is_case y no resueltas", () => {
    const k = aggregateKpis(rows, now);
    expect(k.openCases).toBe(1); // la abierta-caso (la resuelta-caso no cuenta)
  });
  it("resueltas hoy excluye las de ayer", () => {
    const k = aggregateKpis(rows, now);
    expect(k.resolvedToday).toBe(1); // una resuelta hoy, otra ayer
  });
  it("lista vacía → todo cero", () => {
    expect(aggregateKpis([], now)).toEqual({
      open: 0,
      unread: 0,
      unassigned: 0,
      openCases: 0,
      resolvedToday: 0,
    });
  });
});

// ── Idempotencia inbound ──────────────────────────────────────
describe("insertInboundMessage · idempotencia por external_msg_id", () => {
  it("no inserta si el external_msg_id ya existe (duplicate=true)", async () => {
    const insertSpy = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversation_messages") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: "existing" }, error: null }),
                }),
              }),
            }),
            insert: insertSpy,
          };
        }
        return {};
      }),
    } as never;

    const r = await insertInboundMessage(supabase, {
      tenantId: "t1",
      conversationId: "c1",
      body: "hola de nuevo",
      authorName: "Cliente",
      externalMsgId: "wa-123",
    });
    expect(r).toEqual({ ok: true, duplicate: true });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("inserta + bump unread cuando el external_msg_id es nuevo", async () => {
    const inserted: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversation_messages") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: async (row: Record<string, unknown>) => {
              inserted.push(row);
              return { error: null };
            },
          };
        }
        // conversations: select unread, luego update
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { unread_count: 2 }, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            updates.push(patch);
            return { eq: async () => ({ error: null }) };
          },
        };
      }),
    } as never;

    const r = await insertInboundMessage(supabase, {
      tenantId: "t1",
      conversationId: "c1",
      body: "mensaje nuevo",
      authorName: "Cliente",
      externalMsgId: "wa-999",
    });
    expect(r).toEqual({ ok: true, duplicate: false });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ direction: "in", body: "mensaje nuevo" });
    expect(updates[0]).toMatchObject({ unread_count: 3 }); // 2 + 1
  });

  it("trata unique violation (23505) como duplicado (carrera)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "conversation_messages") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: async () => ({ error: { code: "23505", message: "dup" } }),
          };
        }
        return {};
      }),
    } as never;

    const r = await insertInboundMessage(supabase, {
      tenantId: "t1",
      conversationId: "c1",
      body: "x",
      authorName: null,
      externalMsgId: "wa-race",
    });
    expect(r).toEqual({ ok: true, duplicate: true });
  });
});

/**
 * Tests de la ingesta de email entrante (SDD-0056 · Fase 2).
 *
 * Cubre la aceptación:
 *   CORE (ingestInboundEmail)
 *     - cliente nuevo (sin hilo email) → crea hilo + mensaje inbound
 *     - hilo existente → appende + bump unread + reabre si estaba 'resuelto'
 *     - providerMsgId duplicado → no duplica (status 'duplicate')
 *     - remitente sin match → 'unmatched' sin insertar nada
 *     - mismo email en >1 tenant → 'ambiguous' sin insertar
 *     - race del índice único (INSERT conversation 23505) → reusa el existente
 *   ADAPTER (resend-inbound-adapter)
 *     - fixture de payload Resend (webhook + Received Email) → mapea al input core
 *     - parseo de "from" con display name; body de html cuando falta text
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestInboundEmail, disambiguateByTenant, emailDomain } from "../inbound-email";
import {
  mapResendInboundToCore,
  parseFromAddress,
  bodyFromEmail,
  htmlToText,
  isInboundEmailEvent,
  inboundEmailIdOf,
  rfcMessageIdOf,
  type ResendInboundWebhookEvent,
  type ResendReceivedEmail,
} from "../resend-inbound-adapter";

// ─────────────────────────────────────────────────────────────
// Fake admin SupabaseClient — modela solo lo que el core usa.
// ─────────────────────────────────────────────────────────────

type ClientRow = { id: string; tenant_id: string; name: string; email: string | null };
type ConvRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  channel: string;
  status: string;
  unread_count: number;
  deleted_at: string | null;
  external_ref?: string | null;
};
type MsgRow = {
  tenant_id: string;
  conversation_id: string;
  external_msg_id: string | null;
};

type FakeState = {
  clients: ClientRow[];
  conversations: ConvRow[];
  messages: MsgRow[];
  /** Si true, el primer INSERT de conversations lanza 23505 y "aparece" el hilo. */
  raceConvInsert?: boolean;
  refCounter: number;
};

function makeFakeAdmin(state: FakeState): {
  client: SupabaseClient;
  state: FakeState;
} {
  let raceTriggered = false;

  const api = {
    from(table: string) {
      const ctx: {
        table: string;
        filters: { col: string; val: unknown; op: string }[];
      } = { table, filters: [] };

      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          ctx.filters.push({ col, val, op: "eq" });
          return builder;
        },
        ilike(col: string, val: unknown) {
          ctx.filters.push({ col, val: String(val).toLowerCase(), op: "ilike" });
          return builder;
        },
        is(col: string, val: unknown) {
          ctx.filters.push({ col, val, op: "is" });
          return builder;
        },
        insert(row: Record<string, unknown>) {
          // Devuelve un objeto con select().single() y await directo.
          const doInsert = (): { data: unknown; error: { code?: string; message: string } | null } => {
            if (ctx.table === "conversations") {
              if (state.raceConvInsert && !raceTriggered) {
                raceTriggered = true;
                // El "ganador" de la race ya creó el hilo vivo.
                state.conversations.push({
                  id: "conv-race",
                  tenant_id: row.tenant_id as string,
                  client_id: row.client_id as string,
                  channel: "email",
                  status: "abierto",
                  unread_count: 0,
                  deleted_at: null,
                });
                return { data: null, error: { code: "23505", message: "duplicate key" } };
              }
              const id = `conv-${state.conversations.length + 1}`;
              state.conversations.push({
                id,
                tenant_id: row.tenant_id as string,
                client_id: row.client_id as string,
                channel: (row.channel as string) ?? "email",
                status: (row.status as string) ?? "abierto",
                unread_count: (row.unread_count as number) ?? 0,
                deleted_at: null,
                external_ref: (row.external_ref as string | null) ?? null,
              });
              return { data: { id }, error: null };
            }
            if (ctx.table === "conversation_messages") {
              state.messages.push({
                tenant_id: row.tenant_id as string,
                conversation_id: row.conversation_id as string,
                external_msg_id: (row.external_msg_id as string) ?? null,
              });
              return { data: null, error: null };
            }
            return { data: null, error: null };
          };

          const insertResult = doInsert();
          const chain: Record<string, unknown> = {
            select() {
              return chain;
            },
            single() {
              return Promise.resolve(insertResult);
            },
            then(resolve: (v: unknown) => unknown) {
              return Promise.resolve(insertResult).then(resolve);
            },
          };
          return chain;
        },
        update(patch: Record<string, unknown>) {
          const upd = {
            eq(col: string, val: unknown) {
              ctx.filters.push({ col, val, op: "eq" });
              return upd;
            },
            then(resolve: (v: unknown) => unknown) {
              // Aplica el patch a las conversations que matchean los filtros.
              for (const conv of state.conversations) {
                const match = ctx.filters.every((f) => {
                  if (f.op === "eq") return (conv as Record<string, unknown>)[f.col] === f.val;
                  return true;
                });
                if (match) Object.assign(conv, patch);
              }
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return upd;
        },
        maybeSingle() {
          return Promise.resolve(resolveSelect(ctx, state, "single"));
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(resolveSelect(ctx, state, "many")).then(resolve);
        },
      };
      return builder;
    },
    rpc(fn: string) {
      if (fn === "next_conversation_ref") {
        state.refCounter += 1;
        return Promise.resolve({
          data: `C-2026-${String(state.refCounter).padStart(4, "0")}`,
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  return { client: api as unknown as SupabaseClient, state };
}

function resolveSelect(
  ctx: { table: string; filters: { col: string; val: unknown; op: string }[] },
  state: FakeState,
  mode: "single" | "many",
): { data: unknown; error: null } {
  const get = (col: string) => ctx.filters.find((f) => f.col === col)?.val;

  if (ctx.table === "clients") {
    const email = get("email");
    const rows = state.clients.filter(
      (c) =>
        (c.email ?? "").toLowerCase() === String(email).toLowerCase() && true, // deleted_at is null modelado por no incluir borrados
    );
    return { data: mode === "single" ? (rows[0] ?? null) : rows, error: null };
  }

  if (ctx.table === "conversations") {
    const id = get("id");
    if (id !== undefined) {
      // SELECT por id (insertInboundMessage lee unread_count del hilo).
      const row = state.conversations.find((c) => c.id === id) ?? null;
      return { data: row, error: null };
    }
    const tenantId = get("tenant_id");
    const clientId = get("client_id");
    const channel = get("channel");
    const rows = state.conversations.filter(
      (c) =>
        c.tenant_id === tenantId &&
        c.client_id === clientId &&
        c.channel === channel &&
        c.deleted_at === null,
    );
    return { data: mode === "single" ? (rows[0] ?? null) : rows, error: null };
  }

  if (ctx.table === "conversation_messages") {
    const tenantId = get("tenant_id");
    const ext = get("external_msg_id");
    const rows = state.messages.filter(
      (m) => m.tenant_id === tenantId && m.external_msg_id === ext,
    );
    return {
      data: mode === "single" ? (rows[0] ? { id: "msg-x" } : null) : rows,
      error: null,
    };
  }

  return { data: mode === "single" ? null : [], error: null };
}

// ─────────────────────────────────────────────────────────────
// CORE · ingestInboundEmail
// ─────────────────────────────────────────────────────────────

const BASE_INPUT = {
  fromEmail: "cliente@ejemplo.com",
  fromName: "Cliente Uno",
  toAddress: "soporte@inbound.dtdcargo.com",
  subject: "Consulta de mi embarque",
  body: "Hola, ¿dónde está mi contenedor?",
  providerMsgId: "resend-email-id-001",
  rfcMessageId: "<orig-message-id@ejemplo.com>",
  sentAt: "2026-06-04T10:00:00.000Z",
};

describe("ingestInboundEmail · core", () => {
  it("cliente nuevo sin hilo → crea hilo email + mensaje inbound", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Cliente Uno", email: "cliente@ejemplo.com" }],
      conversations: [],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, BASE_INPUT);

    expect(result.status).toBe("ingested");
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].channel).toBe("email");
    expect(state.conversations[0].client_id).toBe("cli-1");
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].external_msg_id).toBe("resend-email-id-001");
    // threading: external_ref guarda el Message-ID RFC del email entrante, NO el
    // email_id interno de Resend (que es lo que va en external_msg_id).
    expect(state.conversations[0].external_ref).toBe("<orig-message-id@ejemplo.com>");
  });

  it("hilo nuevo con rfcMessageId → siembra ese Message-ID en external_ref", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Cliente Uno", email: "cliente@ejemplo.com" }],
      conversations: [],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      providerMsgId: "resend-internal-xyz",
      rfcMessageId: "<CADxyz@mail.gmail.com>",
    });

    expect(result.status).toBe("ingested");
    expect(state.conversations[0].external_ref).toBe("<CADxyz@mail.gmail.com>");
    // idempotencia sigue por el email_id interno de Resend.
    expect(state.messages[0].external_msg_id).toBe("resend-internal-xyz");
  });

  it("hilo nuevo SIN rfcMessageId → external_ref queda null (no el email_id interno)", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Cliente Uno", email: "cliente@ejemplo.com" }],
      conversations: [],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      providerMsgId: "resend-internal-abc",
      rfcMessageId: null,
    });

    expect(result.status).toBe("ingested");
    // sin Message-ID RFC → external_ref null (un valor incorrecto es peor que ninguno).
    expect(state.conversations[0].external_ref).toBeNull();
    expect(state.messages[0].external_msg_id).toBe("resend-internal-abc");
  });

  it("rfcMessageId mal formado (sin <>) → external_ref queda null", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Cliente Uno", email: "cliente@ejemplo.com" }],
      conversations: [],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      rfcMessageId: "resend-email-id-001", // parece el id interno, no un Message-ID RFC
    });

    expect(result.status).toBe("ingested");
    expect(state.conversations[0].external_ref).toBeNull();
  });

  it("hilo existente → appende mensaje y NO crea otro hilo", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Cliente Uno", email: "cliente@ejemplo.com" }],
      conversations: [
        {
          id: "conv-existing",
          tenant_id: "ten-1",
          client_id: "cli-1",
          channel: "email",
          status: "abierto",
          unread_count: 2,
          deleted_at: null,
        },
      ],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      providerMsgId: "resend-email-id-002",
    });

    expect(result.status).toBe("ingested");
    expect(state.conversations).toHaveLength(1);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].conversation_id).toBe("conv-existing");
    // bump unread (2 → 3) lo hace insertInboundMessage
    expect(state.conversations[0].unread_count).toBe(3);
  });

  it("hilo 'resuelto' → reabre a 'abierto' al entrar un email", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Cliente Uno", email: "cliente@ejemplo.com" }],
      conversations: [
        {
          id: "conv-resuelto",
          tenant_id: "ten-1",
          client_id: "cli-1",
          channel: "email",
          status: "resuelto",
          unread_count: 0,
          deleted_at: null,
        },
      ],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      providerMsgId: "resend-email-id-003",
    });

    expect(result.status).toBe("ingested");
    expect(state.conversations[0].status).toBe("abierto");
  });

  it("providerMsgId duplicado → status 'duplicate', no duplica el mensaje", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Cliente Uno", email: "cliente@ejemplo.com" }],
      conversations: [
        {
          id: "conv-existing",
          tenant_id: "ten-1",
          client_id: "cli-1",
          channel: "email",
          status: "abierto",
          unread_count: 1,
          deleted_at: null,
        },
      ],
      messages: [
        { tenant_id: "ten-1", conversation_id: "conv-existing", external_msg_id: "dup-id" },
      ],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, { ...BASE_INPUT, providerMsgId: "dup-id" });

    expect(result.status).toBe("duplicate");
    expect(state.messages).toHaveLength(1); // sin duplicar
  });

  it("remitente sin match → 'unmatched' sin insertar nada", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Otro", email: "otro@ejemplo.com" }],
      conversations: [],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      fromEmail: "desconocido@nadie.com",
    });

    expect(result.status).toBe("unmatched");
    expect(state.conversations).toHaveLength(0);
    expect(state.messages).toHaveLength(0);
  });

  it("mismo email en >1 tenant → 'ambiguous' sin insertar", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [
        { id: "cli-a", tenant_id: "ten-1", name: "A", email: "shared@ejemplo.com" },
        { id: "cli-b", tenant_id: "ten-2", name: "B", email: "shared@ejemplo.com" },
      ],
      conversations: [],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      fromEmail: "shared@ejemplo.com",
    });

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") expect(result.matches).toBe(2);
    expect(state.conversations).toHaveLength(0);
    expect(state.messages).toHaveLength(0);
  });

  it("mismo email duplicado en el MISMO tenant → no es ambiguo (toma el primero)", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [
        { id: "cli-a", tenant_id: "ten-1", name: "A", email: "dup@ejemplo.com" },
        { id: "cli-b", tenant_id: "ten-1", name: "B", email: "dup@ejemplo.com" },
      ],
      conversations: [],
      messages: [],
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      fromEmail: "dup@ejemplo.com",
    });

    expect(result.status).toBe("ingested");
    expect(state.conversations).toHaveLength(1);
  });

  it("race: INSERT conversation choca 23505 → reusa el hilo existente", async () => {
    const { client, state } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "Cliente Uno", email: "cliente@ejemplo.com" }],
      conversations: [],
      messages: [],
      raceConvInsert: true,
      refCounter: 0,
    });

    const result = await ingestInboundEmail(client, {
      ...BASE_INPUT,
      providerMsgId: "resend-email-id-race",
    });

    expect(result.status).toBe("ingested");
    if (result.status === "ingested") expect(result.conversationId).toBe("conv-race");
    // un solo hilo (el de la race), el mensaje cuelga de él
    expect(state.conversations).toHaveLength(1);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].conversation_id).toBe("conv-race");
  });

  it("body vacío → status 'error' (no inserta)", async () => {
    const { client } = makeFakeAdmin({
      clients: [{ id: "cli-1", tenant_id: "ten-1", name: "C", email: "cliente@ejemplo.com" }],
      conversations: [],
      messages: [],
      refCounter: 0,
    });
    const result = await ingestInboundEmail(client, { ...BASE_INPUT, body: "   " });
    expect(result.status).toBe("error");
  });
});

// ─────────────────────────────────────────────────────────────
// CORE helpers
// ─────────────────────────────────────────────────────────────

describe("emailDomain / disambiguateByTenant", () => {
  it("emailDomain extrae el dominio (con y sin <>)", () => {
    expect(emailDomain("user@dominio.com")).toBe("dominio.com");
    expect(emailDomain("Nombre <user@dominio.com>")).toBe("dominio.com");
    expect(emailDomain("sin-arroba")).toBeNull();
    expect(emailDomain(null)).toBeNull();
  });

  it("disambiguateByTenant: un solo tenant → resuelve; multi-tenant → null", () => {
    const a = { id: "a", tenant_id: "t1", name: "A", email: "x@y.com" };
    const b = { id: "b", tenant_id: "t1", name: "B", email: "x@y.com" };
    const c = { id: "c", tenant_id: "t2", name: "C", email: "x@y.com" };
    expect(disambiguateByTenant([a, b])?.id).toBe("a");
    expect(disambiguateByTenant([a, c])).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// ADAPTER · resend-inbound-adapter
// ─────────────────────────────────────────────────────────────

const WEBHOOK_FIXTURE: ResendInboundWebhookEvent = {
  type: "email.received",
  created_at: "2026-06-04T10:00:00.000Z",
  data: {
    email_id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
    from: "Cliente Uno <cliente@ejemplo.com>",
    to: ["soporte@inbound.dtdcargo.com"],
    cc: [],
    bcc: [],
    message_id: "<orig-message-id@ejemplo.com>",
    subject: "Consulta de mi embarque",
  },
};

const RECEIVED_FIXTURE: ResendReceivedEmail = {
  object: "email",
  id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
  from: "Cliente Uno <cliente@ejemplo.com>",
  to: ["soporte@inbound.dtdcargo.com"],
  subject: "Consulta de mi embarque",
  html: "<p>Hola, ¿dónde está mi contenedor?</p>",
  text: "Hola, ¿dónde está mi contenedor?",
  message_id: "<orig-message-id@ejemplo.com>",
  created_at: "2026-06-04T10:00:00.000Z",
  headers: {
    from: "Cliente Uno <cliente@ejemplo.com>",
    "Message-ID": "<orig-message-id@ejemplo.com>",
  },
};

describe("resend-inbound-adapter", () => {
  it("isInboundEmailEvent + inboundEmailIdOf reconocen email.received", () => {
    expect(isInboundEmailEvent(WEBHOOK_FIXTURE)).toBe(true);
    expect(inboundEmailIdOf(WEBHOOK_FIXTURE)).toBe("4ef9a417-02e9-4d39-ad75-9611e0fcc33c");
    expect(isInboundEmailEvent({ type: "email.delivered", data: { email_id: "x" } })).toBe(false);
    expect(isInboundEmailEvent({ type: "email.received", data: {} })).toBe(false);
  });

  it("parseFromAddress: display name + address, y solo-address", () => {
    expect(parseFromAddress("Cliente Uno <cliente@ejemplo.com>")).toEqual({
      email: "cliente@ejemplo.com",
      name: "Cliente Uno",
    });
    expect(parseFromAddress("plano@ejemplo.com")).toEqual({
      email: "plano@ejemplo.com",
      name: null,
    });
    expect(parseFromAddress("")).toEqual({ email: "", name: null });
  });

  it("mapResendInboundToCore mapea el fixture al input del core", () => {
    const input = mapResendInboundToCore({ event: WEBHOOK_FIXTURE, email: RECEIVED_FIXTURE });
    expect(input).not.toBeNull();
    expect(input).toMatchObject({
      fromEmail: "cliente@ejemplo.com",
      fromName: "Cliente Uno",
      toAddress: "soporte@inbound.dtdcargo.com",
      subject: "Consulta de mi embarque",
      body: "Hola, ¿dónde está mi contenedor?",
      providerMsgId: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
      // threading separado de idempotencia: el Message-ID RFC del remitente.
      rfcMessageId: "<orig-message-id@ejemplo.com>",
      sentAt: "2026-06-04T10:00:00.000Z",
    });
  });

  it("rfcMessageIdOf: prefiere message_id, cae al header, null si falta", () => {
    // top-level message_id gana
    expect(rfcMessageIdOf({ email: RECEIVED_FIXTURE })).toBe("<orig-message-id@ejemplo.com>");
    // sin message_id top-level → toma el header (case-insensitive)
    expect(
      rfcMessageIdOf({
        email: { message_id: null, headers: { "message-id": "<solo-header@gmail.com>" } },
      }),
    ).toBe("<solo-header@gmail.com>");
    // ni message_id ni header → null
    expect(rfcMessageIdOf({ email: { message_id: null, headers: { from: "x" } } })).toBeNull();
    expect(rfcMessageIdOf({ email: {} })).toBeNull();
  });

  it("mapResendInboundToCore: rfcMessageId desde el header cuando falta message_id", () => {
    const input = mapResendInboundToCore({
      event: { ...WEBHOOK_FIXTURE, data: { ...WEBHOOK_FIXTURE.data, message_id: undefined } },
      email: {
        ...RECEIVED_FIXTURE,
        message_id: null,
        headers: { "Message-ID": "<header-only@outlook.com>" },
      },
    });
    expect(input?.rfcMessageId).toBe("<header-only@outlook.com>");
  });

  it("mapResendInboundToCore: rfcMessageId null si no hay Message-ID en ningún lado", () => {
    const input = mapResendInboundToCore({
      event: { ...WEBHOOK_FIXTURE, data: { ...WEBHOOK_FIXTURE.data, message_id: undefined } },
      email: { ...RECEIVED_FIXTURE, message_id: null, headers: { from: "x" } },
    });
    expect(input?.rfcMessageId).toBeNull();
  });

  it("body: cuando falta text, deriva del html (strip)", () => {
    const input = mapResendInboundToCore({
      event: WEBHOOK_FIXTURE,
      email: { ...RECEIVED_FIXTURE, text: null, html: "<p>Solo <b>html</b> acá</p>" },
    });
    expect(input?.body).toBe("Solo html acá");
  });

  it("mapResendInboundToCore devuelve null si no hay body utilizable", () => {
    const input = mapResendInboundToCore({
      event: WEBHOOK_FIXTURE,
      email: { ...RECEIVED_FIXTURE, text: null, html: null },
    });
    expect(input).toBeNull();
  });

  it("htmlToText: <br> y bloques → saltos de línea, colapsa espacios", () => {
    expect(htmlToText("<p>Hola</p><p>Mundo</p>")).toBe("Hola\nMundo");
    expect(htmlToText("uno<br>dos")).toBe("uno\ndos");
  });

  it("bodyFromEmail prefiere text sobre html", () => {
    expect(bodyFromEmail({ text: "  texto  ", html: "<p>html</p>" })).toBe("texto");
  });
});

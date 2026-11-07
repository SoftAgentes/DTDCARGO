// @vitest-environment node
/**
 * SDD-0606 · Lo que sale a Discord desde los avisos reales es lo mínimo.
 *
 * `dispatch-alert.test.ts` prueba que el despachador nunca reenvía el texto
 * completo. Esto prueba el otro lado: que los módulos que arman el aviso no
 * meten datos de personas ni montos en la parte de Discord. Se mide sobre el
 * pedido HTTP que sale al webhook, con los dos avisos que más datos cargan —el
 * alta de un cliente y el reporte de un pago— y con el reporte diario.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: vi.fn(async () => ({ ok: true, logId: "l", resendId: "r", queued: false })),
}));
const sendTelegramMock = vi.fn();
vi.mock("@/lib/studio/telegram/send-message", () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMock(...args),
}));

import { notifyNewClientToAdmin } from "../new-client-notify";
import { notifyPaymentReportToAdmin } from "../payment-report-notify";
import { notifyConversationInbound } from "../conversation-inbound-notify";
import { buildDiscordBrief, type CeoBriefKpis } from "@/lib/news/ceo-brief";
import { buildDiscordContent } from "../discord/minimal-alert";
import { makeFakeSupabase, type FakeDb } from "../telegram/__tests__/fake-db";
import { fakeWebhook, mensajeGuardado } from "../discord/__tests__/webhook-fixture";

const TENANT = "tenant-1";
const HOOK_REGISTRO = fakeWebhook(2001);
const HOOK_EQUIPO = fakeWebhook(2005);
const HOOK_CONV = fakeWebhook(2002);

function makeAdmin() {
  const db: FakeDb = {
    user_tenants: [{ user_id: "sam", tenant_id: TENANT, role: "admin", disabled_at: null }],
    user_profiles: [{ user_id: "sam", telegram_chat_id: "6512220774" }],
    telegram_destinations: [],
    telegram_alert_routes: [],
  };
  const client = makeFakeSupabase(db) as unknown as Record<string, unknown>;
  client.auth = {
    admin: {
      listUsers: async () => ({
        data: { users: [{ id: "sam", email: "equipo@example.com" }] },
        error: null,
      }),
    },
  };
  return client as never;
}

let pedidos: Array<{ url: string; content: string }> = [];

beforeEach(() => {
  pedidos = [];
  sendTelegramMock.mockReset();
  sendTelegramMock.mockResolvedValue({ ok: true, messageId: 1 });
  vi.stubEnv("DISCORD_TENANT_ID", TENANT);
  vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);
  vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { content: string };
      const u = new URL(String(url));
      pedidos.push({ url: `${u.origin}${u.pathname}`, content: body.content });
      return mensajeGuardado();
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("avisos reales → Discord", () => {
  it("alta de cliente: sale el Shipping Mark y el enlace, sin nombre, documento, correo, teléfono ni ciudad", async () => {
    await notifyNewClientToAdmin(makeAdmin(), TENANT, {
      markbox: "DTD-5452",
      name: "Importadora Xilófono, C.A.",
      contactName: "Carlos Pérez",
      document: "J-12345678-9",
      email: "ventas@importadorax.com",
      whatsapp: "+58 412 1668021",
      city: "Valencia",
      state: "Carabobo",
      channel: "portal",
    });

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].url).toBe(HOOK_REGISTRO);
    const { content } = pedidos[0];
    expect(content).toContain("DTD-5452");
    expect(content).toContain("/studio/clientes/DTD-5452");
    for (const dato of [
      "Xilófono",
      "Carlos",
      "Pérez",
      "12345678",
      "importadorax",
      "1668021",
      "Valencia",
      "Carabobo",
    ]) {
      expect(content).not.toContain(dato);
    }
    // Entregó Discord: el texto completo no salió por Telegram.
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("reporte de pago: sale el código de la factura, sin monto, moneda, método ni nombre", async () => {
    await notifyPaymentReportToAdmin(makeAdmin(), TENANT, {
      invoiceCode: "F-2026-0031",
      markbox: "DTD-5452",
      clientName: "Importadora Xilófono, C.A.",
      amount: 98765.43,
      currency: "USD",
      method: "zelle",
      paidAt: "2026-11-04",
      hasProof: true,
    } as unknown as Parameters<typeof notifyPaymentReportToAdmin>[2]);

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].url).toBe(HOOK_EQUIPO);
    const { content } = pedidos[0];
    expect(content).toContain("F-2026-0031");
    for (const dato of ["98765", "98.765", "98,765", "USD", "elle", "Xilófono", "2026-11-04"]) {
      expect(content).not.toContain(dato);
    }
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("reporte diario: lleva conteos y nunca el total de gastos", () => {
    const kpis: CeoBriefKpis = {
      tenant_id: TENANT,
      date_iso: "2026-11-04",
      receipts_cn_count: 12,
      receipts_cn_cbm: 33.5,
      receipts_cn_incidents: 2,
      od_creada: 1,
      od_cargando: 1,
      od_lista: 3,
      od_en_ruta: 4,
      od_entregada: 5,
      od_cancelada: 0,
      expenses_total_usd: 98765,
      expenses_count: 7,
      incidents_open: 6,
    };
    const content = buildDiscordContent(buildDiscordBrief(kpis));

    expect(content).toContain("Reporte diario de operaciones");
    expect(content).toContain("2026-11-04");
    expect(content).toContain("Gastos cargados: 7");
    expect(content).toContain("Recepciones en China: 12");
    expect(content).not.toContain("98765");
    expect(content).not.toContain("$");
    expect(content).not.toContain("USD");
  });

  it("mensaje del portal: sale la referencia del hilo y el enlace, sin el nombre del cliente ni lo que escribió", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_CONVERSACIONES", HOOK_CONV);
    const db: FakeDb = {
      user_tenants: [{ user_id: "asesor", tenant_id: TENANT, role: "commercial", disabled_at: null }],
      user_profiles: [{ user_id: "asesor", telegram_chat_id: "777", discord_user_id: null }],
      conversations: [
        {
          id: "conv-1",
          tenant_id: TENANT,
          client_id: "cli-1",
          assigned_to: "asesor",
          unread_count: 1,
          ref: "CONV-0042",
        },
      ],
      clients: [
        { id: "cli-1", name: "Importadora Xilófono, C.A.", markbox: "DTD-5452", advisor_id: "asesor" },
      ],
      user_notification_prefs: [],
      telegram_destinations: [],
      telegram_alert_routes: [],
    };
    await notifyConversationInbound(makeFakeSupabase(db), {
      conversationId: "conv-1",
      body: "Hola, soy Carlos Pérez, mi cédula es V-12345678 y mi teléfono 0412-1668021",
    });

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].url).toBe(HOOK_CONV);
    const { content } = pedidos[0];
    expect(content).toContain("Mensaje nuevo del portal");
    expect(content).toContain("CONV-0042");
    expect(content).toContain("/studio/conversaciones?c=conv-1");
    for (const dato of ["Xilófono", "Importadora", "Carlos", "Pérez", "12345678", "1668021", "Hola", "escribió"]) {
      expect(content).not.toContain(dato);
    }
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });
});

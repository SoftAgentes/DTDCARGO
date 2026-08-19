/**
 * Tests del aviso interno de cliente nuevo (SDD-0059, ruteo SDD-0271).
 *
 * Verifica que `notifyNewClientToAdmin`:
 *   - manda email a CADA admin del tenant (ahí los destinatarios sí difieren),
 *   - manda Telegram UNA vez por CHAT, no una por admin,
 *   - respeta el destino configurado para la categoría `registro`,
 *   - no manda nada si no hay admins,
 *   - es best-effort: un fallo de email no corta el Telegram ni tira.
 *
 * El caso que motivó SDD-0271 está abajo con nombre propio: dos cuentas admin
 * con el MISMO `telegram_chat_id` —la situación real de producción— tienen que
 * producir UN solo mensaje.
 *
 * `sendEmail`, `sendTelegramMessage` y el admin client se mockean — sin red ni DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.fn();
const sendTelegramMock = vi.fn();

vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));
vi.mock("@/lib/studio/telegram/send-message", () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMock(...args),
}));

import { notifyNewClientToAdmin } from "../new-client-notify";
import { makeFakeSupabase, type FakeDb } from "../telegram/__tests__/fake-db";

const TENANT = "tenant-1";

type AdminOpts = {
  admins: Array<{ user_id: string }>;
  users: Array<{ id: string; email: string }>;
  chatByUser: Record<string, string | null>;
  destinations?: FakeDb["telegram_destinations"];
  routes?: FakeDb["telegram_alert_routes"];
};

/**
 * Admin client falso: el doble de `fake-db` (que sí aplica los filtros y
 * resuelve el embed) + `auth.admin.listUsers`, que PostgREST no cubre.
 */
function makeAdmin(opts: AdminOpts) {
  const db: FakeDb = {
    user_tenants: opts.admins.map((a) => ({
      user_id: a.user_id,
      tenant_id: TENANT,
      role: "admin",
      disabled_at: null,
    })),
    user_profiles: Object.entries(opts.chatByUser).map(([user_id, chat]) => ({
      user_id,
      telegram_chat_id: chat,
    })),
    telegram_destinations: opts.destinations ?? [],
    telegram_alert_routes: opts.routes ?? [],
  };

  const client = makeFakeSupabase(db) as unknown as Record<string, unknown>;
  client.auth = {
    admin: {
      listUsers: async () => ({ data: { users: opts.users }, error: null }),
    },
  };
  return client;
}

const payload = {
  markbox: "DTD-5452",
  name: "Importadora X, C.A.",
  contactName: "Carlos Pérez",
  document: "J-12345678-9",
  email: "ventas@importadorax.com",
  whatsapp: "+58 412 1668021",
  city: "Valencia",
  state: "Carabobo",
  channel: "portal",
};

beforeEach(() => {
  sendEmailMock.mockReset();
  sendTelegramMock.mockReset();
  sendEmailMock.mockResolvedValue({ ok: true, logId: "log-1", resendId: "re-1", queued: false });
  sendTelegramMock.mockResolvedValue({ ok: true, messageId: 1 });
});

describe("notifyNewClientToAdmin", () => {
  it("manda email a cada admin del tenant", async () => {
    const admin = makeAdmin({
      admins: [{ user_id: "u1" }, { user_id: "u2" }],
      users: [
        { id: "u1", email: "a@dtd.com" },
        { id: "u2", email: "b@dtd.com" },
      ],
      chatByUser: { u1: null, u2: null },
    });

    await notifyNewClientToAdmin(admin as never, TENANT, payload);

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const recipients = sendEmailMock.mock.calls.map(
      (c) => (c[2] as { to: string }).to,
    );
    expect(recipients).toEqual(expect.arrayContaining(["a@dtd.com", "b@dtd.com"]));
    // El email lleva el MARKBOX en el subject.
    const firstInput = sendEmailMock.mock.calls[0][2] as { subject: string; html: string };
    expect(firstInput.subject).toContain("DTD-5452");
    expect(firstInput.html).toContain("DTD-5452");
  });

  it("manda Telegram SOLO al admin que linkeó su chat", async () => {
    const admin = makeAdmin({
      admins: [{ user_id: "u1" }, { user_id: "u2" }],
      users: [
        { id: "u1", email: "a@dtd.com" },
        { id: "u2", email: "b@dtd.com" },
      ],
      chatByUser: { u1: "123456", u2: null },
    });

    await notifyNewClientToAdmin(admin as never, TENANT, payload);

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMock.mock.calls[0][0]).toBe("123456");
    expect(sendTelegramMock.mock.calls[0][1]).toContain("DTD-5452");
  });

  // ── La regresión de SDD-0271 ──────────────────────────────────────────────
  it("dos admins con el MISMO chat reciben UN solo Telegram (y sus DOS correos)", async () => {
    const admin = makeAdmin({
      admins: [{ user_id: "sam-gmail" }, { user_id: "sam-vzla" }],
      users: [
        { id: "sam-gmail", email: "gmail@dtd.com" },
        { id: "sam-vzla", email: "vzla@dtd.com" },
      ],
      // El caso real de producción: dos cuentas, un solo Telegram.
      chatByUser: { "sam-gmail": "6512220774", "sam-vzla": "6512220774" },
    });

    await notifyNewClientToAdmin(admin as never, TENANT, payload);

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    // El correo NO se dedupe: las casillas sí son distintas de verdad.
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("con destino configurado, el aviso va a ESE chat y no a los admins", async () => {
    const admin = makeAdmin({
      admins: [{ user_id: "u1" }],
      users: [{ id: "u1", email: "a@dtd.com" }],
      chatByUser: { u1: "6512220774" },
      destinations: [
        { id: "d1", tenant_id: TENANT, chat_id: "comercial-999", active: true },
      ],
      routes: [
        { tenant_id: TENANT, category: "registro", destination_id: "d1" },
      ],
    });

    await notifyNewClientToAdmin(admin as never, TENANT, payload);

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMock.mock.calls[0][0]).toBe("comercial-999");
  });

  it("sin admins → no manda nada", async () => {
    const admin = makeAdmin({ admins: [], users: [], chatByUser: {} });
    await notifyNewClientToAdmin(admin as never, TENANT, payload);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("best-effort: un email {ok:false} no corta el Telegram ni tira", async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: "blacklist" });
    const admin = makeAdmin({
      admins: [{ user_id: "u1" }],
      users: [{ id: "u1", email: "a@dtd.com" }],
      chatByUser: { u1: "123456" },
    });

    await expect(
      notifyNewClientToAdmin(admin as never, TENANT, payload),
    ).resolves.toBeUndefined();

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
  });
});

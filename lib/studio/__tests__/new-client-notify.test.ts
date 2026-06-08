/**
 * Tests del aviso interno de cliente nuevo (SDD-0059).
 *
 * Verifica que `notifyNewClientToAdmin`:
 *   - manda email a CADA admin del tenant,
 *   - manda Telegram SOLO a los admins que linkearon su chat,
 *   - no manda nada si no hay admins,
 *   - es best-effort: un fallo de email no corta el Telegram ni tira.
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

type AdminOpts = {
  admins: Array<{ user_id: string }>;
  users: Array<{ id: string; email: string }>;
  chatByUser: Record<string, string | null>;
};

/** Fake admin client: user_tenants (thenable) + listUsers + user_profiles (maybeSingle). */
function makeAdmin(opts: AdminOpts) {
  function from(table: string) {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      is: () => chain,
      maybeSingle: async () => {
        if (table === "user_profiles") {
          const uid = filters.user_id as string;
          return { data: { telegram_chat_id: opts.chatByUser[uid] ?? null }, error: null };
        }
        return { data: null, error: null };
      },
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        const result =
          table === "user_tenants"
            ? { data: opts.admins, error: null }
            : { data: null, error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  }
  return {
    from,
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: opts.users }, error: null }),
      },
    },
  };
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

    await notifyNewClientToAdmin(admin as never, "tenant-1", payload);

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

    await notifyNewClientToAdmin(admin as never, "tenant-1", payload);

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMock.mock.calls[0][0]).toBe("123456");
    expect(sendTelegramMock.mock.calls[0][1]).toContain("DTD-5452");
  });

  it("sin admins → no manda nada", async () => {
    const admin = makeAdmin({ admins: [], users: [], chatByUser: {} });
    await notifyNewClientToAdmin(admin as never, "tenant-1", payload);
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
      notifyNewClientToAdmin(admin as never, "tenant-1", payload),
    ).resolves.toBeUndefined();

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
  });
});

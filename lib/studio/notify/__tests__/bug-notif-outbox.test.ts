/**
 * SDD-0036 Fase 5 · P3 — drainBugNotificationOutbox (email + Telegram).
 *
 * Criterios: éxito marca delivered_<canal>_at y limpia last_error; fallo
 * incrementa <canal>_attempts + guarda last_error (para el próximo tick del
 * cron); filas sin cómo reconstruir el mensaje (sin bug_id, bug borrado, sin
 * email, sin chat_id) se abandonan de una (attempts = MAX) en vez de
 * reintentar 5 veces sin sentido.
 *
 * sendEmail/sendTelegramMessage/getBugDetail/resolve* se mockean → drain
 * queda puro respecto de I/O real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn();
const sendTelegramMessage = vi.fn();
const getBugDetail = vi.fn();
const resolveUserEmail = vi.fn();
const resolveUserDisplayName = vi.fn();

vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));
vi.mock("@/lib/studio/telegram/send-message", () => ({
  sendTelegramMessage: (...a: unknown[]) => sendTelegramMessage(...a),
}));
vi.mock("@/lib/studio/bug-queries", () => ({
  getBugDetail: (...a: unknown[]) => getBugDetail(...a),
}));
vi.mock("../resolve-recipient", () => ({
  resolveUserEmail: (...a: unknown[]) => resolveUserEmail(...a),
  resolveUserDisplayName: (...a: unknown[]) => resolveUserDisplayName(...a),
}));

import {
  drainBugNotificationOutbox,
  MAX_BUG_NOTIF_ATTEMPTS,
} from "../bug-notif-outbox";

type Row = {
  id: string;
  user_id: string;
  bug_id: string | null;
  payload: Record<string, unknown>;
  email_attempts?: number;
  telegram_attempts?: number;
};

function makeAdmin(opts: {
  emailRows?: Row[];
  telegramRows?: Row[];
  telegramChatId?: string | null;
}) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let bugNotifSelectCalls = 0;

  function from(table: string) {
    const chain: Record<string, unknown> = {
      select() {
        return chain;
      },
      is() {
        return chain;
      },
      gt() {
        return chain;
      },
      lt() {
        return chain;
      },
      eq() {
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      maybeSingle() {
        if (table === "user_profiles") {
          return Promise.resolve({
            data: { telegram_chat_id: opts.telegramChatId ?? null },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      update(patch: Record<string, unknown>) {
        return {
          eq(_col: string, id: string) {
            updates.push({ id, patch });
            return Promise.resolve({ error: null });
          },
        };
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        let result: unknown;
        if (table === "bug_notifications") {
          bugNotifSelectCalls += 1;
          // drainEmailOutbox corre primero, drainTelegramOutbox segundo
          // (mismo orden que drainBugNotificationOutbox).
          result =
            bugNotifSelectCalls === 1
              ? { data: opts.emailRows ?? [], error: null }
              : { data: opts.telegramRows ?? [], error: null };
        } else {
          result = { data: null, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  }

  const admin = { from } as never;
  return { admin, updates };
}

const row = (over: Partial<Row>): Row => ({
  id: "n1",
  user_id: "u1",
  bug_id: "bug1",
  payload: { label: "Tu reporte cambió", excerpt: "Detalle", url: "/studio/mis-bugs?focus=bug1", actionLabel: "Ver mi reporte" },
  email_attempts: 1,
  telegram_attempts: 1,
  ...over,
});

const BUG = {
  id: "bug1",
  tenant_id: "t1",
  folio: "BUG-00001",
  title: "El botón no responde",
  state: "triaje",
  severity: "alta",
};

beforeEach(() => {
  sendEmail.mockReset();
  sendTelegramMessage.mockReset();
  getBugDetail.mockReset();
  resolveUserEmail.mockReset();
  resolveUserDisplayName.mockReset();
  resolveUserEmail.mockResolvedValue("user@example.com");
  resolveUserDisplayName.mockResolvedValue("Usuario Test");
  getBugDetail.mockResolvedValue(BUG);
});

describe("drain · email", () => {
  it("éxito → delivered_email_at set + email_last_error limpio", async () => {
    sendEmail.mockResolvedValue({ ok: true });
    const { admin, updates } = makeAdmin({ emailRows: [row({})] });
    const r = await drainBugNotificationOutbox(admin);
    expect(r.email).toEqual({ processed: 1, delivered: 1, failed: 0 });
    expect(updates).toEqual([
      {
        id: "n1",
        patch: expect.objectContaining({ delivered_email_at: expect.any(String), email_last_error: null }),
      },
    ]);
  });

  it("fallo transitorio → bumpea email_attempts + guarda el error", async () => {
    sendEmail.mockResolvedValue({ ok: false, error: "Resend 500" });
    const { admin, updates } = makeAdmin({ emailRows: [row({ email_attempts: 2 })] });
    const r = await drainBugNotificationOutbox(admin);
    expect(r.email).toEqual({ processed: 1, delivered: 0, failed: 1 });
    expect(updates).toEqual([
      { id: "n1", patch: { email_attempts: 3, email_last_error: "Resend 500" } },
    ]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sin bug_id → abandona de una (attempts = MAX), no llama sendEmail", async () => {
    const { admin, updates } = makeAdmin({ emailRows: [row({ bug_id: null })] });
    await drainBugNotificationOutbox(admin);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(updates[0].patch.email_attempts).toBe(MAX_BUG_NOTIF_ATTEMPTS + 1);
  });

  it("bug ya no existe → abandona de una", async () => {
    getBugDetail.mockResolvedValue(null);
    const { admin, updates } = makeAdmin({ emailRows: [row({})] });
    await drainBugNotificationOutbox(admin);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(updates[0].patch.email_attempts).toBe(MAX_BUG_NOTIF_ATTEMPTS + 1);
  });

  it("destinatario sin email → abandona de una", async () => {
    resolveUserEmail.mockResolvedValue(null);
    const { admin, updates } = makeAdmin({ emailRows: [row({})] });
    await drainBugNotificationOutbox(admin);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(updates[0].patch.email_attempts).toBe(MAX_BUG_NOTIF_ATTEMPTS + 1);
  });
});

describe("drain · telegram", () => {
  it("éxito → delivered_telegram_at set + telegram_last_error limpio", async () => {
    sendTelegramMessage.mockResolvedValue({ ok: true });
    const { admin, updates } = makeAdmin({
      telegramRows: [row({})],
      telegramChatId: "123456",
    });
    const r = await drainBugNotificationOutbox(admin);
    expect(r.telegram).toEqual({ processed: 1, delivered: 1, failed: 0 });
    expect(updates).toEqual([
      {
        id: "n1",
        patch: expect.objectContaining({ delivered_telegram_at: expect.any(String), telegram_last_error: null }),
      },
    ]);
  });

  it("fallo transitorio → bumpea telegram_attempts", async () => {
    sendTelegramMessage.mockResolvedValue({ ok: false, error: "Bot API timeout" });
    const { admin, updates } = makeAdmin({
      telegramRows: [row({ telegram_attempts: 4 })],
      telegramChatId: "123456",
    });
    const r = await drainBugNotificationOutbox(admin);
    expect(r.telegram).toEqual({ processed: 1, delivered: 0, failed: 1 });
    expect(updates).toEqual([
      { id: "n1", patch: { telegram_attempts: 5, telegram_last_error: "Bot API timeout" } },
    ]);
  });

  it("se desvinculó de Telegram entre el fallo y el reintento → abandona de una", async () => {
    const { admin, updates } = makeAdmin({
      telegramRows: [row({})],
      telegramChatId: null,
    });
    await drainBugNotificationOutbox(admin);
    expect(sendTelegramMessage).not.toHaveBeenCalled();
    expect(updates[0].patch.telegram_attempts).toBe(MAX_BUG_NOTIF_ATTEMPTS + 1);
  });
});

describe("drain · vacío", () => {
  it("sin filas pendientes → no toca sendEmail/sendTelegramMessage", async () => {
    const { admin, updates } = makeAdmin({});
    const r = await drainBugNotificationOutbox(admin);
    expect(r).toEqual({
      email: { processed: 0, delivered: 0, failed: 0 },
      telegram: { processed: 0, delivered: 0, failed: 0 },
    });
    expect(updates).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });
});

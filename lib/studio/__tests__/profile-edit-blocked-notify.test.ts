// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const spies = vi.hoisted(() => ({
  toUser: vi.fn(async () => undefined),
  toTeam: vi.fn(async () => undefined),
}));

vi.mock("@/lib/studio/notify/send-user-telegram", () => ({
  sendTelegramToUser: spies.toUser,
}));
vi.mock("@/lib/studio/telegram/alert-routing", () => ({
  dispatchTelegramAlert: spies.toTeam,
}));
vi.mock("@/lib/studio/notify/send-user-push", () => ({
  sendPushToUserDevices: vi.fn(),
}));

const { notifyBlockedProfileEditToAdmin } = await import("../change-request-notify");

function admin(chatId: string | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { telegram_chat_id: chatId }, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const base = {
  tenantId: "tenant-1",
  markbox: "DTD-5452",
  clientName: "Ana Ficticia",
  field: "document" as const,
  conflictingMarkbox: "DTD-7000",
};

beforeEach(() => vi.clearAllMocks());

describe("notifyBlockedProfileEditToAdmin · SDD-0482", () => {
  it("avisa al asesor con Telegram, con las dos fichas y sin valor intentado", async () => {
    await notifyBlockedProfileEditToAdmin(admin("chat-1"), { ...base, advisorId: "advisor-1" });
    expect(spies.toTeam).not.toHaveBeenCalled();
    expect(spies.toUser).toHaveBeenCalledTimes(1);
    const text = (spies.toUser.mock.calls[0] as unknown[])[2] as string;
    expect(text).toContain("DTD-5452");
    expect(text).toContain("DTD-7000");
    expect(text).toMatch(/un documento que ya tiene la ficha DTD-7000/);
    expect(text).toMatch(/No se guardó nada/);
  });

  it("sin asesor con Telegram cae al equipo, una vez", async () => {
    await notifyBlockedProfileEditToAdmin(admin(null), {
      ...base,
      advisorId: "advisor-1",
      field: "phone",
      conflictingMarkbox: null,
    });
    expect(spies.toUser).not.toHaveBeenCalled();
    expect(spies.toTeam).toHaveBeenCalledTimes(1);
    const text = (spies.toTeam.mock.calls[0] as unknown[])[3] as string;
    expect(text).toMatch(/un teléfono que ya tiene otra ficha/);
  });

  it("nunca tira: un fallo del envío no rompe la action", async () => {
    spies.toUser.mockRejectedValueOnce(new Error("telegram caído"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      notifyBlockedProfileEditToAdmin(admin("chat-1"), { ...base, advisorId: "advisor-1" }),
    ).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});

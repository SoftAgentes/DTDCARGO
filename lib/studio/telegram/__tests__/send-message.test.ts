// @vitest-environment node
/**
 * SDD-0606 · Telegram retirado: el Studio no manda nada a Telegram, aunque el
 * token esté en el servidor. Se mide que no salga ningún pedido de red.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { sendTelegramMessage, TELEGRAM_RETIRADO } from "../send-message";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendTelegramMessage (retirado)", () => {
  it("con el token puesto, no hace ningún pedido y devuelve que está retirado", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:token-de-prueba");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendTelegramMessage(
      "6512220774",
      "Cliente nuevo · María Pérez · +58 412 5550199",
    );

    expect(res).toEqual({ ok: false, error: TELEGRAM_RETIRADO });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

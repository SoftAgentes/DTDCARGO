// @vitest-environment node
/**
 * SDD-0499 · el secreto del webhook de Telegram viaja en HEADER, no en la URL.
 *
 * Telegram devuelve el `secret_token` de `setWebhook` en
 * `X-Telegram-Bot-Api-Secret-Token` (core.telegram.org/bots/api#setwebhook).
 * Antes esta ruta lo leía de `?secret=`, donde queda en logs de acceso, en
 * `Referer`, en el historial de cualquier proxy y en lo que devuelve
 * `getWebhookInfo`. Quien lo tuviera fabricaba updates y enlazaba cualquier chat
 * a cualquier `link_code` vivo, escribiendo con `createAdminClient()` —que salta
 * la RLS— en `user_profiles` y `telegram_destinations`.
 *
 * La prueba que importa es la tercera: un request con el secreto BUENO en el
 * query string y sin header tiene que rebotar. Si alguien reintroduce el
 * fallback "acepta los dos", ahí muere.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

const SECRETO = "secreto-de-prueba-no-es-el-real";
const HEADER = "X-Telegram-Bot-Api-Secret-Token";

/** Se instancia el admin client, o sea: la ruta llegó a la base. */
let adminInstanciado = 0;
const mensajes: string[] = [];

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    adminInstanciado++;
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    // `.update(...).eq(...)` se espera como promesa: el chain es thenable.
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ error: null });
    return { from: () => chain };
  },
}));

vi.mock("@/lib/studio/telegram/send-message", () => ({
  sendTelegramMessage: async (_chatId: string, text: string) => {
    mensajes.push(text);
    return { ok: true };
  },
}));

import { POST } from "../route";

const ANTERIOR = process.env.TELEGRAM_WEBHOOK_SECRET;
afterAll(() => {
  process.env.TELEGRAM_WEBHOOK_SECRET = ANTERIOR;
});

const UPDATE = {
  update_id: 1,
  message: {
    message_id: 1,
    text: "/start ABC123",
    chat: { id: 42, type: "private" },
    from: { id: 7, username: "alguien" },
  },
};

function pedir(opts: { header?: string; query?: string } = {}) {
  const url = `https://dtdcargo.com/api/telegram/webhook${opts.query ?? ""}`;
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.header === undefined ? {} : { [HEADER]: opts.header }),
    },
    body: JSON.stringify(UPDATE),
  });
}

describe("POST /api/telegram/webhook · autenticación por header", () => {
  beforeEach(() => {
    adminInstanciado = 0;
    mensajes.length = 0;
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRETO;
  });

  it("sin el header → 403 y no toca la base", async () => {
    const res = await POST(pedir());
    expect(res.status).toBe(403);
    expect(adminInstanciado).toBe(0);
  });

  it("header con otro valor → 403 y no toca la base", async () => {
    const res = await POST(pedir({ header: "otro-valor-cualquiera" }));
    expect(res.status).toBe(403);
    expect(adminInstanciado).toBe(0);
  });

  it("el secreto bueno en el QUERY STRING ya no sirve → 403", async () => {
    const res = await POST(pedir({ query: `?secret=${SECRETO}` }));
    expect(res.status).toBe(403);
    expect(adminInstanciado).toBe(0);
  });

  it("un prefijo del secreto no pasa (comparación exacta)", async () => {
    const res = await POST(pedir({ header: SECRETO.slice(0, -1) }));
    expect(res.status).toBe(403);
    expect(adminInstanciado).toBe(0);
  });

  it("con el header correcto procesa el update", async () => {
    const res = await POST(pedir({ header: SECRETO }));
    expect(res.status).toBe(200);
    expect(adminInstanciado).toBe(1);
  });

  it("sin TELEGRAM_WEBHOOK_SECRET definido → 503 fail-closed, ni con header", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await POST(pedir({ header: SECRETO }));
    expect(res.status).toBe(503);
    expect(adminInstanciado).toBe(0);
  });
});

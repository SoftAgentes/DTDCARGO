// @vitest-environment node
/**
 * Despachador de avisos (SDD-0606): Discord primero, Telegram de respaldo.
 *
 * Se mide el comportamiento sobre lo que SALE: los pedidos HTTP a Discord y
 * las llamadas a Telegram. El caso que da sentido a la spec es el de
 * privacidad: el texto completo de Telegram no puede aparecer en Discord.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendTelegramMock = vi.fn();
vi.mock("@/lib/studio/telegram/send-message", () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMock(...args),
}));

import { dispatchAlert, resolveDiscordUserIds } from "../dispatch-alert";
import { sendAlertToUser, sendDiscordMentionToUser } from "../user-alert";
import {
  makeFakeSupabase,
  type FakeDb,
} from "@/lib/studio/telegram/__tests__/fake-db";

const TENANT = "tenant-1";
const HOOK_REGISTRO = "https://discord.com/api/webhooks/1001/token-registro";
const HOOK_CONV = "https://discord.com/api/webhooks/1002/token-conversaciones";
const HOOK_EQUIPO = "https://discord.com/api/webhooks/1005/token-equipo";
const DISCORD_ASESOR = "111111111111111111";

/** Lo que NO puede salir a Discord: nombre, teléfono, correo y monto. */
const TEXTO_COMPLETO = [
  "Cliente nuevo · DTD-0123",
  "María Pérez · +58 412 5550199 · maria@example.com",
  "Factura por USD 1.250,00",
].join("\n");

const PAYLOAD = {
  telegramText: TEXTO_COMPLETO,
  discord: {
    titulo: "Cliente nuevo",
    codigo: "DTD-0123",
    url: "https://dtdcargo.com/studio/clientes/abc",
  },
};

function db(extra: Partial<FakeDb> = {}): FakeDb {
  return {
    user_tenants: [
      { user_id: "sam", tenant_id: TENANT, role: "admin", disabled_at: null },
      { user_id: "asesor", tenant_id: TENANT, role: "commercial", disabled_at: null },
    ],
    user_profiles: [
      { user_id: "sam", telegram_chat_id: "6512220774", discord_user_id: null },
      { user_id: "asesor", telegram_chat_id: "777", discord_user_id: DISCORD_ASESOR },
    ],
    telegram_destinations: [],
    telegram_alert_routes: [],
    ...extra,
  };
}

interface Pedido {
  url: string;
  content: string;
  users: string[];
}

let pedidos: Pedido[] = [];
/** Estado HTTP por dirección de webhook; por defecto 204. */
let estados: Record<string, number> = {};

beforeEach(() => {
  pedidos = [];
  estados = {};
  sendTelegramMock.mockReset();
  sendTelegramMock.mockResolvedValue({ ok: true, messageId: 1 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        content: string;
        allowed_mentions: { users: string[] };
      };
      pedidos.push({
        url: String(url),
        content: body.content,
        users: body.allowed_mentions.users,
      });
      return new Response(null, { status: estados[String(url)] ?? 204 });
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dispatchAlert", () => {
  it("con canal propio sale por Discord y NO por Telegram", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);
    vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);

    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "discord", sent: 1, usedFallback: false });
    expect(pedidos.map((p) => p.url)).toEqual([HOOK_REGISTRO]);
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("a Discord sólo llega lo mínimo: nada del texto completo", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);

    await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(pedidos).toHaveLength(1);
    const { content } = pedidos[0];
    expect(content).toContain("Cliente nuevo");
    expect(content).toContain("DTD-0123");
    expect(content).toContain("https://dtdcargo.com/studio/clientes/abc");
    for (const dato of ["María", "Pérez", "412", "5550199", "maria@example.com", "1.250", "USD"]) {
      expect(content).not.toContain(dato);
    }
  });

  it("una categoría sin dirección cae al canal de respaldo y lo dice", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);

    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "discord", usedFallback: true });
    expect(pedidos.map((p) => p.url)).toEqual([HOOK_EQUIPO]);
    expect(pedidos[0].content).toContain("Sin canal propio · Registro de clientes");
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("si el canal propio falla, entrega por el de respaldo", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);
    vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);
    estados[HOOK_REGISTRO] = 404;

    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "discord", usedFallback: true });
    expect(pedidos.map((p) => p.url)).toEqual([HOOK_REGISTRO, HOOK_EQUIPO]);
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("si Discord no entrega por ningún canal, el aviso sale por Telegram", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);
    vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);
    estados[HOOK_REGISTRO] = 500;
    estados[HOOK_EQUIPO] = 500;

    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "telegram", sent: 1, usedFallback: true });
    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramMock).toHaveBeenCalledWith("6512220774", TEXTO_COMPLETO);
  });

  it("sin Discord configurado se comporta como antes: Telegram, sin pedir nada a Discord", async () => {
    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "telegram", chatIds: ["6512220774"] });
    expect(pedidos).toHaveLength(0);
    expect(sendTelegramMock).toHaveBeenCalledWith("6512220774", TEXTO_COMPLETO);
  });

  it("sin Discord y sin nadie en Telegram, no sale por ningún lado y no lanza", async () => {
    const vacio = db({ user_profiles: [], user_tenants: [] });
    const res = await dispatchAlert(makeFakeSupabase(vacio), TENANT, "registro", PAYLOAD);
    expect(res).toMatchObject({ canal: "ninguno", sent: 0 });
  });

  it("en el entorno de prueba no escribe en Discord aunque haya direcciones", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);

    await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(pedidos).toHaveLength(0);
  });

  it("el destinatario por persona se menciona en el canal si enlazó Discord", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_CONVERSACIONES", HOOK_CONV);

    await dispatchAlert(makeFakeSupabase(db()), TENANT, "conversaciones", PAYLOAD, {
      alsoUserIds: ["asesor", "sam"],
      fallback: "none",
    });

    expect(pedidos).toHaveLength(1);
    // `sam` no enlazó Discord: no hay mención para él y nada lo hace sonar.
    expect(pedidos[0].users).toEqual([DISCORD_ASESOR]);
    expect(pedidos[0].content.startsWith(`<@${DISCORD_ASESOR}>`)).toBe(true);
  });

  it("sin destinatario por persona, nadie suena", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);
    await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);
    expect(pedidos[0].users).toEqual([]);
    expect(pedidos[0].content).not.toContain("<@");
  });
});

describe("resolveDiscordUserIds", () => {
  it("devuelve sólo IDs con forma válida, sin repetir", async () => {
    const fixture = db({
      user_profiles: [
        { user_id: "a", discord_user_id: DISCORD_ASESOR },
        { user_id: "b", discord_user_id: DISCORD_ASESOR },
        { user_id: "c", discord_user_id: "everyone" },
        { user_id: "d", discord_user_id: null },
      ],
    });
    expect(
      await resolveDiscordUserIds(makeFakeSupabase(fixture), ["a", "b", "c", "d"]),
    ).toEqual([DISCORD_ASESOR]);
  });

  it("si la consulta falla (columna aún sin migrar) devuelve vacío y no lanza", async () => {
    const roto = {
      from() {
        throw new Error('column "discord_user_id" does not exist');
      },
    } as never;
    expect(await resolveDiscordUserIds(roto, ["a"])).toEqual([]);
  });
});

describe("avisos por persona", () => {
  it("quien enlazó Discord recibe la mención en el canal y no el Telegram", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);

    const ok = await sendAlertToUser(makeFakeSupabase(db()), "asesor", "equipo", PAYLOAD);

    expect(ok).toBe(true);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].users).toEqual([DISCORD_ASESOR]);
    expect(pedidos[0].content).not.toContain("María");
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("quien NO enlazó Discord no genera un mensaje en el canal; sigue por Telegram", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);

    const ok = await sendAlertToUser(makeFakeSupabase(db()), "sam", "equipo", PAYLOAD);

    expect(ok).toBe(true);
    expect(pedidos).toHaveLength(0);
    expect(sendTelegramMock).toHaveBeenCalledWith("6512220774", TEXTO_COMPLETO);
  });

  it("si la mención falla en Discord, cae al Telegram de la persona", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);
    estados[HOOK_EQUIPO] = 500;

    const ok = await sendAlertToUser(makeFakeSupabase(db()), "asesor", "equipo", PAYLOAD);

    expect(ok).toBe(true);
    expect(sendTelegramMock).toHaveBeenCalledWith("777", TEXTO_COMPLETO);
  });

  it("sendDiscordMentionToUser dice `attempted: false` cuando no corresponde Discord", async () => {
    const sinDiscord = await sendDiscordMentionToUser(
      makeFakeSupabase(db()),
      "asesor",
      "equipo",
      PAYLOAD.discord,
    );
    expect(sinDiscord).toEqual({ attempted: false, ok: false });

    vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);
    const sinEnlace = await sendDiscordMentionToUser(
      makeFakeSupabase(db()),
      "sam",
      "equipo",
      PAYLOAD.discord,
    );
    expect(sinEnlace).toEqual({ attempted: false, ok: false });
    expect(pedidos).toHaveLength(0);
  });
});

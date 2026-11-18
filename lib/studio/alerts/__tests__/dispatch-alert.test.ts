// @vitest-environment node
/**
 * Despachador de avisos (SDD-0606): Discord primero, Telegram de respaldo.
 *
 * Se mide el comportamiento sobre lo que SALE: los pedidos HTTP a Discord, las
 * llamadas a Telegram y las filas de la cola. El caso que da sentido a la spec
 * es el de privacidad: el texto completo de Telegram no puede aparecer en Discord.
 *
 * Correcciones de la revisión de Codex (2026-11-05):
 *   A3 · una categoría que no puede perderse va a la cola si Discord no la
 *        guardó, en vez de caer a Telegram;
 *   A5 · un tenant que no es el dueño de los webhooks no escribe en Discord;
 *   M2 · una entrega incierta no se repite por otro canal ni por Telegram.
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
import { fakeWebhook, mensajeGuardado } from "@/lib/studio/discord/__tests__/webhook-fixture";

const TENANT = "00000000-0000-4000-8000-000000000001";
const OTRO_TENANT = "00000000-0000-4000-8000-000000000002";
const HOOK_REGISTRO = fakeWebhook(1001);
const HOOK_CONV = fakeWebhook(1002);
const HOOK_EQUIPO = fakeWebhook(1005);
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
      { user_id: "otro-admin", tenant_id: OTRO_TENANT, role: "admin", disabled_at: null },
    ],
    user_profiles: [
      { user_id: "sam", telegram_chat_id: "6512220774", discord_user_id: null },
      { user_id: "asesor", telegram_chat_id: "777", discord_user_id: DISCORD_ASESOR },
      { user_id: "otro-admin", telegram_chat_id: "888", discord_user_id: null },
    ],
    telegram_destinations: [],
    telegram_alert_routes: [],
    studio_alert_outbox: [],
    ...extra,
  };
}

interface Pedido {
  url: string;
  content: string;
  users: string[];
}

let pedidos: Pedido[] = [];
/** Respuesta por dirección de webhook: estado HTTP o un error de red. Por defecto, guardado. */
let respuestas: Record<string, number | Error> = {};

function discordConfigurado(extra: Record<string, string> = {}) {
  vi.stubEnv("DISCORD_TENANT_ID", TENANT);
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
}

beforeEach(() => {
  pedidos = [];
  respuestas = {};
  sendTelegramMock.mockReset();
  sendTelegramMock.mockResolvedValue({ ok: true, messageId: 1 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = new URL(String(url));
      const base = `${u.origin}${u.pathname}`;
      const body = JSON.parse(String(init?.body)) as {
        content: string;
        allowed_mentions: { users: string[] };
      };
      pedidos.push({ url: base, content: body.content, users: body.allowed_mentions.users });
      const r = respuestas[base];
      if (r instanceof Error) throw r;
      if (typeof r === "number") return new Response(null, { status: r });
      return mensajeGuardado();
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

const timeout = () => new DOMException("The operation timed out.", "TimeoutError");

describe("dispatchAlert", () => {
  it("con canal propio sale por Discord y NO por Telegram", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO, DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });

    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "discord", sent: 1, usedFallback: false });
    expect(pedidos.map((p) => p.url)).toEqual([HOOK_REGISTRO]);
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("a Discord sólo llega lo mínimo: nada del texto completo", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO });

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
    discordConfigurado({ DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });

    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "discord", usedFallback: true });
    expect(pedidos.map((p) => p.url)).toEqual([HOOK_EQUIPO]);
    expect(pedidos[0].content).toContain("Sin canal propio · Registro de clientes");
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("si el canal propio lo rechaza (webhook borrado), entrega por el de respaldo", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO, DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });
    respuestas[HOOK_REGISTRO] = 404;

    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "discord", usedFallback: true });
    expect(pedidos.map((p) => p.url)).toEqual([HOOK_REGISTRO, HOOK_EQUIPO]);
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("M2: una entrega incierta en el canal propio no se repite en el respaldo ni en Telegram", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO, DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });
    respuestas[HOOK_REGISTRO] = timeout();
    const fixture = db();

    const res = await dispatchAlert(makeFakeSupabase(fixture), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "discord", incierto: true, sent: 0 });
    expect(pedidos.map((p) => p.url)).toEqual([HOOK_REGISTRO]);
    expect(sendTelegramMock).not.toHaveBeenCalled();
    expect(fixture.studio_alert_outbox).toHaveLength(0);
  });

  it("M2: una entrega incierta en el respaldo tampoco se repite", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO, DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });
    respuestas[HOOK_REGISTRO] = 404;
    respuestas[HOOK_EQUIPO] = timeout();

    const res = await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "discord", incierto: true });
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("A3: una categoría que no puede perderse va a la cola si Discord no la guardó, no a Telegram", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO, DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });
    respuestas[HOOK_REGISTRO] = 503;
    respuestas[HOOK_EQUIPO] = 503;
    const fixture = db();

    const res = await dispatchAlert(makeFakeSupabase(fixture), TENANT, "registro", PAYLOAD);

    expect(res).toMatchObject({ canal: "cola" });
    expect(sendTelegramMock).not.toHaveBeenCalled();
    expect(fixture.studio_alert_outbox).toHaveLength(1);
    const fila = fixture.studio_alert_outbox[0];
    expect(fila).toMatchObject({ tenant_id: TENANT, category: "registro" });
    // En la cola queda lo mínimo, nunca el texto completo.
    expect(JSON.stringify(fila)).not.toContain("María");
    expect(fila.payload).toEqual(PAYLOAD.discord);
  });

  it("A3: si la cola todavía no existe (migración sin aplicar), cae a Telegram", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO });
    respuestas[HOOK_REGISTRO] = 503;
    const sinCola = db();
    delete (sinCola as Partial<FakeDb>).studio_alert_outbox;

    const res = await dispatchAlert(makeFakeSupabase(sinCola), TENANT, "registro", PAYLOAD);

    expect(res.canal).toBe("telegram");
    expect(sendTelegramMock).toHaveBeenCalledWith("6512220774", TEXTO_COMPLETO);
  });

  it("A3: una categoría que no es crítica no va a la cola; sigue por Telegram", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });
    respuestas[HOOK_EQUIPO] = 503;
    const fixture = db();

    const res = await dispatchAlert(makeFakeSupabase(fixture), TENANT, "equipo", PAYLOAD);

    expect(res.canal).toBe("telegram");
    expect(fixture.studio_alert_outbox).toHaveLength(0);
  });

  it("A5: un tenant que no es el dueño de los webhooks no escribe en Discord", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO, DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });

    const res = await dispatchAlert(makeFakeSupabase(db()), OTRO_TENANT, "registro", PAYLOAD);

    expect(pedidos).toHaveLength(0);
    expect(res.canal).toBe("telegram");
    expect(sendTelegramMock).toHaveBeenCalledWith("888", TEXTO_COMPLETO);
  });

  it("A5: sin DISCORD_TENANT_ID, Discord no se usa aunque haya direcciones", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);

    await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(pedidos).toHaveLength(0);
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
    discordConfigurado({ APP_ENV: "staging", DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO });

    await dispatchAlert(makeFakeSupabase(db()), TENANT, "registro", PAYLOAD);

    expect(pedidos).toHaveLength(0);
  });

  it("el destinatario por persona se menciona en el canal si enlazó Discord", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_CONVERSACIONES: HOOK_CONV });

    await dispatchAlert(makeFakeSupabase(db()), TENANT, "conversaciones", PAYLOAD, {
      alsoUserIds: ["asesor", "sam"],
      fallback: "none",
    });

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].users).toEqual([DISCORD_ASESOR]);
    expect(pedidos[0].content.startsWith(`<@${DISCORD_ASESOR}>`)).toBe(true);
  });

  it("sin destinatario por persona, nadie suena", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_REGISTRO: HOOK_REGISTRO });
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
    discordConfigurado({ DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });

    const ok = await sendAlertToUser(makeFakeSupabase(db()), TENANT, "asesor", "equipo", PAYLOAD);

    expect(ok).toBe(true);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].users).toEqual([DISCORD_ASESOR]);
    expect(pedidos[0].content).not.toContain("María");
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("quien NO enlazó Discord no genera un mensaje en el canal; sigue por Telegram", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });

    const ok = await sendAlertToUser(makeFakeSupabase(db()), TENANT, "sam", "equipo", PAYLOAD);

    expect(ok).toBe(true);
    expect(pedidos).toHaveLength(0);
    expect(sendTelegramMock).toHaveBeenCalledWith("6512220774", TEXTO_COMPLETO);
  });

  it("si Discord no guardó la mención, cae al Telegram de la persona", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });
    respuestas[HOOK_EQUIPO] = 500;

    const ok = await sendAlertToUser(makeFakeSupabase(db()), TENANT, "asesor", "equipo", PAYLOAD);

    expect(ok).toBe(true);
    expect(sendTelegramMock).toHaveBeenCalledWith("777", TEXTO_COMPLETO);
  });

  it("M2: si la mención quedó incierta, no se repite por Telegram", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });
    respuestas[HOOK_EQUIPO] = timeout();

    const ok = await sendAlertToUser(makeFakeSupabase(db()), TENANT, "asesor", "equipo", PAYLOAD);

    expect(ok).toBe(true);
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("A5: la mención no sale a Discord desde otro tenant", async () => {
    discordConfigurado({ DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });

    const res = await sendDiscordMentionToUser(
      makeFakeSupabase(db()),
      OTRO_TENANT,
      "asesor",
      "equipo",
      PAYLOAD.discord,
    );

    expect(res).toMatchObject({ attempted: false });
    expect(pedidos).toHaveLength(0);
  });

  it("sendDiscordMentionToUser dice `attempted: false` cuando no corresponde Discord", async () => {
    const sinDiscord = await sendDiscordMentionToUser(
      makeFakeSupabase(db()),
      TENANT,
      "asesor",
      "equipo",
      PAYLOAD.discord,
    );
    expect(sinDiscord).toMatchObject({ attempted: false, ok: false });

    discordConfigurado({ DISCORD_WEBHOOK_EQUIPO: HOOK_EQUIPO });
    const sinEnlace = await sendDiscordMentionToUser(
      makeFakeSupabase(db()),
      TENANT,
      "sam",
      "equipo",
      PAYLOAD.discord,
    );
    expect(sinEnlace).toMatchObject({ attempted: false, ok: false });
    expect(pedidos).toHaveLength(0);
  });
});

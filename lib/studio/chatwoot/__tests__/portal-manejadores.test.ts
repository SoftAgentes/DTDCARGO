// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1b) · la vuelta, de Chatwoot al portal (E10-D37 y E10-D38).
 *
 * La base y la API de Chatwoot son dobles. Qué se escribe en el hilo, una sola vez, con su
 * hora y su autor, lo decide la migración (su contrato está en
 * chatwoot-portal-vuelta.migration.test.ts). Acá se prueba qué hace el servidor con cada
 * mensaje: qué deja pasar, qué le manda a la RPC, cuándo avisa al cliente, cuándo deja la nota
 * privada (una sola vez) y que el reproceso relea el mensaje. El doble de la base filtra por los
 * `eq` que recibe: uno que no filtra daría verde aunque el código no mirara el tenant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  leerMensaje: vi.fn(),
  crearNotaPrivada: vi.fn(),
  buscarMensajePorSourceId: vi.fn(),
}));
const flags = vi.hoisted(() => ({ chatwoot_portal: true }));
const push = vi.hoisted(() => ({ notifyClientReplyPush: vi.fn() }));

vi.mock("../router-api", async (original) => ({ ...(await original<typeof import("../router-api")>()), ...api }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: vi.fn(async () => ({ ...flags })) }));
vi.mock("@/lib/studio/conversation-reply-push", () => push);

import type { ContextoChatwoot } from "../webhook-procesar";
import type { EventoChatwoot } from "../webhook-events";
import {
  NOTA_ADJUNTO,
  NOTA_ARCHIVADO,
  esRespuestaDelEquipo,
  interpretarMensajePortal,
  responderAlPortal,
  salientePortalDelPayload,
  type MensajePortal,
} from "../portal-manejadores";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const CLIENTE = "50000000-0000-4000-8000-0000000000cc";
const INBOX_PORTAL = 9;
const CONV = 9001;
const MSG = 7001;
const TEXTO = "Tu caja llegó a Valencia. Pasa a buscarla el lunes.";
const CREADO = "2026-11-08T14:00:00.000Z";
const ENV = {
  CHATWOOT_URL: "https://chat.ejemplo.test",
  CHATWOOT_ROUTER_TOKEN: "tok-router-sintetico",
  CHATWOOT_ACCOUNT_ID: "1",
  CHATWOOT_TENANT_ID: T1,
  CHATWOOT_INBOX_PORTAL_ID: String(INBOX_PORTAL),
};

/** La carga del webhook de Chatwoot 4.19.1 (`Message#webhook_data`) de una respuesta del agente. */
const cargaWebhook = (extra: Record<string, unknown> = {}) => ({
  event: "message_created",
  id: MSG,
  content: TEXTO,
  content_type: "text",
  message_type: "outgoing",
  private: false,
  source_id: null,
  created_at: CREADO,
  sender: { id: 7, name: "Agente Sintético", email: "agente@example.test", type: "user" },
  inbox: { id: INBOX_PORTAL, name: "Conversaciones del portal" },
  account: { id: 1 },
  conversation: { id: CONV, inbox_id: INBOX_PORTAL, status: "open", unread_count: 0, meta: { sender: { phone_number: "+584125550101" } } },
  ...extra,
});

/** Una fila de `GET /conversations/{id}/messages` (la API de cuenta): tipo numérico y hora en segundos. */
const filaApi = (extra: Record<string, unknown> = {}) => ({
  id: MSG,
  content: TEXTO,
  content_type: "text",
  message_type: 1,
  private: false,
  source_id: null,
  created_at: Date.parse(CREADO) / 1000,
  conversation_id: CONV,
  inbox_id: INBOX_PORTAL,
  sender_type: "User",
  sender_id: 7,
  sender: { id: 7, name: "Agente Sintético", type: "user" },
  attachments: [],
  ...extra,
});

const evento = (extra: Partial<EventoChatwoot> = {}): EventoChatwoot => ({
  evento: "message_created",
  clave: `message_created:${MSG}`,
  accountId: 1,
  mensajeId: MSG,
  avisar: false,
  conversacion: {
    id: CONV,
    inboxId: INBOX_PORTAL,
    estado: "open",
    noLeidos: 0,
    asignadoId: null,
    ultimaActividad: null,
    fuenteActualizada: 0,
    telefonoUltimos10: "4125550101",
  },
  ...extra,
});

/** El evento como lo arma el reproceso: sin bandeja ni teléfono, que no se guardaron. */
const eventoReproceso = () =>
  evento({ conversacion: { ...evento().conversacion, inboxId: null, telefonoUltimos10: null } });

type Resultado = "insertado" | "duplicado" | "archivado" | "sin_texto" | "ficha_borrada" | "sin_hilo" | "apagado";

/** La base: la RPC de la vuelta da `resultado`; `chatwoot_portal_hilos` filtra de verdad por cada `eq`. */
function base(opciones: { resultado?: Resultado; falla?: string; hilos?: { tenant_id: string; chatwoot_conversation_id: number }[] } = {}) {
  type Rpc = (nombre: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code: string } | null }>;
  const rpc = vi.fn<Rpc>(async (nombre) => {
    if (nombre === opciones.falla) return { data: null, error: { code: "XX000" } };
    if (nombre === "chatwoot_portal_respuesta") {
      const resultado = opciones.resultado ?? "insertado";
      return { data: [{ resultado, cliente_id: resultado === "insertado" ? CLIENTE : null }], error: null };
    }
    throw new Error(`RPC inesperada ${nombre}`);
  });
  const hilos = opciones.hilos ?? [{ tenant_id: T1, chatwoot_conversation_id: CONV }];
  const from = vi.fn((tabla: string) => {
    if (tabla !== "chatwoot_portal_hilos") throw new Error(`tabla inesperada ${tabla}`);
    let filas: Record<string, unknown>[] = hilos.map((h) => ({ ...h, conversation_id: "60000000-0000-4000-8000-000000000001" }));
    const cadena = {
      select: () => cadena,
      eq: (columna: string, valor: unknown) => {
        filas = filas.filter((f) => f[columna] === valor);
        return cadena;
      },
      limit: (n: number) => {
        filas = filas.slice(0, n);
        return cadena;
      },
      then: (r: (v: unknown) => void) =>
        r(opciones.falla === "from:chatwoot_portal_hilos" ? { data: null, error: { code: "XX000" } } : { data: filas, error: null }),
    };
    return cadena;
  });
  return { rpc, from };
}

function contexto(admin: ReturnType<typeof base>, salientePortal?: MensajePortal | null): ContextoChatwoot {
  return {
    admin: admin as unknown as ContextoChatwoot["admin"],
    tenantId: T1,
    ...(salientePortal !== undefined ? { salientePortal } : {}),
  };
}

const enVivo = (carga: Record<string, unknown> = cargaWebhook()) => salientePortalDelPayload(carga, INBOX_PORTAL);
const argsRespuesta = (admin: ReturnType<typeof base>) =>
  admin.rpc.mock.calls.find(([n]) => n === "chatwoot_portal_respuesta")?.[1] as Record<string, unknown> | undefined;

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  flags.chatwoot_portal = true;
  api.buscarMensajePorSourceId.mockResolvedValue({ ok: true, data: null });
  api.crearNotaPrivada.mockResolvedValue({ ok: true, data: 8001 });
  api.leerMensaje.mockResolvedValue({ ok: true, data: filaApi() });
  push.notifyClientReplyPush.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("interpretarMensajePortal", () => {
  it("lee la carga del webhook: texto, hora ISO, tipo en texto y el agente por su `type`", () => {
    const m = interpretarMensajePortal(cargaWebhook({ attachments: [{ id: 1 }] }));
    expect(m).toEqual({
      id: MSG,
      conversacionId: CONV,
      inboxId: INBOX_PORTAL,
      tipo: "outgoing",
      privado: false,
      sourceId: null,
      texto: TEXTO,
      tipoContenido: "text",
      adjuntos: 1,
      creado: CREADO,
      agenteId: 7,
    });
  });

  it("lee la fila de la API de cuenta: tipo numérico y hora en segundos", () => {
    const m = interpretarMensajePortal(filaApi());
    expect(m).toMatchObject({ id: MSG, conversacionId: CONV, inboxId: INBOX_PORTAL, tipo: "outgoing", creado: CREADO, agenteId: 7 });
    expect(interpretarMensajePortal(filaApi({ message_type: 0 }))?.tipo).toBe("incoming");
    expect(interpretarMensajePortal(filaApi({ message_type: 2 }))?.tipo).toBe("activity");
    expect(interpretarMensajePortal(filaApi({ message_type: 3 }))?.tipo).toBe("template");
    expect(interpretarMensajePortal(filaApi({ message_type: 9 }))?.tipo).toBeNull();
  });

  it("un bot o un contacto no firman, aunque su id coincida con el de un agente", () => {
    expect(interpretarMensajePortal(cargaWebhook({ sender: { id: 7, name: "Bot", type: "agent_bot" } }))?.agenteId).toBeNull();
    expect(interpretarMensajePortal(filaApi({ sender_type: "AgentBot", sender: { id: 7, type: "agent_bot" } }))?.agenteId).toBeNull();
    expect(interpretarMensajePortal(cargaWebhook({ sender: { id: 7, name: "Contacto" } }))?.agenteId).toBeNull();
    expect(interpretarMensajePortal(cargaWebhook({ sender: null }))?.agenteId).toBeNull();
  });

  it("sin id no hay mensaje", () => {
    expect(interpretarMensajePortal({ ...cargaWebhook(), id: 0 })).toBeNull();
    expect(interpretarMensajePortal(null)).toBeNull();
  });
});

describe("salientePortalDelPayload: la ruta lee el texto solo de la bandeja del portal", () => {
  it("una respuesta en la bandeja del portal pasa con su texto", () => {
    expect(enVivo()?.texto).toBe(TEXTO);
  });

  it("otra bandeja, un entrante u otro evento dan null", () => {
    expect(salientePortalDelPayload(cargaWebhook({ inbox: { id: 3 }, conversation: { id: CONV, inbox_id: 3 } }), INBOX_PORTAL)).toBeNull();
    expect(salientePortalDelPayload(cargaWebhook({ message_type: "incoming" }), INBOX_PORTAL)).toBeNull();
    expect(salientePortalDelPayload({ ...cargaWebhook(), event: "conversation_updated" }, INBOX_PORTAL)).toBeNull();
  });
});

describe("esRespuestaDelEquipo", () => {
  const m = (extra: Record<string, unknown>) => interpretarMensajePortal(cargaWebhook(extra))!;
  it("deja pasar solo lo saliente, público, de texto, de la bandeja y que no es nuestro", () => {
    expect(esRespuestaDelEquipo(m({}), INBOX_PORTAL)).toBe(true);
    expect(esRespuestaDelEquipo(m({ private: true }), INBOX_PORTAL)).toBe(false);
    expect(esRespuestaDelEquipo(m({ source_id: "dtd:40000000-0000-4000-8000-000000000001" }), INBOX_PORTAL)).toBe(false);
    expect(esRespuestaDelEquipo(m({ source_id: "dtd:nota:adjunto:7001" }), INBOX_PORTAL)).toBe(false);
    expect(esRespuestaDelEquipo(m({ message_type: "activity" }), INBOX_PORTAL)).toBe(false);
    expect(esRespuestaDelEquipo(m({ message_type: "template" }), INBOX_PORTAL)).toBe(false);
    expect(esRespuestaDelEquipo(m({ message_type: "incoming" }), INBOX_PORTAL)).toBe(false);
    expect(esRespuestaDelEquipo(m({ content_type: "input_csat" }), INBOX_PORTAL)).toBe(false);
    expect(esRespuestaDelEquipo(m({ inbox: { id: 3 }, conversation: { id: CONV, inbox_id: 3 } }), INBOX_PORTAL)).toBe(false);
    // Un source_id de otro sistema no es un eco nuestro.
    expect(esRespuestaDelEquipo(m({ source_id: "wamid.HBgM" }), INBOX_PORTAL)).toBe(true);
  });
});

describe("responderAlPortal", () => {
  it("escribe la respuesta con su hora y su agente, y avisa al cliente una vez", async () => {
    const admin = base();
    await responderAlPortal(contexto(admin, enVivo()), evento(), { nuevo: true, aplicado: true, clientId: null });
    expect(argsRespuesta(admin)).toEqual({
      p_tenant_id: T1,
      p_chatwoot_conversation_id: CONV,
      p_chatwoot_message_id: MSG,
      p_cuerpo: TEXTO,
      p_enviado_at: CREADO,
      p_chatwoot_user_id: 7,
    });
    expect(push.notifyClientReplyPush).toHaveBeenCalledTimes(1);
    expect(push.notifyClientReplyPush).toHaveBeenCalledWith(admin, { clientId: CLIENTE, body: TEXTO });
    // En vivo no se relee nada de Chatwoot ni se crea ninguna nota.
    expect(api.leerMensaje).not.toHaveBeenCalled();
    expect(api.crearNotaPrivada).not.toHaveBeenCalled();
  });

  it("un reintento (duplicado) no avisa otra vez", async () => {
    const admin = base({ resultado: "duplicado" });
    await responderAlPortal(contexto(admin, enVivo()), evento(), { nuevo: true, aplicado: true, clientId: null });
    expect(push.notifyClientReplyPush).not.toHaveBeenCalled();
  });

  for (const resultado of ["ficha_borrada", "sin_hilo", "apagado"] as const) {
    it(`«${resultado}» no avisa ni deja nota`, async () => {
      const admin = base({ resultado });
      await responderAlPortal(contexto(admin, enVivo(cargaWebhook({ attachments: [{ id: 1 }] }))), evento(), { nuevo: true, aplicado: true, clientId: null });
      expect(push.notifyClientReplyPush).not.toHaveBeenCalled();
      expect(api.crearNotaPrivada).not.toHaveBeenCalled();
    });
  }

  it("a un hilo archivado no le avisa y deja su nota privada, con su source_id", async () => {
    const admin = base({ resultado: "archivado" });
    await responderAlPortal(contexto(admin, enVivo()), evento(), { nuevo: true, aplicado: true, clientId: null });
    expect(push.notifyClientReplyPush).not.toHaveBeenCalled();
    expect(api.buscarMensajePorSourceId).toHaveBeenCalledWith(expect.anything(), CONV, `dtd:nota:archivado:${MSG}`, new Date(CREADO));
    expect(api.crearNotaPrivada).toHaveBeenCalledTimes(1);
    expect(api.crearNotaPrivada).toHaveBeenCalledWith(expect.anything(), CONV, { texto: NOTA_ARCHIVADO, sourceId: `dtd:nota:archivado:${MSG}` });
  });

  it("la nota ya estaba (un reintento): no se crea otra", async () => {
    api.buscarMensajePorSourceId.mockResolvedValue({ ok: true, data: 8001 });
    const admin = base({ resultado: "archivado" });
    await responderAlPortal(contexto(admin, enVivo()), evento(), { nuevo: true, aplicado: true, clientId: null });
    expect(api.crearNotaPrivada).not.toHaveBeenCalled();
  });

  it("sin poder buscar la nota no se crea otra: lanza para reintentar", async () => {
    api.buscarMensajePorSourceId.mockResolvedValue({ ok: false, error: "busqueda_incompleta" });
    const admin = base({ resultado: "archivado" });
    await expect(responderAlPortal(contexto(admin, enVivo()), evento(), { nuevo: true, aplicado: true, clientId: null })).rejects.toThrow(
      "nota_buscar_busqueda_incompleta",
    );
    expect(api.crearNotaPrivada).not.toHaveBeenCalled();
  });

  it("con un adjunto: el texto llega al portal, avisa y deja la nota del adjunto", async () => {
    const admin = base();
    await responderAlPortal(contexto(admin, enVivo(cargaWebhook({ attachments: [{ id: 1 }] }))), evento(), { nuevo: true, aplicado: true, clientId: null });
    expect(argsRespuesta(admin)?.p_cuerpo).toBe(TEXTO);
    expect(push.notifyClientReplyPush).toHaveBeenCalledTimes(1);
    expect(api.crearNotaPrivada).toHaveBeenCalledWith(expect.anything(), CONV, { texto: NOTA_ADJUNTO, sourceId: `dtd:nota:adjunto:${MSG}` });
  });

  it("solo un adjunto, sin texto: no avisa y deja la nota", async () => {
    const admin = base({ resultado: "sin_texto" });
    await responderAlPortal(contexto(admin, enVivo(cargaWebhook({ content: "  ", attachments: [{ id: 1 }] }))), evento(), {
      nuevo: true,
      aplicado: true,
      clientId: null,
    });
    expect(argsRespuesta(admin)?.p_cuerpo).toBeNull();
    expect(push.notifyClientReplyPush).not.toHaveBeenCalled();
    expect(api.crearNotaPrivada).toHaveBeenCalledWith(expect.anything(), CONV, { texto: NOTA_ADJUNTO, sourceId: `dtd:nota:adjunto:${MSG}` });
  });

  it("el adjunto de un reintento (duplicado) deja la nota si faltaba, sin avisar", async () => {
    const admin = base({ resultado: "duplicado" });
    await responderAlPortal(contexto(admin, enVivo(cargaWebhook({ attachments: [{ id: 1 }] }))), evento(), { nuevo: true, aplicado: true, clientId: null });
    expect(push.notifyClientReplyPush).not.toHaveBeenCalled();
    expect(api.crearNotaPrivada).toHaveBeenCalledTimes(1);
  });

  it("si la nota falla, lanza después del push: el reintento no vuelve a avisar", async () => {
    api.crearNotaPrivada.mockResolvedValue({ ok: false, error: "http_500" });
    const admin = base();
    await expect(
      responderAlPortal(contexto(admin, enVivo(cargaWebhook({ attachments: [{ id: 1 }] }))), evento(), { nuevo: true, aplicado: true, clientId: null }),
    ).rejects.toThrow("nota_http_500");
    expect(push.notifyClientReplyPush).toHaveBeenCalledTimes(1);
  });

  it("si la base falla, lanza (el evento queda fallido y se reintenta)", async () => {
    const admin = base({ falla: "chatwoot_portal_respuesta" });
    await expect(responderAlPortal(contexto(admin, enVivo()), evento(), { nuevo: true, aplicado: true, clientId: null })).rejects.toThrow(
      "chatwoot_portal_respuesta: XX000",
    );
    expect(push.notifyClientReplyPush).not.toHaveBeenCalled();
  });

  describe("no hace nada", () => {
    const sinNada = async (ctx: ContextoChatwoot, ev: EventoChatwoot, admin: ReturnType<typeof base>) => {
      await responderAlPortal(ctx, ev, { nuevo: true, aplicado: true, clientId: null });
      expect(admin.rpc).not.toHaveBeenCalled();
      expect(api.leerMensaje).not.toHaveBeenCalled();
      expect(push.notifyClientReplyPush).not.toHaveBeenCalled();
    };

    it("con el flag apagado", async () => {
      flags.chatwoot_portal = false;
      const admin = base();
      await sinNada(contexto(admin, enVivo()), evento(), admin);
    });

    it("sin la bandeja del portal configurada", async () => {
      vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "");
      const admin = base();
      await sinNada(contexto(admin, enVivo()), evento(), admin);
    });

    it("si el tenant del webhook no es el de la configuración", async () => {
      const admin = base();
      await sinNada({ ...contexto(admin, enVivo()), tenantId: T2 }, evento(), admin);
    });

    it("si la ruta ya miró y no es una respuesta del portal", async () => {
      const admin = base();
      await sinNada(contexto(admin, null), evento(), admin);
    });

    it("con un entrante (el que avisa)", async () => {
      const admin = base();
      await sinNada(contexto(admin), evento({ avisar: true }), admin);
    });

    it("con otra bandeja", async () => {
      const admin = base();
      await sinNada(contexto(admin), evento({ conversacion: { ...evento().conversacion, inboxId: 3 } }), admin);
    });

    it("con otro evento", async () => {
      const admin = base();
      await sinNada(contexto(admin, enVivo()), evento({ evento: "conversation_status_changed", mensajeId: null }), admin);
    });

    it("con una nota privada, un eco nuestro o un mensaje de actividad", async () => {
      for (const extra of [{ private: true }, { source_id: "dtd:nota:archivado:7001" }, { message_type: "activity" }]) {
        const admin = base();
        // La ruta solo pasa lo saliente; el filtro fino es del manejador.
        const m = interpretarMensajePortal(cargaWebhook(extra));
        await sinNada(contexto(admin, m), evento(), admin);
      }
    });
  });

  describe("el reproceso relee el mensaje en Chatwoot", () => {
    it("con la conversación vinculada, lo relee y lo escribe", async () => {
      const admin = base();
      await responderAlPortal(contexto(admin), eventoReproceso(), { nuevo: true, aplicado: false, clientId: null });
      expect(api.leerMensaje).toHaveBeenCalledWith(expect.objectContaining({ token: ENV.CHATWOOT_ROUTER_TOKEN }), CONV, MSG);
      expect(argsRespuesta(admin)).toMatchObject({ p_cuerpo: TEXTO, p_enviado_at: CREADO, p_chatwoot_user_id: 7 });
      expect(push.notifyClientReplyPush).toHaveBeenCalledTimes(1);
    });

    it("una conversación que no es del portal (o de otro tenant) no se relee", async () => {
      const admin = base({ hilos: [{ tenant_id: T2, chatwoot_conversation_id: CONV }] });
      await responderAlPortal(contexto(admin), eventoReproceso(), { nuevo: true, aplicado: false, clientId: null });
      expect(api.leerMensaje).not.toHaveBeenCalled();
      expect(admin.rpc).not.toHaveBeenCalled();
    });

    it("si el mensaje ya no está en Chatwoot, no hace nada", async () => {
      api.leerMensaje.mockResolvedValue({ ok: true, data: null });
      const admin = base();
      await responderAlPortal(contexto(admin), eventoReproceso(), { nuevo: true, aplicado: false, clientId: null });
      expect(admin.rpc).not.toHaveBeenCalled();
    });

    it("si Chatwoot no contesta, lanza para reintentar", async () => {
      api.leerMensaje.mockResolvedValue({ ok: false, error: "red" });
      const admin = base();
      await expect(responderAlPortal(contexto(admin), eventoReproceso(), { nuevo: true, aplicado: false, clientId: null })).rejects.toThrow(
        "leer_mensaje_red",
      );
    });

    it("si la base no dice si es del portal, lanza", async () => {
      const admin = base({ falla: "from:chatwoot_portal_hilos" });
      await expect(responderAlPortal(contexto(admin), eventoReproceso(), { nuevo: true, aplicado: false, clientId: null })).rejects.toThrow(
        "chatwoot_portal_hilos: XX000",
      );
      expect(api.leerMensaje).not.toHaveBeenCalled();
    });

    it("lo releído también se filtra: una nota privada no va al portal", async () => {
      api.leerMensaje.mockResolvedValue({ ok: true, data: filaApi({ private: true }) });
      const admin = base();
      await responderAlPortal(contexto(admin), eventoReproceso(), { nuevo: true, aplicado: false, clientId: null });
      expect(admin.rpc).not.toHaveBeenCalled();
    });
  });

  it("los errores y avisos nunca llevan el texto del mensaje", async () => {
    const espias = [vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {}), vi.spyOn(console, "info").mockImplementation(() => {}), vi.spyOn(console, "log").mockImplementation(() => {})];
    api.crearNotaPrivada.mockResolvedValue({ ok: false, error: "http_500" });
    const admin = base({ resultado: "archivado" });
    const error = await responderAlPortal(contexto(admin, enVivo()), evento(), { nuevo: true, aplicado: true, clientId: null }).catch((e: Error) => e);
    expect(String(error)).not.toContain("Valencia");
    for (const espia of espias) {
      for (const llamada of espia.mock.calls) expect(JSON.stringify(llamada)).not.toContain("Valencia");
      espia.mockRestore();
    }
  });
});

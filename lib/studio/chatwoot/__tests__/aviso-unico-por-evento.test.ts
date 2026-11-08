// @vitest-environment node
/**
 * SDD-0585 · un aviso por evento y persona, en cualquier camino. Lo destapó el ensayo
 * en prueba del 2026-11-04: cada reintento encolaba otro aviso y un evento dio 4.
 *
 * Corre el `enqueueUserPush` real contra un outbox que se comporta como el de verdad:
 * guarda el payload tal cual, aplica la barrera de 60 s de `enqueue_user_push` (0216)
 * y filtra por `payload->>clave_evento`. `marcarEnviados` hace lo que hace el drenado:
 * por eso la barrera no alcanza y hace falta la clave. Un doble que devolviera todo, o
 * que guardara otra forma del payload, no probaría nada de esto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Fila = { tenant_id: string; target_type: string; target_id: string; payload: Record<string, unknown>; sent_at: string | null };

const m = vi.hoisted(() => ({ outbox: [] as unknown[], drenar: vi.fn(async () => ({ processed: 0, delivered: 0, failed: 0 })) }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ chatwoot_inbox: true }) }));
vi.mock("@/lib/studio/notify/operario-push-outbox", async (original) => ({
  ...(await original<typeof import("@/lib/studio/notify/operario-push-outbox")>()),
  drainOperarioPushOutbox: m.drenar,
}));

import {
  avisarPorPush,
  MANEJADORES,
  nombreManejador,
  procesarEventoChatwoot,
  reprocesarEventosChatwoot,
  type ManejadorEvento,
} from "../webhook-procesar";
import { interpretarEvento, type EventoChatwoot } from "../webhook-events";
import { mensajeCreado } from "./webhook-fixtures";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const LINKS = [
  { tenant_id: T1, user_id: "u-ana", chatwoot_user_id: 7 },
  { tenant_id: T1, user_id: "u-luis", chatwoot_user_id: 8 },
];

const outbox = () => m.outbox as Fila[];
/** Lo que se le quedó a una persona: el número que tiene que ser exactamente 1. */
const avisos = (usuario: string, clave = "message_created:101") =>
  outbox().filter((f) => f.target_id === usuario && f.payload.clave_evento === clave).length;

/** `payload->>x` como PostgREST: si la clave se guardara con otro nombre, no la encontraría. */
const valor = (fila: Record<string, unknown>, columna: string) => {
  const [base, llave] = columna.split("->>");
  return llave ? (fila[base] as Record<string, unknown>)[llave] : fila[columna];
};

function crearAdmin(opciones: { falla?: (usuario: string) => boolean; lecturaFalla?: boolean; pendientes?: unknown[] } = {}) {
  const rpc = vi.fn(async (nombre: string, args: Record<string, unknown> = {}) => {
    if (nombre === "enqueue_user_push") {
      const usuario = args.p_user_id as string;
      if (opciones.falla?.(usuario)) return { data: null, error: { message: "base caída" } };
      const tag = (args.p_payload as Record<string, unknown>).tag;
      const pendiente = outbox().find((f) => f.target_id === usuario && f.sent_at === null && f.payload.tag === tag);
      if (pendiente) return { data: "evt-existente", error: null };
      outbox().push({
        tenant_id: args.p_tenant_id as string,
        target_type: "user",
        target_id: usuario,
        payload: args.p_payload as Record<string, unknown>,
        sent_at: null,
      });
      return { data: `evt-${outbox().length}`, error: null };
    }
    if (nombre === "chatwoot_tomar_pendientes") return { data: opciones.pendientes ?? [], error: null };
    if (nombre === "chatwoot_registrar_evento") return { data: [{ nuevo: true, aplicado: true, client_id: null }], error: null };
    return { data: null, error: null };
  });
  const from = (tabla: string) => {
    const filtros: [string, unknown][] = [];
    const filas = () => (tabla === "chatwoot_agent_links" ? LINKS : tabla === "outbox_push_events" ? outbox() : []) as Record<string, unknown>[];
    const b = {
      select: () => b,
      eq: (columna: string, v: unknown) => (filtros.push([columna, v]), b),
      then: (ok: (v: { data: unknown; error: unknown }) => unknown) => {
        if (tabla === "outbox_push_events" && opciones.lecturaFalla) return Promise.resolve(ok({ data: null, error: { code: "57014" } }));
        return Promise.resolve(ok({ data: filas().filter((f) => filtros.every(([c, v]) => valor(f, c) === v)), error: null }));
      },
    };
    return b;
  };
  return { rpc, from } as unknown as Parameters<typeof reprocesarEventosChatwoot>[0] & { rpc: typeof rpc };
}

/** Como el drenado: pasados esos segundos el aviso ya salió y la barrera de 60 s no lo ve. */
function marcarEnviados() {
  for (const f of outbox()) f.sent_at = "2026-11-04T00:00:00Z";
}

const SOLO_AVISO: readonly ManejadorEvento[] = [avisarPorPush];
const FALLA_DESPUES: readonly ManejadorEvento[] = [
  avisarPorPush,
  async () => {
    throw new Error("clasificar falló");
  },
];
const sinAsignado = () =>
  interpretarEvento(
    mensajeCreado({ conversation: { ...mensajeCreado().conversation, meta: { sender: {}, assignee: { id: 99 } } } }),
  ) as EventoChatwoot;
const conAsignado = () => interpretarEvento(mensajeCreado()) as EventoChatwoot;
const fila = (extra: Record<string, unknown> = {}) => ({
  tenant_id: T1,
  event_key: "message_created:101",
  event: "message_created",
  conversation_id: 12,
  message_id: 101,
  avisar: true,
  assignee_id: 7,
  attempts: 2,
  ...extra,
});

beforeEach(() => {
  m.outbox = [];
  m.drenar.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("un aviso por evento y persona (SDD-0585)", () => {
  it("encoló y falló otro manejador: el reintento no repite el aviso", async () => {
    const a = crearAdmin({ pendientes: [fila()] });
    expect((await procesarEventoChatwoot({ admin: a, tenantId: T1 }, conAsignado(), FALLA_DESPUES)).estado).toBe("fallido");
    expect(avisos("u-ana")).toBe(1);
    marcarEnviados();

    expect(await reprocesarEventosChatwoot(a, SOLO_AVISO)).toEqual({ tomados: 1, procesados: 1, fallidos: 0 });
    expect(avisos("u-ana")).toBe(1);
    expect(outbox()).toHaveLength(1);
  });

  it("cuatro reintentos seguidos siguen dejando uno", async () => {
    const a = crearAdmin({ pendientes: [fila()] });
    await procesarEventoChatwoot({ admin: a, tenantId: T1 }, conAsignado(), FALLA_DESPUES);
    for (let i = 0; i < 4; i += 1) {
      marcarEnviados();
      await reprocesarEventosChatwoot(a, FALLA_DESPUES);
    }
    expect(outbox()).toHaveLength(1);
  });

  it("falló antes de encolar: el reintento SÍ avisa, una vez", async () => {
    const roto = crearAdmin({ falla: () => true });
    expect((await procesarEventoChatwoot({ admin: roto, tenantId: T1 }, conAsignado(), SOLO_AVISO)).estado).toBe("fallido");
    expect(outbox()).toHaveLength(0);

    const sano = crearAdmin({ pendientes: [fila()] });
    expect(await reprocesarEventosChatwoot(sano, SOLO_AVISO)).toEqual({ tomados: 1, procesados: 1, fallidos: 0 });
    expect(avisos("u-ana")).toBe(1);
  });

  it("colgado en «procesando» después de encolar: no repite", async () => {
    const a = crearAdmin({ pendientes: [fila({ attempts: 2 })] });
    // El primer intento encoló y el proceso murió: no llegó a cerrar ni a drenar.
    await avisarPorPush({ admin: a, tenantId: T1 }, conAsignado(), { nuevo: true, aplicado: true, clientId: null });
    expect(avisos("u-ana")).toBe(1);

    expect(await reprocesarEventosChatwoot(a, SOLO_AVISO)).toEqual({ tomados: 1, procesados: 1, fallidos: 0 });
    expect(avisos("u-ana")).toBe(1);
  });

  it("colgado en «procesando» antes de encolar: sí avisa", async () => {
    const a = crearAdmin({ pendientes: [fila({ attempts: 2 })] });
    expect(await reprocesarEventosChatwoot(a, SOLO_AVISO)).toEqual({ tomados: 1, procesados: 1, fallidos: 0 });
    expect(avisos("u-ana")).toBe(1);
  });

  it("a medias entre dos personas: el evento queda fallido y el reintento solo completa a la que faltó", async () => {
    const roto = crearAdmin({ falla: (u) => u === "u-luis" });
    expect((await procesarEventoChatwoot({ admin: roto, tenantId: T1 }, sinAsignado(), SOLO_AVISO)).estado).toBe("fallido");
    expect([avisos("u-ana"), avisos("u-luis")]).toEqual([1, 0]);
    // El que sí se encoló sale ya, aunque el evento quede para reintentar.
    expect(m.drenar).toHaveBeenCalledTimes(1);
    marcarEnviados();

    const sano = crearAdmin({ pendientes: [fila({ assignee_id: 99 })] });
    expect(await reprocesarEventosChatwoot(sano, SOLO_AVISO)).toEqual({ tomados: 1, procesados: 1, fallidos: 0 });
    expect([avisos("u-ana"), avisos("u-luis")]).toEqual([1, 1]);
  });

  it("otro mensaje de la misma conversación sí avisa: la clave es del evento, no de la conversación", async () => {
    const a = crearAdmin();
    await procesarEventoChatwoot({ admin: a, tenantId: T1 }, conAsignado(), SOLO_AVISO);
    marcarEnviados();
    const otro = interpretarEvento(mensajeCreado({ id: 102 })) as EventoChatwoot;
    await procesarEventoChatwoot({ admin: a, tenantId: T1 }, otro, SOLO_AVISO);
    expect([avisos("u-ana"), avisos("u-ana", "message_created:102")]).toEqual([1, 1]);
  });

  it("el mismo número de evento en otro tenant no cuenta como avisado", async () => {
    outbox().push({
      tenant_id: T2,
      target_type: "user",
      target_id: "u-ana",
      payload: { clave_evento: "message_created:101", tag: "otro" },
      sent_at: "2026-11-04T00:00:00Z",
    });
    await procesarEventoChatwoot({ admin: crearAdmin(), tenantId: T1 }, conAsignado(), SOLO_AVISO);
    expect(outbox().filter((f) => f.tenant_id === T1)).toHaveLength(1);
  });

  it("si no se puede saber quién ya lo tiene, no encola: mejor reintentar que repetir", async () => {
    const a = crearAdmin({ lecturaFalla: true });
    expect((await procesarEventoChatwoot({ admin: a, tenantId: T1 }, conAsignado(), SOLO_AVISO)).estado).toBe("fallido");
    expect(outbox()).toHaveLength(0);
    expect(a.rpc.mock.calls.some((c) => c[0] === "enqueue_user_push")).toBe(false);
  });

  it("la clave se guarda en el outbox, y un aviso de otro origen no cambia de forma", async () => {
    const { enqueueUserPush } = await import("@/lib/studio/notify/operario-push-outbox");
    const a = crearAdmin();
    await enqueueUserPush(a, T1, "u-ana", { title: "t", body: "b", claveEvento: "message_created:7" });
    await enqueueUserPush(a, T1, "u-luis", { title: "t", body: "b" });
    expect(outbox().map((f) => f.payload)).toEqual([
      { title: "t", body: "b", url: "/studio", tag: null, requireInteraction: false, clave_evento: "message_created:7" },
      { title: "t", body: "b", url: "/studio", tag: null, requireInteraction: false },
    ]);
  });
});

describe("nombre del manejador en los logs (SDD-0585)", () => {
  it("sobrevive a la minificación: no depende de `fn.name`", () => {
    const nombres = MANEJADORES.map((h) => h.name);
    try {
      for (const h of MANEJADORES) Object.defineProperty(h, "name", { value: "f", configurable: true });
      expect(MANEJADORES.map(nombreManejador)).toEqual(["avisarPorPush", "clasificarContacto", "entrarLead", "responderAlPortal"]);
    } finally {
      MANEJADORES.forEach((h, i) => Object.defineProperty(h, "name", { value: nombres[i], configurable: true }));
    }
  });

  it("uno que no está en la lista usa su propio nombre, y si no tiene, «anónimo»", () => {
    const propio: ManejadorEvento = async () => {};
    expect(nombreManejador(propio)).toBe("propio");
    expect(nombreManejador((() => async () => {})())).toBe("anónimo");
  });

  it("el log nombra al manejador que falló y no dice nada del payload", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await procesarEventoChatwoot({ admin: crearAdmin({ lecturaFalla: true }), tenantId: T1 }, conAsignado(), SOLO_AVISO);
    expect(aviso).toHaveBeenCalledWith("[chatwoot] manejador avisarPorPush falló: Error");
  });
});

// @vitest-environment node
/**
 * SDD-0585 · procesarEventoChatwoot y el aviso push. El doble de Supabase aplica
 * el filtro por tenant de los vínculos: un doble que devuelve todo no prueba
 * que el aviso vaya solo al tenant del evento.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  flags: { chatwoot_inbox: true } as Record<string, boolean>,
  encolar: vi.fn(async () => "evt-1"),
  drenar: vi.fn(async () => ({ processed: 1, delivered: 1, failed: 0 })),
}));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => m.flags }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: m.encolar, drainOperarioPushOutbox: m.drenar }));

import { avisarPorPush, procesarEventoChatwoot } from "../webhook-procesar";
import { interpretarEvento, type EventoChatwoot } from "../webhook-events";
import { TEXTO_SINTETICO, mensajeCreado } from "./webhook-fixtures";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const LINKS = [
  { tenant_id: T1, user_id: "u-ana", chatwoot_user_id: 7 },
  { tenant_id: T1, user_id: "u-luis", chatwoot_user_id: 8 },
  { tenant_id: T2, user_id: "u-otro", chatwoot_user_id: 7 },
];

function admin(rpcResultado: { nuevo: boolean; aplicado: boolean; client_id: string | null } | Error) {
  type Rpc = (nombre: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code: string; message: string } | null }>;
  const rpc = vi.fn<Rpc>(async (nombre) => {
    if (nombre === "chatwoot_cerrar_evento") return { data: null, error: null };
    return rpcResultado instanceof Error ? { data: null, error: { code: "XX000", message: "x" } } : { data: [rpcResultado], error: null };
  });
  const from = (tabla: string) => {
    const filtros: ((f: Record<string, unknown>) => boolean)[] = [];
    const b = {
      select: () => b,
      eq: (col: string, v: unknown) => (filtros.push((f) => f[col] === v), b),
      then: (ok: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve(ok({ data: (tabla === "chatwoot_agent_links" ? LINKS : []).filter((f) => filtros.every((p) => p(f))), error: null })),
    };
    return b;
  };
  return { rpc, from } as unknown as Parameters<typeof procesarEventoChatwoot>[0]["admin"] & { rpc: typeof rpc };
}

const evento = (extra: Record<string, unknown> = {}) => interpretarEvento(mensajeCreado(extra)) as EventoChatwoot;

beforeEach(() => {
  vi.clearAllMocks();
  m.flags = { chatwoot_inbox: true };
  // clearAllMocks no reinicia lo que un caso dejó con mockResolvedValue.
  m.encolar.mockResolvedValue("evt-1");
});

describe("procesarEventoChatwoot (SDD-0585)", () => {
  it("llama la RPC con lo mínimo: sin texto ni teléfono completo", async () => {
    const a = admin({ nuevo: true, aplicado: true, client_id: null });
    await procesarEventoChatwoot({ admin: a, tenantId: T1 }, evento(), []);
    const args = (a.rpc.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(args).toMatchObject({
      p_tenant_id: T1,
      p_event_key: "message_created:101",
      p_event: "message_created",
      p_conversation_id: 12,
      p_status: "open",
      p_unread_count: 2,
      p_assignee_id: 7,
      p_phone_last10: "4125550101",
    });
    expect(JSON.stringify(args)).not.toContain(TEXTO_SINTETICO);
  });

  it("duplicado: no corre manejadores", async () => {
    const manejador = vi.fn(async () => {});
    const r = await procesarEventoChatwoot({ admin: admin({ nuevo: false, aplicado: false, client_id: null }), tenantId: T1 }, evento(), [manejador]);
    expect(r).toEqual({ estado: "duplicado", aplicado: false });
    expect(manejador).not.toHaveBeenCalled();
  });

  const cierres = (a: ReturnType<typeof admin>) =>
    a.rpc.mock.calls.filter((c) => c[0] === "chatwoot_cerrar_evento").map((c) => c[1]);

  it("todo bien: cierra el evento como procesado", async () => {
    const a = admin({ nuevo: true, aplicado: true, client_id: null });
    const r = await procesarEventoChatwoot({ admin: a, tenantId: T1 }, evento(), [async () => {}]);
    expect(r.estado).toBe("procesado");
    expect(cierres(a)).toEqual([{ p_tenant_id: T1, p_event_key: "message_created:101", p_ok: true }]);
  });

  it("un manejador que falla: corre el resto, el evento queda FALLIDO (reintentable) y no procesado", async () => {
    const a = admin({ nuevo: true, aplicado: true, client_id: null });
    const segundo = vi.fn(async () => {});
    const r = await procesarEventoChatwoot(
      { admin: a, tenantId: T1 },
      evento(),
      [async () => { throw new Error("falla"); }, segundo],
    );
    expect(r.estado).toBe("fallido");
    expect(segundo).toHaveBeenCalledTimes(1);
    expect(cierres(a)).toEqual([{ p_tenant_id: T1, p_event_key: "message_created:101", p_ok: false }]);
  });

  it("duplicado real: no cierra nada (lo cerró la primera entrega)", async () => {
    const a = admin({ nuevo: false, aplicado: false, client_id: null });
    await procesarEventoChatwoot({ admin: a, tenantId: T1 }, evento(), [async () => {}]);
    expect(cierres(a)).toEqual([]);
  });

  it("si la RPC falla, lanza (la ruta responde 500)", async () => {
    await expect(procesarEventoChatwoot({ admin: admin(new Error("x")), tenantId: T1 }, evento(), [])).rejects.toThrow(/chatwoot_registrar_evento/);
  });
});

describe("avisarPorPush (SDD-0585)", () => {
  const nuevo = { nuevo: true, aplicado: true, clientId: null };

  it("si no se pudo encolar ningún aviso, falla (para que el evento quede reintentable)", async () => {
    m.encolar.mockResolvedValue(null as unknown as string);
    await expect(
      avisarPorPush({ admin: admin({ nuevo: true, aplicado: true, client_id: null }), tenantId: T1 }, evento(), nuevo),
    ).rejects.toThrow(/push/);
  });

  it("con asignado vinculado: solo a ese usuario, sin datos personales en el cuerpo", async () => {
    await avisarPorPush({ admin: admin({ nuevo: true, aplicado: true, client_id: null }), tenantId: T1 }, evento(), nuevo);
    expect(m.encolar).toHaveBeenCalledTimes(1);
    const [, tenant, usuario, payload] = m.encolar.mock.calls[0] as unknown as [unknown, string, string, Record<string, string>];
    expect(tenant).toBe(T1);
    expect(usuario).toBe("u-ana");
    expect(payload).toEqual({
      title: "Bandeja · mensaje nuevo",
      body: "Tienes un mensaje nuevo en la conversación #12.",
      url: "/studio/bandeja?c=12",
      tag: "chatwoot-conversacion-12",
    });
    expect(m.drenar).toHaveBeenCalledTimes(1);
  });

  it("sin asignado vinculado: a todos los vinculados DEL TENANT, no a los de otro", async () => {
    const sinAsignado = interpretarEvento(mensajeCreado({ conversation: { ...mensajeCreado().conversation, meta: { sender: {}, assignee: { id: 99 } } } })) as EventoChatwoot;
    await avisarPorPush({ admin: admin({ nuevo: true, aplicado: true, client_id: null }), tenantId: T1 }, sinAsignado, nuevo);
    expect(m.encolar.mock.calls.map((c) => (c as unknown as unknown[])[2]).sort()).toEqual(["u-ana", "u-luis"]);
  });

  it.each([
    ["saliente", evento({ message_type: "outgoing" }), nuevo, { chatwoot_inbox: true }],
    ["nota privada", evento({ private: true }), nuevo, { chatwoot_inbox: true }],
    ["flag apagado", evento(), nuevo, { chatwoot_inbox: false }],
    ["evento repetido", evento(), { ...nuevo, nuevo: false }, { chatwoot_inbox: true }],
  ])("%s: no avisa", async (_caso, e, registro, flags) => {
    m.flags = flags;
    await avisarPorPush({ admin: admin({ nuevo: true, aplicado: true, client_id: null }), tenantId: T1 }, e, registro);
    expect(m.encolar).not.toHaveBeenCalled();
  });
});

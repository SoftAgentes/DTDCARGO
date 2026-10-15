// @vitest-environment node
/**
 * SDD-0524 · el push del aviso le llega a TODOS los usuarios activos del Portal
 * de ese cliente que tengan una suscripción, sin depender de que haya uno solo.
 *
 * `dispatchPush` buscaba el vínculo con `.maybeSingle()`: con dos filas
 * activas PostgREST devuelve PGRST116 y `data: null`, y el push se daba por
 * «sin destino» en silencio. Hoy la tabla lo impide (`client_users` es
 * `unique (tenant_id, client_id)`, 0080:29), así que el caso no ocurre en
 * producción; el despacho deja de depender de esa garantía, igual que hizo la
 * 0453 con sus helpers del Portal.
 *
 * Además, ahora sólo se encola a quien tiene suscripción: encolar para un
 * usuario sin dispositivo marcaba el aviso como enviado sin que llegara nada.
 *
 * Drain REAL sobre el doble que filtra (`lectores-admin-double.ts`): un
 * vínculo revocado o de otro tenant con el mismo cliente no recibe nada porque
 * los filtros de la consulta lo dejan fuera, no porque el doble lo ignore.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dobleLectores,
  type Fila,
  type OpcionesDoble,
  type Tablas,
} from "@/lib/studio/__tests__/lectores-admin-double";

const sendEmail = vi.fn(
  (...args: unknown[]): Promise<{ ok: boolean; queued?: boolean }> => {
    void args;
    return Promise.resolve({ ok: true });
  },
);
const enqueueUserPush = vi.fn((...args: unknown[]): Promise<string | null> => {
  void args;
  return Promise.resolve("evt-1");
});
const drainOperarioPushOutbox = vi.fn((...args: unknown[]) => {
  void args;
  return Promise.resolve({ processed: 0, delivered: 0, failed: 0 });
});

vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({
  enqueueUserPush: (...a: unknown[]) => enqueueUserPush(...a),
  drainOperarioPushOutbox: (...a: unknown[]) => drainOperarioPushOutbox(...a),
}));

import { drainClientNotifications } from "../drain-client-notifications";

const T = "t1";
const COMPRA = "DTD-1004-0002";

function aviso(over: Fila = {}): Fila {
  return {
    id: "sch-1",
    tenant_id: T,
    shipment_id: null,
    prealerta_id: "p-1",
    client_markbox: "DTD-1004",
    rule_id: "r-bodega",
    trigger_event: "status:in_warehouse",
    channel: "push",
    payload: {
      title: "Tu carga llegó a nuestra bodega en China",
      body: "Recibimos tu mercancía en Yiwu.",
      anchorKind: "prealerta",
      anchorCode: COMPRA,
      anchorLabel: "Compra",
      portalPath: `/portal/compras/${COMPRA}`,
      clientName: null,
    },
    status: "scheduled",
    scheduled_for: "2026-01-01T00:00:00.000Z",
    attempts: 0,
    ...over,
  };
}

const VINCULO = (id: string, user: string, over: Fila = {}): Fila => ({
  id,
  tenant_id: T,
  client_id: "c-1004",
  auth_user_id: user,
  status: "active",
  ...over,
});

const SUSCRIPCION = (user: string): Fila => ({
  id: `sub-${user}`,
  tenant_id: T,
  user_id: user,
  endpoint: `https://push.example/${user}`,
});

function tablas(over: Partial<Tablas> = {}): Tablas {
  return {
    client_notification_schedule: [aviso()],
    clients: [
      {
        id: "c-1004",
        tenant_id: T,
        markbox: "DTD-1004",
        email: null,
        name: "Importadora de prueba",
        deleted_at: null,
      },
    ],
    client_users: [
      VINCULO("cu-1", "u-1"),
      VINCULO("cu-2", "u-2"),
      // Revocado: no recibe, aunque conserve su suscripción.
      VINCULO("cu-3", "u-3", { status: "revoked" }),
      // Mismo client_id en otro tenant: el filtro por tenant lo deja fuera.
      VINCULO("cu-4", "u-4", { tenant_id: "t2" }),
      // Invitado que nunca entró: sin auth_user_id.
      VINCULO("cu-5", null as unknown as string, { status: "active", auth_user_id: null }),
    ],
    user_push_subscriptions: [
      SUSCRIPCION("u-1"),
      SUSCRIPCION("u-2"),
      SUSCRIPCION("u-3"),
      SUSCRIPCION("u-4"),
    ],
    user_notification_prefs: [],
    ...over,
  };
}

function destinatarios(): string[] {
  return enqueueUserPush.mock.calls.map((c) => c[2] as string).sort();
}

function correr(t: Tablas, opciones: OpcionesDoble = {}) {
  const d = dobleLectores(t, {}, opciones);
  return drainClientNotifications(d.client).then((res) => ({ res, d }));
}

beforeEach(() => {
  sendEmail.mockClear();
  enqueueUserPush.mockReset();
  enqueueUserPush.mockResolvedValue("evt-1");
  drainOperarioPushOutbox.mockClear();
});

describe("SDD-0524 · push a todos los usuarios activos del Portal con suscripción", () => {
  it("🔴 empresa con dos usuarios activos: el push sale a los dos (no a revocados ni a otro tenant)", async () => {
    const { res, d } = await correr(tablas());

    expect(destinatarios()).toEqual(["u-1", "u-2"]);
    for (const call of enqueueUserPush.mock.calls) {
      expect(call[1]).toBe(T);
      expect(call[3]).toMatchObject({
        url: `/portal/compras/${COMPRA}`,
        // El mismo tag por aviso: la idempotencia de enqueue_user_push (0216)
        // es por usuario + tag, así que no se pisan entre ellos.
        tag: "client-notif:sch-1",
      });
    }
    expect(res).toMatchObject({ delivered: 1, skipped: 0, failed: 0 });
    expect(d.store.client_notification_schedule[0].status).toBe("sent");
    // Se empuja el outbox durable sin esperar al cron.
    expect(drainOperarioPushOutbox).toHaveBeenCalled();
  });

  it("control del doble: con .maybeSingle() sobre esas dos filas, PostgREST devuelve PGRST116", async () => {
    const d = dobleLectores(tablas());
    const { data, error } = await d.client
      .from("client_users")
      .select("auth_user_id")
      .eq("tenant_id", T)
      .eq("client_id", "c-1004")
      .eq("status", "active")
      .not("auth_user_id", "is", null)
      .maybeSingle();
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });

  it("un solo usuario (el caso de hoy): un solo push", async () => {
    await correr(tablas({ client_users: [VINCULO("cu-1", "u-1")] }));
    expect(destinatarios()).toEqual(["u-1"]);
  });

  it("sólo recibe quien tiene suscripción", async () => {
    await correr(tablas({ user_push_subscriptions: [SUSCRIPCION("u-2")] }));
    expect(destinatarios()).toEqual(["u-2"]);
  });

  it("la suscripción vieja (jsonb de user_notification_prefs) también cuenta, como en el envío", async () => {
    await correr(
      tablas({
        user_push_subscriptions: [],
        user_notification_prefs: [
          { user_id: "u-1", channel_push: true, push_subscription: { endpoint: "x" } },
          // Con el push apagado no cuenta.
          { user_id: "u-2", channel_push: false, push_subscription: { endpoint: "y" } },
        ],
      }),
    );
    expect(destinatarios()).toEqual(["u-1"]);
  });

  it("🔴 nadie con suscripción: el aviso por push queda «sin canal», no «enviado»", async () => {
    // Un solo usuario a propósito: con dos, el código viejo también daba
    // «sin destino», pero por el PGRST116 y no por la suscripción.
    const { res, d } = await correr(
      tablas({ client_users: [VINCULO("cu-1", "u-1")], user_push_subscriptions: [] }),
    );
    expect(enqueueUserPush).not.toHaveBeenCalled();
    expect(res).toMatchObject({ delivered: 0, skipped: 1 });
    expect(d.store.client_notification_schedule[0]).toMatchObject({
      status: "skipped",
      error: "cliente sin canal disponible",
    });
  });

  it("si no se puede leer quién tiene suscripción, se encola a todos (mejor reintentar que perder)", async () => {
    await correr(tablas(), {
      fallarSelect: (t) =>
        t === "user_push_subscriptions" ? { code: "PGRST000", message: "caída" } : null,
    });
    expect(destinatarios()).toEqual(["u-1", "u-2"]);
  });

  it("si no se puede leer a los usuarios del Portal, es transitorio: vuelve a la cola", async () => {
    const { res, d } = await correr(tablas(), {
      fallarSelect: (t) => (t === "client_users" ? { code: "PGRST000", message: "caída" } : null),
    });
    expect(enqueueUserPush).not.toHaveBeenCalled();
    expect(res).toMatchObject({ delivered: 0, failed: 1 });
    expect(d.store.client_notification_schedule[0]).toMatchObject({
      status: "scheduled",
      attempts: 1,
    });
  });

  it("si no se pudo encolar a nadie, es transitorio", async () => {
    enqueueUserPush.mockResolvedValue(null);
    const { res, d } = await correr(tablas());
    expect(res).toMatchObject({ delivered: 0, failed: 1 });
    expect(d.store.client_notification_schedule[0].status).toBe("scheduled");
  });

  it("canal «both»: sale el correo y el push a los dos", async () => {
    await correr(
      tablas({
        client_notification_schedule: [aviso({ channel: "both" })],
        clients: [
          {
            id: "c-1004",
            tenant_id: T,
            markbox: "DTD-1004",
            email: "compras@example.com",
            name: "Importadora de prueba",
            deleted_at: null,
          },
        ],
      }),
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(destinatarios()).toEqual(["u-1", "u-2"]);
  });
});

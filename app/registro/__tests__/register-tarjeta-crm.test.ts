/**
 * SDD-0587 (6.4) · la tarjeta del CRM al registrarse.
 *
 * `/registro` lo usan clientes de verdad. Lo que protege este archivo: un fallo de
 * la tarjeta no rompe ni demora el alta. La tarjeta corre en `after()`, DESPUÉS de
 * responder. El doble de `after` guarda el callback sin ejecutarlo, así que una
 * action que esperara la tarjeta se colgaría aquí en vez de pasar.
 *
 * PRUEBA DE MUTACIÓN: si cambias `after(() => altaTarjetaWeb(...))` por un `await`
 * directo, «no demora» cae por el tiempo. Si quitas el try/catch, «sin request
 * scope» cae. Si el interruptor D7 acepta otro valor que `"1"`, su tabla cae.
 *
 * Molde y mocks: mismos que `register-origen-canal.test.ts` (sin red ni DB).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  despues: [] as (() => unknown)[],
  afterLanza: false,
  rpcTarjeta: null as null | (() => Promise<{ data: unknown; error: unknown }>),
  rpcs: [] as { nombre: string; args: Record<string, unknown> }[],
  invocaciones: [] as string[],
  createUser: null as null | (() => Promise<unknown>),
  duplicado: false,
}));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    if (estado.afterLanza) throw new Error("after() fuera de un request");
    estado.despues.push(fn);
  },
}));

function makeAdmin() {
  function resolveFor(table: string, op: string): { data?: unknown; error?: unknown; count?: number } {
    if (table === "portal_registro_throttle" && op === "select") return { count: 0, error: null };
    if (table === "tenants" && op === "select") return { data: { id: "tenant-1" }, error: null };
    if (table === "clients" && op === "insert") return { data: { id: "client-1" }, error: null };
    return { data: null, error: null };
  }
  function builder(table: string) {
    let op = "select";
    let fijado = false;
    const fijar = (o: string) => {
      if (!fijado) {
        op = o;
        fijado = true;
      }
    };
    const resolve = () => Promise.resolve(resolveFor(table, op));
    const chain: Record<string, unknown> = {
      select: () => (fijar("select"), chain),
      insert: () => (fijar("insert"), chain),
      eq: () => chain,
      is: () => chain,
      ilike: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => resolve().then(ok, ko),
    };
    return chain;
  }
  return {
    from: (table: string) => builder(table),
    rpc: (nombre: string, args: Record<string, unknown>) => {
      estado.rpcs.push({ nombre, args });
      if (nombre === "crm_alta_tarjeta_web") {
        return estado.rpcTarjeta ? estado.rpcTarjeta() : Promise.resolve({ data: [{ resultado: "creada" }], error: null });
      }
      if (nombre === "find_duplicate_client_service") {
        return Promise.resolve({
          data: estado.duplicado ? [{ client_id: "otro", matched_by: "documento" }] : [],
          error: null,
        });
      }
      return Promise.resolve({ data: "DTD-0001", error: null });
    },
    functions: {
      invoke: async (nombre: string) => {
        estado.invocaciones.push(nombre);
        return { error: null };
      },
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
    auth: {
      admin: {
        createUser: async () => (estado.createUser ? estado.createUser() : { data: { user: { id: "auth-1" } }, error: null }),
      },
    },
  };
}

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => (k === "x-forwarded-for" ? "1.2.3.4" : null) }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => makeAdmin() }));
vi.mock("@/lib/studio/welcome-email", () => ({ sendWelcomeEmail: async () => ({ ok: true }) }));
vi.mock("@/lib/studio/new-client-notify", () => ({ notifyNewClientToAdmin: async () => {} }));

import { registerClientAction } from "../actions";

const NOMBRE = "Carlos Sintetico";
const CORREO = "carlos.sintetico@example.test";
const DOCUMENTO = "V-12345678";
const WHATSAPP = "+58 412 5550101";

function form(extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("kind", "persona");
  f.set("name", NOMBRE);
  f.set("document", DOCUMENTO);
  f.set("email", CORREO);
  f.set("whatsapp", WHATSAPP);
  f.set("state", "Carabobo");
  f.set("city", "Valencia");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

const llamadasTarjeta = () => estado.rpcs.filter((r) => r.nombre === "crm_alta_tarjeta_web");
const correrDespues = async () => {
  for (const fn of estado.despues.splice(0)) await fn();
};
/** Falla si la action no volvió en este plazo: es lo que mide «no demora». */
const conPlazo = <T,>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("la action se quedó esperando")), 2_000))]);

beforeEach(() => {
  estado.despues = [];
  estado.afterLanza = false;
  estado.rpcTarjeta = null;
  estado.rpcs = [];
  estado.invocaciones = [];
  estado.createUser = null;
  estado.duplicado = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("registerClientAction · tarjeta del CRM (SDD-0587, 6.4)", () => {
  it("crea la tarjeta después de responder, con el tenant, la ficha y el origen", async () => {
    const res = await registerClientAction({}, form({ origen: "academia" }));
    expect(res).toEqual({ ok: true, markbox: "DTD-0001", warning: undefined });
    expect(llamadasTarjeta()).toEqual([]);
    await correrDespues();
    expect(llamadasTarjeta()).toEqual([
      {
        nombre: "crm_alta_tarjeta_web",
        args: {
          p_tenant_id: "tenant-1",
          p_client_id: "client-1",
          p_origen: "academia",
          p_utm_source: null,
          p_utm_medium: null,
          p_utm_campaign: null,
          p_utm_content: null,
          p_utm_term: null,
        },
      },
    ]);
  });

  it("guarda los UTM del formulario, normalizados otra vez: el formData llega del navegador", async () => {
    await registerClientAction(
      {},
      form({ utm_source: " facebook ", utm_campaign: "lanzamiento", utm_term: "ana.sintetica@example.test", utm_medium: "x".repeat(500) }),
    );
    await correrDespues();
    expect(llamadasTarjeta()[0].args).toMatchObject({
      p_utm_source: "facebook",
      p_utm_campaign: "lanzamiento",
      p_utm_term: null,
      p_utm_medium: "x".repeat(120),
    });
  });

  it("un origen inventado cae a 'portal', igual que en la ficha", async () => {
    await registerClientAction({}, form({ origen: "cualquier-cosa" }));
    await correrDespues();
    expect(llamadasTarjeta()[0].args.p_origen).toBe("portal");
  });

  it("a la tarjeta no le llegan nombre, correo, documento ni teléfono", async () => {
    await registerClientAction({}, form());
    await correrDespues();
    const enviado = JSON.stringify(llamadasTarjeta()[0].args);
    for (const dato of [NOMBRE, CORREO, DOCUMENTO, WHATSAPP, "5550101"]) expect(enviado).not.toContain(dato);
  });

  it("⭐ no demora: la action responde aunque la tarjeta no termine nunca", async () => {
    estado.rpcTarjeta = () => new Promise(() => {});
    const res = await conPlazo(registerClientAction({}, form()));
    expect(res).toMatchObject({ ok: true, markbox: "DTD-0001" });
    expect(res.warning).toBeUndefined();
  });

  it.each([
    ["la base responde un error", async () => ({ data: null, error: { code: "PGRST202" } })],
    [
      "la llamada se rechaza",
      async () => {
        throw new Error("sin red");
      },
    ],
    [
      "la llamada lanza de inmediato",
      () => {
        throw new TypeError("rpc roto");
      },
    ],
  ])("⭐ no rompe: %s, y el alta no cambia en nada", async (_caso, falla) => {
    estado.rpcTarjeta = falla as () => Promise<{ data: unknown; error: unknown }>;
    const res = await registerClientAction({}, form());
    expect(res).toEqual({ ok: true, markbox: "DTD-0001", warning: undefined });
    // Y el callback tampoco deja una promesa rechazada suelta.
    await expect(correrDespues()).resolves.toBeUndefined();
  });

  it("⭐ sin request scope: si after() lanza, el alta sigue", async () => {
    estado.afterLanza = true;
    const res = await registerClientAction({}, form());
    expect(res).toEqual({ ok: true, markbox: "DTD-0001", warning: undefined });
    expect(llamadasTarjeta()).toEqual([]);
  });

  it("el log de un fallo lleva el código, nunca los datos del alta", async () => {
    estado.rpcTarjeta = async () => ({ data: null, error: { code: "XX000", message: `fila de ${CORREO}` } });
    await registerClientAction({}, form());
    await correrDespues();
    const texto = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(texto).toContain("XX000");
    for (const dato of [NOMBRE, CORREO, DOCUMENTO]) expect(texto).not.toContain(dato);
  });

  it("la tarjeta se crea también si el login no se pudo activar: la ficha ya existe", async () => {
    estado.createUser = async () => ({ data: null, error: { message: "fallo sintetico" } });
    const res = await registerClientAction({}, form());
    expect(res.markbox).toBe("DTD-0001");
    expect(res.warning).toBeTruthy();
    await correrDespues();
    expect(llamadasTarjeta()).toHaveLength(1);
  });

  it("un duplicado no crea tarjeta: no hay ficha nueva", async () => {
    estado.duplicado = true;
    const res = await registerClientAction({}, form());
    expect(res.fieldErrors).toBeTruthy();
    await correrDespues();
    expect(llamadasTarjeta()).toEqual([]);
  });
});

describe("registerClientAction · interruptor de D7 (SDD-0587)", () => {
  async function empujados(valor?: string): Promise<string[]> {
    if (valor !== undefined) vi.stubEnv("CRM_ALTA_WEB_SIN_KOMMO", valor);
    await registerClientAction({}, form());
    await correrDespues();
    return estado.invocaciones;
  }

  it("⭐ apagado por defecto: sigue empujando a Kommo, como hoy", async () => {
    expect(await empujados()).toEqual(["kommo-push-client"]);
  });

  it.each(["", "   ", "0", "false", "true", "si", "01", "1 2"])("%j no lo enciende: sigue empujando", async (valor) => {
    expect(await empujados(valor)).toEqual(["kommo-push-client"]);
  });

  it("solo «1» deja de empujar, y la tarjeta se crea igual", async () => {
    expect(await empujados("1")).toEqual([]);
    expect(llamadasTarjeta()).toHaveLength(1);
  });

  it("con el interruptor apagado, un fallo de la tarjeta no impide el push", async () => {
    estado.rpcTarjeta = async () => {
      throw new Error("sin red");
    };
    expect(await empujados()).toEqual(["kommo-push-client"]);
  });
});

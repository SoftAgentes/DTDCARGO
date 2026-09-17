/**
 * Tests del canal del alta — `clients.registration_channel` (SDD-0474).
 *
 * Antes el self-registro escribía `'portal'` fijo, así que no había forma de
 * saber si alguien llegó por la Academia, por la guía de Alibaba o por la web
 * a secas. Ahora el origen viaja en el form.
 *
 * Lo que protege: la columna NO tiene CHECK (migr 0092), así que la única
 * defensa contra escribir basura arbitraria en el ERP desde un querystring
 * público es la normalización — y tiene que correr **en la action**, no sólo
 * en la page: el formData llega del navegador y se puede fabricar a mano.
 *
 * Molde y mocks: mismos que `register-active-welcome.test.ts` (sin red ni DB).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ops = {
  clientInsert: null as Record<string, unknown> | null,
};

function makeAdmin() {
  function resolveFor(table: string, op: string): { data?: unknown; error?: unknown; count?: number } {
    if (table === "portal_registro_throttle" && op === "select") return { count: 0, error: null };
    if (table === "tenants" && op === "select") return { data: { id: "tenant-1" }, error: null };
    if (table === "clients" && op === "select") return { data: null, error: null };
    if (table === "clients" && op === "insert") return { data: { id: "client-1" }, error: null };
    return { data: null, error: null };
  }

  function builder(table: string) {
    const state = { table, op: "select" };
    let opSet = false;
    const setOp = (o: string) => {
      if (!opSet) {
        state.op = o;
        opSet = true;
      }
    };
    const resolve = () => Promise.resolve(resolveFor(state.table, state.op));
    const chain: Record<string, unknown> = {
      select: () => {
        setOp("select");
        return chain;
      },
      insert: (p: unknown) => {
        setOp("insert");
        if (table === "clients") ops.clientInsert = p as Record<string, unknown>;
        return chain;
      },
      eq: () => chain,
      is: () => chain,
      ilike: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        resolve().then(res, rej),
    };
    return chain;
  }

  return {
    from: (table: string) => builder(table),
    rpc: async () => ({ data: "DTD-0001", error: null }),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
      }),
    },
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: "auth-1" } }, error: null }),
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

function baseForm(overrides: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("kind", "persona");
  f.set("name", "Carlos Pérez");
  f.set("document", "V-12345678");
  f.set("email", "carlos@empresa.com");
  f.set("whatsapp", "+58 412 1668021");
  f.set("state", "Carabobo");
  f.set("municipio", "Valencia");
  f.set("city", "Valencia");
  f.set("postal_code", "2001");
  f.set("barrio", "El Viñedo");
  f.set("address", "Av. Bolívar, edif. Tía Mary, piso 3");
  for (const [k, v] of Object.entries(overrides)) f.set(k, v);
  f.set("cedula_photo", new File([new Uint8Array([1, 2, 3])], "doc.jpg", { type: "image/jpeg" }));
  return f;
}

async function canalDe(origen?: string): Promise<unknown> {
  const res = await registerClientAction(
    {},
    origen === undefined ? baseForm() : baseForm({ origen }),
  );
  expect(res.ok).toBe(true);
  return ops.clientInsert?.registration_channel;
}

beforeEach(() => {
  ops.clientInsert = null;
});

describe("registerClientAction · canal del alta (SDD-0474)", () => {
  it("guarda el origen declarado: la guía de Alibaba", async () => {
    expect(await canalDe("guia-alibaba")).toBe("guia-alibaba");
  });

  it("guarda el origen declarado: la Academia", async () => {
    expect(await canalDe("academia")).toBe("academia");
  });

  it("sin origen sigue siendo 'portal' — cero regresión con SDD-0046", async () => {
    expect(await canalDe()).toBe("portal");
    expect(await canalDe("")).toBe("portal");
  });

  it("⭐ un origen inventado NO llega al ERP: cae a 'portal'", async () => {
    // La columna no tiene CHECK. Si la action confiara en el formData, un POST
    // fabricado a mano escribiría cualquier cosa en clients.registration_channel.
    expect(await canalDe("cualquier-cosa")).toBe("portal");
    expect(await canalDe("'; drop table clients; --")).toBe("portal");
    expect(await canalDe("x".repeat(500))).toBe("portal");
  });

  it("⭐ no se puede declarar 'admin' desde la web", async () => {
    // 'admin' es el canal del alta hecha por el equipo en el Studio (SDD-0046).
    // Si se pudiera declarar desde el formulario público, un alta self-service
    // se disfrazaría de alta interna y el reporte por canal mentiría.
    expect(await canalDe("admin")).toBe("portal");
  });

  it("tolera la forma: mayúsculas, espacios y guion bajo", async () => {
    expect(await canalDe(" GUIA_ALIBABA ")).toBe("guia-alibaba");
  });

  it("el canal no arrastra nada más del alta (sigue activa y con su mark)", async () => {
    const res = await registerClientAction({}, baseForm({ origen: "guia-alibaba" }));
    expect(res.markbox).toBe("DTD-0001");
    expect(ops.clientInsert?.portal_approved_at).toBeTruthy();
  });
});

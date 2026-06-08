/**
 * Tests del comportamiento "cuenta activa al registrar" (#1) + "saludo del welcome
 * por razón social cuando es empresa" (#2) — founder 2026-06-07 sobre SDD-0059.
 *
 *  #1: el insert de `clients` lleva `portal_approved_at` != null → la cuenta nace
 *      ACTIVA (sin pantalla de espera). El gate `getPortalActivation` la ve aprobada.
 *  #2: `sendWelcomeEmail` recibe `name` = razón social (empresa) / nombre (persona),
 *      = el mismo nombre con el que queda el cliente en el sistema.
 *
 * El admin client captura el payload del insert de `clients`; el welcome se mockea
 * para capturar sus args. Sin red ni DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ops = {
  clientInsert: null as Record<string, unknown> | null,
  welcomeArgs: null as { markbox: string; name: string; email: string } | null,
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
vi.mock("@/lib/studio/welcome-email", () => ({
  sendWelcomeEmail: async (
    _admin: unknown,
    _tenant: unknown,
    client: { markbox: string; name: string; email: string },
  ) => {
    ops.welcomeArgs = client;
    return { ok: true };
  },
}));
vi.mock("@/lib/studio/new-client-notify", () => ({
  notifyNewClientToAdmin: async () => {},
}));

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

beforeEach(() => {
  ops.clientInsert = null;
  ops.welcomeArgs = null;
});

describe("registerClientAction · cuenta activa + saludo del welcome (SDD-0059, founder 2026-06-07)", () => {
  it("persona: cuenta ACTIVA al registrar (portal_approved_at set) + welcome saluda con el nombre", async () => {
    const res = await registerClientAction({}, baseForm());

    expect(res.ok).toBe(true);
    expect(res.markbox).toBe("DTD-0001");
    // #1: la cuenta nace activa.
    expect(ops.clientInsert?.portal_approved_at).toBeTruthy();
    // #2: persona → saluda con el nombre de la persona.
    expect(ops.welcomeArgs?.name).toBe("Carlos Pérez");
  });

  it("empresa: welcome saluda con la razón social (no con el contacto) + cuenta activa", async () => {
    const res = await registerClientAction(
      {},
      baseForm({
        kind: "empresa",
        company: "Importadora X, C.A.",
        name: "Carlos Pérez", // contacto
        document: "J-12345678-9",
      }),
    );

    expect(res.ok).toBe(true);
    expect(ops.clientInsert?.portal_approved_at).toBeTruthy();
    // #2: empresa → saluda con la razón social.
    expect(ops.welcomeArgs?.name).toBe("Importadora X, C.A.");
  });
});

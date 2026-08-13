/**
 * Alta de cliente BAJO un aliado (SDD-0255).
 *
 * Lo que defiende, que es exactamente lo que puede romperse en silencio:
 *   1. ⭐ con aliado se llama a `next_markbox_aliado` y **nunca** a `next_markbox`
 *      — si se colara el de la casa, el cliente del aliado saldría con DTD- y no
 *      hay forma de arreglarlo después: renumerar es imposible (33 columnas
 *      guardan el markbox como texto, sin una sola FK);
 *   2. sin aliado NO se llama al de aliado — el camino de los 73 clientes
 *      directos queda intacto;
 *   3. un aliado suspendido o cerrado no da de alta, y ni siquiera se pide código;
 *   4. si el código emitido no corresponde al aliado elegido, se rechaza;
 *   5. la colisión de correlativo deja de mentir: antes se reportaba como
 *      "ya existe ese RIF/cédula" y mandaba al usuario a buscar una ficha que no
 *      existe.
 *
 * Supabase se mockea — sin red ni DB real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/welcome-email", () => ({ sendWelcomeEmail: async () => ({ ok: true }) }));

/** Fila que devuelve `aliados` (null = no existe). */
let aliadoRow: { prefix: string; status: string } | null = null;
/** Error que devuelve el insert de `clients`. */
let clientsWriteError: { code?: string; message: string } | null = null;
/** Lo que devuelve `next_markbox_aliado` (para probar el chequeo defensivo). */
let markboxAliado = "HR-0001";
/** Nombres de RPC llamados, en orden. */
let rpcCalls: string[] = [];

function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from(table: string) {
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        is() {
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle: async () => {
          if (table === "user_tenants") {
            return { data: { tenant_id: "tenant-1", role: "admin" }, error: null };
          }
          if (table === "aliados") return { data: aliadoRow, error: null };
          return { data: null, error: null };
        },
        insert() {
          const err = table === "clients" ? clientsWriteError : null;
          return {
            select() {
              return {
                single: async () =>
                  err ? { data: null, error: err } : { data: { id: "client-1" }, error: null },
              };
            },
          };
        },
      };
      return chain;
    },
    rpc: async (name: string) => {
      rpcCalls.push(name);
      if (name === "next_markbox") return { data: "DTD-9059", error: null };
      if (name === "next_markbox_aliado") return { data: markboxAliado, error: null };
      return { data: null, error: null };
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => makeSupabase() }));

import { createClientAction } from "../actions";

function clientForm(overrides: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("doc_kind", "empresa");
  f.set("name", "Acme C.A.");
  f.set("tier", "regular");
  f.set("rif", "J-31000000-1");
  for (const [k, v] of Object.entries(overrides)) f.set(k, v);
  return f;
}

beforeEach(() => {
  aliadoRow = { prefix: "HR", status: "activo" };
  clientsWriteError = null;
  markboxAliado = "HR-0001";
  rpcCalls = [];
});

describe("createClientAction · alta bajo un aliado", () => {
  it("⭐ con aliado usa next_markbox_aliado y NUNCA next_markbox", async () => {
    const res = await createClientAction({}, clientForm({ aliadoId: "aliado-hr" }));

    expect(res.error).toBeUndefined();
    expect(res.createdMarkbox).toBe("HR-0001");
    expect(rpcCalls).toContain("next_markbox_aliado");
    expect(rpcCalls).not.toContain("next_markbox");
  });

  it("⭐ sin aliado usa next_markbox y NUNCA el de aliado", async () => {
    const res = await createClientAction({}, clientForm());

    expect(res.error).toBeUndefined();
    expect(res.createdMarkbox).toBe("DTD-9059");
    expect(rpcCalls).toContain("next_markbox");
    expect(rpcCalls).not.toContain("next_markbox_aliado");
  });

  it("un aliadoId vacío se trata como cliente directo, no como error", async () => {
    const res = await createClientAction({}, clientForm({ aliadoId: "" }));

    expect(res.createdMarkbox).toBe("DTD-9059");
    expect(rpcCalls).not.toContain("next_markbox_aliado");
  });

  it("soporta la cadena de un sub-aliado", async () => {
    aliadoRow = { prefix: "FA", status: "activo" };
    markboxAliado = "DC-FA-0001";

    const res = await createClientAction({}, clientForm({ aliadoId: "aliado-fa" }));

    expect(res.error).toBeUndefined();
    expect(res.createdMarkbox).toBe("DC-FA-0001");
  });

  it("aliado inexistente → rechaza y no pide ningún código", async () => {
    aliadoRow = null;

    const res = await createClientAction({}, clientForm({ aliadoId: "fantasma" }));

    expect(res.error).toMatch(/no existe o no está disponible/i);
    expect(rpcCalls).toHaveLength(0);
  });

  it("aliado suspendido → rechaza y no pide ningún código", async () => {
    aliadoRow = { prefix: "HR", status: "suspendido" };

    const res = await createClientAction({}, clientForm({ aliadoId: "aliado-hr" }));

    expect(res.error).toMatch(/no está activo/i);
    expect(rpcCalls).toHaveLength(0);
  });

  it("el código emitido no corresponde al aliado elegido → rechaza", async () => {
    // El RPC devuelve un código de OTRO aliado. No debería pasar nunca, pero si
    // pasa, crear la ficha la ataría al aliado equivocado de forma irreversible.
    markboxAliado = "DC-0007";

    const res = await createClientAction({}, clientForm({ aliadoId: "aliado-hr" }));

    expect(res.error).toMatch(/Shipping Mark inválido generado/);
  });

  it("un código con forma de basura también se rechaza", async () => {
    markboxAliado = "bncvcc";

    const res = await createClientAction({}, clientForm({ aliadoId: "aliado-hr" }));

    expect(res.error).toMatch(/Shipping Mark inválido generado/);
  });
});

describe("createClientAction · el 23505 deja de mentir", () => {
  it("⭐ colisión de correlativo NO se reporta como documento duplicado", async () => {
    clientsWriteError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "clients_tenant_id_markbox_key"',
    };

    const res = await createClientAction({}, clientForm({ aliadoId: "aliado-hr" }));

    expect(res.error).toMatch(/mismo Shipping Mark al mismo tiempo/i);
    expect(res.error).not.toMatch(/RIF|cédula/i);
  });

  it("el unique de documento sigue dando su mensaje de siempre", async () => {
    clientsWriteError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "clients_tenant_doc_unique"',
    };

    const res = await createClientAction({}, clientForm());

    expect(res.error).toBe("Ya existe un cliente con ese RIF/cédula en este tenant.");
  });

  it("el guard de coherencia de la migr 0362 llega con su propio texto", async () => {
    clientsWriteError = {
      code: "23514",
      message: "El Shipping Mark DTD-7777 usa la insignia de un aliado pero el cliente no tiene aliado asignado",
    };

    const res = await createClientAction({}, clientForm());

    expect(res.error).toMatch(/usa la insignia de un aliado/);
    expect(res.error).not.toMatch(/^No se pudo crear el cliente:/);
  });
});

/**
 * Tests del guard de unicidad de documento en las server actions del Studio.
 *
 * El índice DB clients_tenant_doc_unique (migración 0095, documento NORMALIZADO
 * por tenant) hace que dos clientes con el mismo RIF/cédula (en cualquier formato)
 * colisionen. Cuando el insert/update lo viola, Postgres devuelve unique_violation
 * (error.code === "23505"). Las actions deben traducirlo a un mensaje amable en
 * vez del error crudo:
 *   - createClientAction → "Ya existe un cliente con ese RIF/cédula en este tenant."
 *   - updateClientAction → "Ya existe otro cliente con ese RIF/cédula."
 *
 * Supabase + el admin client (welcome email) se mockean — sin red ni DB real.
 * El fake supabase fuerza el insert/update de `clients` a fallar con 23505.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (antes de importar el SUT) ────────────────────────────────────────
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/welcome-email", () => ({ sendWelcomeEmail: async () => ({ ok: true }) }));

// El error que devuelve el insert/update de `clients` (configurable por test).
let clientsWriteError: { code?: string; message: string } | null = null;

function makeSupabase() {
  return {
    from(table: string) {
      // Builder chainable. insert(...) y update(...).eq(...) son thenables que
      // resuelven con el error configurado para `clients`.
      const writeResult = () =>
        table === "clients"
          ? { error: clientsWriteError }
          : { error: null };

      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        // getStudioRole (moduleEditDenial):
        // .select("role").is("disabled_at", null).limit(1).maybeSingle()
        is() {
          return chain;
        },
        limit() {
          return chain;
        },
        // user_tenants.select(...).maybeSingle() → tenant + role (default admin
        // para que el guard moduleEditDenial no bloquee estos tests).
        maybeSingle: async () =>
          table === "user_tenants"
            ? { data: { tenant_id: "tenant-1", role: "admin" }, error: null }
            : { data: null, error: null },
        insert() {
          // create: `await supabase.from("clients").insert({...})`
          return {
            then: (res: (v: { error: unknown }) => unknown) => res(writeResult()),
          };
        },
        update() {
          // update: `await supabase.from("clients").update({...}).eq(...)`
          const upd = {
            eq() {
              return upd;
            },
            then: (res: (v: { error: unknown }) => unknown) => res(writeResult()),
          };
          return upd;
        },
      };
      return chain;
    },
    rpc: async (name: string) =>
      name === "next_markbox"
        ? { data: "DTD-1001", error: null }
        : { data: null, error: null },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => makeSupabase() }));

import { createClientAction, updateClientAction } from "../actions";

function clientForm(overrides: Record<string, string> = {}): FormData {
  const f = new FormData();
  // Empresa con RIF: doc_kind rutea la validación del documento (SDD-0131).
  f.set("doc_kind", "empresa");
  f.set("name", "Acme C.A.");
  f.set("tier", "regular");
  f.set("rif", "J-31000000-1");
  for (const [k, v] of Object.entries(overrides)) f.set(k, v);
  return f;
}

beforeEach(() => {
  clientsWriteError = null;
});

describe("createClientAction · unicidad de documento (23505)", () => {
  it("insert viola el unique → mensaje amable (no el error crudo)", async () => {
    clientsWriteError = { code: "23505", message: "duplicate key value violates unique constraint" };

    const res = await createClientAction({}, clientForm());

    expect(res.error).toBe("Ya existe un cliente con ese RIF/cédula en este tenant.");
    expect(res.error).not.toMatch(/duplicate key|23505|No se pudo crear/i);
    expect(res.ok).toBeUndefined();
    expect(res.createdMarkbox).toBeUndefined();
  });

  it("otro error de insert (no 23505) → sigue mostrando el mensaje genérico", async () => {
    clientsWriteError = { code: "23503", message: "fk violation" };

    const res = await createClientAction({}, clientForm());

    expect(res.error).toMatch(/^No se pudo crear el cliente:/);
  });
});

describe("updateClientAction · unicidad de documento (23505)", () => {
  it("update a un rif duplicado viola el unique → mensaje amable", async () => {
    clientsWriteError = { code: "23505", message: "duplicate key value violates unique constraint" };

    const res = await updateClientAction("DTD-1001", {}, clientForm());

    expect(res.error).toBe("Ya existe otro cliente con ese RIF/cédula.");
    expect(res.error).not.toMatch(/duplicate key|23505|No se pudo guardar/i);
    expect(res.ok).toBeUndefined();
  });

  it("otro error de update (no 23505) → sigue mostrando el mensaje genérico", async () => {
    clientsWriteError = { code: "23502", message: "not null violation" };

    const res = await updateClientAction("DTD-1001", {}, clientForm());

    expect(res.error).toMatch(/^No se pudo guardar el cliente:/);
  });
});

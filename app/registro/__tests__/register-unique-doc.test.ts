/**
 * Test del backstop de unicidad de documento en registerClientAction.
 *
 * El índice DB clients_tenant_doc_unique (migración 0095, documento NORMALIZADO
 * por tenant) atrapa duplicados de FORMATO (V-12.345.678 vs V12345678) y races
 * que el dedup `ilike` exact deja pasar. Cuando el insert de `clients` los viola,
 * Postgres devuelve unique_violation (error.code === "23505"). La action debe:
 *   - devolver el fieldError amable en `document` (mismo copy que el dedup),
 *   - hacer rollback de la foto huérfana (storage.remove),
 *   - NO crear la cuenta de auth (createUser).
 *
 * El admin client, next/headers y el welcome email se mockean — sin red ni DB.
 * El fake admin fuerza el insert de `clients` a fallar con 23505 y registra
 * storage.remove + auth.admin.createUser para poder afirmar el rollback/no-auth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Recorder de side-effects del fake admin client ──────────────────────────
const ops = {
  removed: [] as string[], // paths pasados a storage.remove (rollback de la foto)
  createUserCalls: 0,
  insertedClients: false,
  reset() {
    this.removed = [];
    this.createUserCalls = 0;
    this.insertedClients = false;
  },
};

const THROTTLE = "portal_registro_throttle";

function makeAdmin() {
  function resolveFor(table: string, op: string): { data?: unknown; error?: unknown; count?: number } {
    if (table === THROTTLE && op === "select") return { count: 0, error: null };
    if (table === "tenants" && op === "select") return { data: { id: "tenant-1" }, error: null };
    if (table === "clients" && op === "select") return { data: null, error: null }; // dedup → sin dup
    if (table === "clients" && op === "insert") {
      // El índice clients_tenant_doc_unique rechaza el insert: unique_violation.
      ops.insertedClients = true;
      return { data: null, error: { code: "23505", message: "duplicate key value" } };
    }
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
        void p;
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
        remove: async (paths: string[]) => {
          ops.removed.push(...paths);
          return { error: null };
        },
      }),
    },
    auth: {
      admin: {
        createUser: async () => {
          ops.createUserCalls += 1;
          return { data: { user: { id: "auth-1" } }, error: null };
        },
      },
    },
  };
}

// ── Mocks (antes de importar el SUT) ────────────────────────────────────────
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => (k === "x-forwarded-for" ? "1.2.3.4" : null) }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => makeAdmin() }));
vi.mock("@/lib/studio/welcome-email", () => ({ sendWelcomeEmail: async () => ({ ok: true }) }));

import { registerClientAction } from "../actions";

function validForm(overrides: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("kind", "persona");
  f.set("name", "Carlos Pérez");
  // Documento bien formado a nivel input (la validación previa lo exige). El
  // duplicado lo decide el índice DB (normalizado) → el insert tira 23505.
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
  f.set("cedula_photo", new File([new Uint8Array([1, 2, 3])], "cedula.jpg", { type: "image/jpeg" }));
  return f;
}

beforeEach(() => ops.reset());

describe("registerClientAction · unicidad de documento (índice DB · 23505)", () => {
  it("insert clients viola el unique (23505) → fieldError amable + rollback de la foto + NO crea auth", async () => {
    const res = await registerClientAction({}, validForm());

    // Llegó a intentar el insert (el dedup ilike previo no lo atrapó: race /
    // variante de formato) y fue el índice DB quien lo rechazó con 23505.
    expect(ops.insertedClients).toBe(true);

    // fieldError amable en `document` (no el error crudo de Postgres).
    expect(res.fieldErrors?.document).toBeTruthy();
    expect(res.fieldErrors?.document).toMatch(/ya tiene una cuenta/i);
    expect(res.fieldErrors?.document).not.toMatch(/duplicate key|23505/i);

    // No quedó marcado como alta exitosa.
    expect(res.ok).toBeUndefined();
    expect(res.markbox).toBeUndefined();
    expect(res.error).toBeUndefined();

    // Rollback de la foto huérfana.
    expect(ops.removed.length).toBeGreaterThan(0);

    // No se creó la cuenta de auth.
    expect(ops.createUserCalls).toBe(0);
  });
});

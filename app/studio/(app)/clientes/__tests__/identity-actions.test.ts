/**
 * Tests del cotejo manual de identidad (SDD-0331).
 *
 * La única acción operativa persiste el veredicto humano con scope de tenant.
 * Supabase está mockeado: no hay red ni DB real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks de dependencias (deben declararse antes de importar el SUT) ──────────
const revalidatePathMock = vi.fn<(p: string) => void>();

vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => revalidatePathMock(p),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({}),
}));

// Builder supabase falso que captura los UPDATE y devuelve filas configurables.
type FakeOpts = {
  userId?: string | null;
  tenantId?: string | null;
  role?: string | null;
  updateError?: { message: string } | null;
};

let lastUpdate: {
  table: string;
  payload: Record<string, unknown>;
  filters: Array<[string, unknown]>;
} | null = null;

function makeSupabase(opts: FakeOpts) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.userId === null ? null : { id: opts.userId ?? "u-1" } },
      }),
    },
    from(table: string) {
      return {
        // SELECT chain
        select() {
          // user_tenants se consulta dos veces: para tenant_id (la action) y para
          // role (moduleEditDenial → getStudioRole, con
          // .select("role").is("disabled_at", null).limit(1)).
          // Devolvemos ambos campos; default role = admin (puede editar) para que
          // el guard no bloquee los casos felices. Casos sin tenant → null → denial.
          const userTenantsRow =
            opts.tenantId === null
              ? null
              : { tenant_id: opts.tenantId ?? "t-1", role: opts.role ?? "admin" };
          const sel = {
            // getStudioRole: .is("disabled_at", null) → chainable
            is: () => sel,
            // getStudioRole: .limit(1).maybeSingle()
            limit: () => ({ maybeSingle: async () => ({ data: userTenantsRow }) }),
            // user_tenants.maybeSingle → tenant_id (la action)
            maybeSingle: async () => {
              if (table === "user_tenants") return { data: userTenantsRow };
              return { data: null };
            },
            eq() {
              // user_tenants: getStudioAccess (SDD-0251) encadena
              // .eq("user_id", …).is("disabled_at", null).limit(1) → sigue
              // siendo chainable.
              if (table === "user_tenants") return sel;
              return sel;
            },
          };
          return sel;
        },
        // UPDATE chain: .update(payload).eq(...).eq(...)
        update(payload: Record<string, unknown>) {
          const filters: Array<[string, unknown]> = [];
          const chain = {
            eq(col: string, val: unknown) {
              filters.push([col, val]);
              lastUpdate = { table, payload, filters };
              return chain;
            },
            then(resolve: (v: { error: unknown }) => void) {
              // El await del UPDATE resuelve acá.
              resolve({ error: opts.updateError ?? null });
            },
          };
          return chain;
        },
      };
    },
  };
}

let createClientMock: () => ReturnType<typeof makeSupabase>;
vi.mock("@/lib/db/server", () => ({
  createClient: () => createClientMock(),
}));

// Import del SUT después de los mocks.
import { markIdentityAction } from "../actions";

beforeEach(() => {
  vi.clearAllMocks();
  lastUpdate = null;
});

describe("markIdentityAction", () => {
  it("marca manual ok → source='manual', registry null", async () => {
    createClientMock = vi.fn(() =>
      makeSupabase({ userId: "user-5", tenantId: "tenant-5" }),
    );

    const res = await markIdentityAction("c-1", "DTD-0001", "ok");

    expect(res.ok).toBe(true);
    expect(lastUpdate?.table).toBe("clients");
    expect(lastUpdate?.payload).toMatchObject({
      doc_verify_status: "ok",
      doc_verify_source: "manual",
      doc_registry_name: null,
      doc_verified_by: "user-5",
    });
    expect(lastUpdate?.filters).toEqual(
      expect.arrayContaining([
        ["id", "c-1"],
        ["tenant_id", "tenant-5"],
      ]),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/clientes/DTD-0001");
  });

  it("marca manual mismatch → source='manual'", async () => {
    createClientMock = vi.fn(() =>
      makeSupabase({ userId: "u-1", tenantId: "t-1" }),
    );

    const res = await markIdentityAction("c-1", "DTD-0001", "mismatch");
    expect(res.ok).toBe(true);
    expect(lastUpdate?.payload.doc_verify_status).toBe("mismatch");
    expect(lastUpdate?.payload.doc_verify_source).toBe("manual");
  });

  it("veredicto inválido → error sin tocar DB", async () => {
    createClientMock = vi.fn(() =>
      makeSupabase({ userId: "u-1", tenantId: "t-1" }),
    );

    // @ts-expect-error verdict inválido a propósito
    const res = await markIdentityAction("c-1", "DTD-0001", "garbage");
    expect(res.error).toBeTruthy();
    expect(lastUpdate).toBeNull();
  });
});

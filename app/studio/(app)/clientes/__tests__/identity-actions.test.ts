/**
 * Tests de las server actions de verificación de identidad (SDD-0046 · Slice B).
 *
 * Cubre §6 Slice B (acceptance):
 *   - verifyIdentityAction: persiste doc_verify_* + filtro tenant_id + dispara la
 *     alerta SOLO en mismatch (stub supabase + mail/notify).
 *   - markIdentityAction: setea source='manual' con el verdict del asesor.
 *
 * Supabase, el motor (verifyIdentity), el admin client y la alerta están mockeados
 * — sin red ni DB real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VerifyResult } from "@/lib/studio/identity";

// ── Mocks de dependencias (deben declararse antes de importar el SUT) ──────────
const verifyIdentityMock = vi.fn<() => Promise<VerifyResult>>();
const notifyMismatchMock = vi.fn<(...args: unknown[]) => Promise<void>>(
  async () => {},
);
const revalidatePathMock = vi.fn<(p: string) => void>();
const adminClientSentinel = { __admin: true };

vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => revalidatePathMock(p),
}));
vi.mock("@/lib/studio/identity", () => ({
  verifyIdentity: () => verifyIdentityMock(),
}));
vi.mock("@/lib/studio/identity/notify-mismatch", () => ({
  notifyIdentityMismatch: (...args: unknown[]) => notifyMismatchMock(...args),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => adminClientSentinel,
}));

// Builder supabase falso que captura los UPDATE y devuelve filas configurables.
type FakeOpts = {
  userId?: string | null;
  tenantId?: string | null;
  role?: string | null;
  client?: Record<string, unknown> | null;
  readError?: { message: string } | null;
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
              // clients select(...).eq(id).maybeSingle()
              return {
                maybeSingle: async () => ({
                  data: opts.client ?? null,
                  error: opts.readError ?? null,
                }),
              };
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
import {
  verifyIdentityAction,
  markIdentityAction,
} from "../actions";

beforeEach(() => {
  vi.clearAllMocks();
  lastUpdate = null;
});

describe("verifyIdentityAction", () => {
  it("persiste doc_verify_* con filtro tenant + uid y NO alerta en ok", async () => {
    createClientMock = vi.fn(() =>
      makeSupabase({
        userId: "user-99",
        tenantId: "tenant-7",
        client: { id: "c-1", name: "Maria Acosta", rif: "V12345678", doc_kind: "persona" },
      }),
    );
    verifyIdentityMock.mockResolvedValue({
      status: "ok",
      source: "cne",
      registryName: "MARIA ACOSTA",
      score: 1,
    });

    const res = await verifyIdentityAction("c-1", "DTD-0001");

    expect(res.ok).toBe(true);
    expect(res.result?.status).toBe("ok");
    // UPDATE a clients con los campos correctos.
    expect(lastUpdate?.table).toBe("clients");
    expect(lastUpdate?.payload).toMatchObject({
      doc_verify_status: "ok",
      doc_verify_source: "cne",
      doc_registry_name: "MARIA ACOSTA",
      doc_verified_by: "user-99",
    });
    expect(lastUpdate?.payload.doc_verified_at).toBeTypeOf("string");
    // Filtro tenant defensivo presente.
    expect(lastUpdate?.filters).toEqual(
      expect.arrayContaining([
        ["id", "c-1"],
        ["tenant_id", "tenant-7"],
      ]),
    );
    // No alerta en ok.
    expect(notifyMismatchMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/clientes/DTD-0001");
  });

  it("dispara la alerta interna SOLO en mismatch", async () => {
    createClientMock = vi.fn(() =>
      makeSupabase({
        userId: "user-1",
        tenantId: "tenant-1",
        client: { id: "c-2", name: "Maria Acosta", rif: "V12345678", doc_kind: "persona" },
      }),
    );
    verifyIdentityMock.mockResolvedValue({
      status: "mismatch",
      source: "cne",
      registryName: "PEDRO GOMEZ",
    });

    const res = await verifyIdentityAction("c-2", "DTD-0002");

    expect(res.ok).toBe(true);
    expect(lastUpdate?.payload.doc_verify_status).toBe("mismatch");
    expect(notifyMismatchMock).toHaveBeenCalledOnce();
    // Va al admin client + tenant + payload con markbox y registryName.
    expect(notifyMismatchMock).toHaveBeenCalledWith(
      adminClientSentinel,
      "tenant-1",
      expect.objectContaining({
        markbox: "DTD-0002",
        clientName: "Maria Acosta",
        registryName: "PEDRO GOMEZ",
        source: "cne",
      }),
    );
  });

  it("no alerta cuando el resultado es unavailable", async () => {
    createClientMock = vi.fn(() =>
      makeSupabase({
        userId: "user-1",
        tenantId: "tenant-1",
        client: { id: "c-3", name: "Acme", rif: "J-31000000-1", doc_kind: "empresa" },
      }),
    );
    verifyIdentityMock.mockResolvedValue({ status: "unavailable", source: "seniat" });

    const res = await verifyIdentityAction("c-3", "DTD-0003");

    expect(res.ok).toBe(true);
    expect(lastUpdate?.payload.doc_verify_status).toBe("unavailable");
    expect(notifyMismatchMock).not.toHaveBeenCalled();
  });

  it("sin sesión → error, no toca DB", async () => {
    createClientMock = vi.fn(() => makeSupabase({ userId: null }));

    const res = await verifyIdentityAction("c-1", "DTD-0001");

    expect(res.error).toBeTruthy();
    expect(lastUpdate).toBeNull();
    expect(verifyIdentityMock).not.toHaveBeenCalled();
  });

  it("tenant no resuelto → error", async () => {
    createClientMock = vi.fn(() =>
      makeSupabase({ userId: "u-1", tenantId: null }),
    );

    const res = await verifyIdentityAction("c-1", "DTD-0001");
    expect(res.error).toBeTruthy();
    expect(lastUpdate).toBeNull();
  });

  it("cliente no encontrado → error", async () => {
    createClientMock = vi.fn(() =>
      makeSupabase({ userId: "u-1", tenantId: "t-1", client: null }),
    );

    const res = await verifyIdentityAction("c-x", "DTD-0009");
    expect(res.error).toBe("Cliente no encontrado.");
    expect(verifyIdentityMock).not.toHaveBeenCalled();
  });
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

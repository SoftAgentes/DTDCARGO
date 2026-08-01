import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests de authorizeConsolidation / rejectConsolidation (SDD-0157, Slice B).
 *
 * Cubre la acceptance:
 *  - authorize valida estado, motivo y request ref antes del RPC gobernado.
 *  - replay devuelve la misma referencia y conserva la notificación best-effort.
 *  - reject exige motivo y solo transiciona desde 'solicitada'.
 *  - ambos respetan moduleEditDenial('naviera').
 *
 * createClient / moduleEditDenial / createAdminClient / notify / revalidatePath
 * se mockean; la lógica de la action corre real.
 */

const mockCreateClient = vi.fn();
const mockDenial = vi.fn();
const mockRevalidate = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/lib/db/server", () => ({
  createClient: () => mockCreateClient(),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({}),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: (...a: unknown[]) => mockDenial(...a),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidate(...a),
}));
vi.mock("@/lib/studio/naviera/consolidation-request-notify", () => ({
  notifyConsolidationAuthorizedToOperario: (...a: unknown[]) => mockNotify(...a),
}));

import { authorizeConsolidation, rejectConsolidation } from "../actions";

const TENANT = "tenant-1";
const USER = "user-1";
const CONSOLIDATION_ID = "10000000-0000-4000-8000-000000000001";
const REQUEST_REF = `naviera-consolidation-authorization:${CONSOLIDATION_ID}:test-1`;

type Cfg = {
  tenant?: string | null;
  row?: Record<string, unknown> | null;
  authorizationResponse?: Record<string, unknown>;
  authorizationError?: { message: string; code: string } | null;
  updateError?: { message: string } | null;
};

function makeSupabase(cfg: Cfg) {
  const updates: { table: string; payload: Record<string, unknown> }[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: USER } } }),
    },
    rpc: async (name: string, args?: unknown) => {
      rpcCalls.push({ name, args });
      if (name === "authorize_consolidation_governed") {
        return {
          data:
            cfg.authorizationResponse ?? {
              outcome: "transitioned",
              ref: "DTD-CONSOL-0007",
              requested_by_operario_id: "op-1",
              container_type: "40HC",
            },
          error: cfg.authorizationError ?? null,
        };
      }
      return { data: null, error: null };
    },
    from(table: string) {
      const builder: Record<string, unknown> = { _payload: null as unknown };
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.is = () => builder;
      builder.update = (payload: Record<string, unknown>) => {
        builder._payload = payload;
        return builder;
      };
      builder.maybeSingle = async () => {
        if (table === "user_tenants") {
          const t = cfg.tenant === undefined ? TENANT : cfg.tenant;
          return { data: t ? { tenant_id: t } : null, error: null };
        }
        if (table === "consolidations") {
          return { data: cfg.row === undefined ? defaultRow() : cfg.row, error: null };
        }
        return { data: null, error: null };
      };
      builder.then = (resolve: (v: { error: unknown }) => unknown) => {
        if (builder._payload != null) {
          updates.push({ table, payload: builder._payload as Record<string, unknown> });
        }
        return Promise.resolve({ error: cfg.updateError ?? null }).then(resolve);
      };
      return builder;
    },
  };

  return { supabase, updates, rpcCalls };
}

function defaultRow() {
  return {
    id: "cons-1",
    status: "solicitada",
    tenant_id: TENANT,
    container_type: "40HC",
    requested_by_operario_id: "op-1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDenial.mockResolvedValue(null);
});

describe("authorizeConsolidation", () => {
  it("envía la decisión validada al RPC gobernado", async () => {
    const { supabase, rpcCalls } = makeSupabase({});
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation({
      consolidationId: CONSOLIDATION_ID,
      from: "solicitada",
      reason: "  capacidad verificada  ",
      requestRef: REQUEST_REF,
    });
    expect(res.ok).toBe(true);
    expect(res.ref).toBe("DTD-CONSOL-0007");
    expect(rpcCalls).toContainEqual({
      name: "authorize_consolidation_governed",
      args: {
        p_consolidation_id: CONSOLIDATION_ID,
        p_reason: "capacidad verificada",
        p_request_ref: REQUEST_REF,
      },
    });
    expect(mockNotify).toHaveBeenCalledOnce();
    expect(mockRevalidate).toHaveBeenCalled();
  });

  it("reconoce replay y devuelve la misma referencia", async () => {
    const { supabase } = makeSupabase({
      authorizationResponse: {
        outcome: "replayed",
        ref: "DTD-CONSOL-0007",
        requested_by_operario_id: "op-1",
        container_type: "40HC",
      },
    });
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation({
      consolidationId: CONSOLIDATION_ID,
      from: "solicitada",
      reason: "capacidad verificada",
      requestRef: REQUEST_REF,
    });
    expect(res).toMatchObject({ ok: true, replayed: true, ref: "DTD-CONSOL-0007" });
  });

  it("rechaza estado, motivo o referencia inválidos antes del RPC", async () => {
    const { supabase, rpcCalls } = makeSupabase({});
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation({
      consolidationId: CONSOLIDATION_ID,
      from: "consolidando",
      reason: "x",
      requestRef: "ref con espacios",
    });
    expect(res.error).toBeDefined();
    expect(rpcCalls).toHaveLength(0);
  });

  it("mapea una carrera de estado sin exponer el error de DB", async () => {
    const { supabase } = makeSupabase({
      authorizationError: { message: "raw database error", code: "40001" },
    });
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation({
      consolidationId: CONSOLIDATION_ID,
      from: "solicitada",
      reason: "capacidad verificada",
      requestRef: REQUEST_REF,
    });
    expect(res.error).toContain("cambiaron");
    expect(res.error).not.toContain("raw database error");
  });

  it("respeta moduleEditDenial", async () => {
    mockDenial.mockResolvedValueOnce("No tienes permiso para realizar esta acción.");
    const { supabase } = makeSupabase({});
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation({
      consolidationId: CONSOLIDATION_ID,
      from: "solicitada",
      reason: "capacidad verificada",
      requestRef: REQUEST_REF,
    });
    expect(res.error).toBe("No tienes permiso para realizar esta acción.");
  });
});

describe("rejectConsolidation", () => {
  it("desde 'solicitada' pasa a 'rechazada' con motivo", async () => {
    const { supabase, updates } = makeSupabase({});
    mockCreateClient.mockReturnValue(supabase);

    const res = await rejectConsolidation("cons-1", "  falta la carga  ");
    expect(res.ok).toBe(true);
    const upd = updates.find((u) => u.table === "consolidations");
    expect(upd?.payload.status).toBe("rechazada");
    expect(upd?.payload.rejected_reason).toBe("falta la carga");
  });

  it("exige motivo (no vacío)", async () => {
    const { supabase, updates } = makeSupabase({});
    mockCreateClient.mockReturnValue(supabase);

    const res = await rejectConsolidation("cons-1", "   ");
    expect(res.error).toBeDefined();
    expect(updates).toHaveLength(0);
  });

  it("rechaza si ya no está 'solicitada'", async () => {
    const { supabase, updates } = makeSupabase({
      row: { ...defaultRow(), status: "rechazada" },
    });
    mockCreateClient.mockReturnValue(supabase);

    const res = await rejectConsolidation("cons-1", "motivo");
    expect(res.error).toBeDefined();
    expect(updates).toHaveLength(0);
  });
});

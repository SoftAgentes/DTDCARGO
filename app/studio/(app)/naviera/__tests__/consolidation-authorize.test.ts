import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests de authorizeConsolidation / rejectConsolidation (SDD-0157, Slice B).
 *
 * Cubre la acceptance:
 *  - authorize solo transiciona desde 'solicitada'; asigna ref vía
 *    next_consolidation_ref; pasa a 'consolidando' con authorized_by/at.
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

type Cfg = {
  tenant?: string | null;
  row?: Record<string, unknown> | null;
  ref?: string;
  refError?: { message: string } | null;
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
      if (name === "next_consolidation_ref") {
        return { data: cfg.ref ?? "DTD-CONSOL-0007", error: cfg.refError ?? null };
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
  it("desde 'solicitada' asigna ref y pasa a 'consolidando'", async () => {
    const { supabase, updates, rpcCalls } = makeSupabase({});
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation("cons-1");
    expect(res.ok).toBe(true);

    expect(rpcCalls.some((c) => c.name === "next_consolidation_ref")).toBe(true);
    const upd = updates.find((u) => u.table === "consolidations");
    expect(upd?.payload.ref).toBe("DTD-CONSOL-0007");
    expect(upd?.payload.status).toBe("consolidando");
    expect(upd?.payload.authorized_by).toBe(USER);
    expect(upd?.payload.authorized_at).toBeDefined();
    expect(mockNotify).toHaveBeenCalledOnce();
    expect(mockRevalidate).toHaveBeenCalled();
  });

  it("rechaza si la solicitud NO está 'solicitada'", async () => {
    const { supabase, updates } = makeSupabase({
      row: { ...defaultRow(), status: "consolidando" },
    });
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation("cons-1");
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
    expect(updates).toHaveLength(0);
  });

  it("rechaza si la fila es de otro tenant", async () => {
    const { supabase, updates } = makeSupabase({
      row: { ...defaultRow(), tenant_id: "otro-tenant" },
    });
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation("cons-1");
    expect(res.error).toBeDefined();
    expect(updates).toHaveLength(0);
  });

  it("respeta moduleEditDenial", async () => {
    mockDenial.mockResolvedValueOnce("No tienes permiso para realizar esta acción.");
    const { supabase } = makeSupabase({});
    mockCreateClient.mockReturnValue(supabase);

    const res = await authorizeConsolidation("cons-1");
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

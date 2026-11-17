// @vitest-environment node
/**
 * SDD-0652 F1 · la edición del empleado ya no recibe la cuenta bancaria.
 *
 *   - `updateEmployeeAction`: con «Nueva cuenta» vacía no toca `bank_account`;
 *     con valor, la reemplaza.
 *   - `getEmployeeEditViewAction`: exige rol admin/accounting, busca en el
 *     tenant de la membresía y devuelve la cuenta enmascarada.
 * Datos sintéticos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  role: "accounting" as string | null,
  tenantId: "t1",
  fila: null as Record<string, unknown> | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("../../usuarios/actions", () => ({ inviteUserAction: async () => ({}) }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        state.updates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => null,
  moduleViewDenial: async () => null,
  capabilityDenial: async () => null,
  getStudioAccess: async () => ({
    role: state.role,
    tenantId: state.tenantId,
    userId: "u-mira",
    warehouseScope: "all",
    overrides: {},
    grants: {},
  }),
}));
vi.mock("@/lib/studio/nomina/employee-queries", () => ({
  listEmployees: async () => [],
  getEmployee: async () => state.fila,
}));

import { getEmployeeEditViewAction, updateEmployeeAction } from "../actions";

const ID = "11111111-1111-1111-1111-111111111111";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("full_name", "Persona Sintética");
  fd.set("salary_usd", "100");
  fd.set("status", "activo");
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  state.updates = [];
  state.role = "accounting";
  state.tenantId = "t1";
  state.fila = {
    id: ID,
    tenant_id: "t1",
    employee_code: "EMP-0007",
    full_name: "Persona Sintética",
    national_id: null,
    position_label: null,
    department: null,
    position_id: null,
    phone: null,
    email: null,
    salary_usd: 100,
    hire_date: null,
    birth_date: null,
    bank_name: null,
    bank_account_type: null,
    bank_account: "0102 0000 00 0000004321",
    status: "activo",
    notes: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    auth_user_id: null,
  };
});

describe("updateEmployeeAction · cuenta bancaria (SDD-0652 F1)", () => {
  it("con «Nueva cuenta» vacía no toca la cuenta", async () => {
    const r = await updateEmployeeAction(ID, {}, form({ bank_account: "" }));
    expect(r.ok).toBe(true);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).not.toHaveProperty("bank_account");
  });

  it("con una cuenta nueva la reemplaza", async () => {
    await updateEmployeeAction(ID, {}, form({ bank_account: "0134 1111 22 3333333333" }));
    expect(state.updates[0]!.bank_account).toBe("0134 1111 22 3333333333");
  });
});

describe("getEmployeeEditViewAction (SDD-0652 F1)", () => {
  it("devuelve la ficha con la cuenta enmascarada", async () => {
    const r = await getEmployeeEditViewAction(ID);
    expect("employee" in r && r.employee.bank_account_masked).toBe("•••• 4321");
    expect(JSON.stringify(r)).not.toContain("0000004321");
  });

  it("sin rol admin/accounting no devuelve nada", async () => {
    state.role = "commercial";
    expect(await getEmployeeEditViewAction(ID)).toEqual({ error: "No tienes permiso para ver esta ficha." });
  });

  it("una ficha de otro tenant no se devuelve", async () => {
    state.fila = { ...state.fila!, tenant_id: "otro" };
    const r = await getEmployeeEditViewAction(ID);
    expect("error" in r).toBe(true);
  });

  it("un id que no es uuid se rechaza", async () => {
    expect(await getEmployeeEditViewAction("EMP-0007")).toEqual({ error: "Empleado inválido." });
  });
});

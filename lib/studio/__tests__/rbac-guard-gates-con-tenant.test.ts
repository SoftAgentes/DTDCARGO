// @vitest-environment node
/**
 * Los gates con contexto de `rbac-guard` — SDD-0498.
 *
 * `moduleEditGate` y `tenantAdminGate` existen para que una server action que
 * necesita el `tenant_id` no tenga motivo para releer `user_tenants` por su
 * cuenta: esa relectura a mano fue la que, en cinco puertas del Studio, se
 * olvidó del `.is("disabled_at", null)` del endurecimiento 0200.
 *
 * Acá se fija el contrato de la ÚNICA resolución que queda, para que el
 * fail-closed no dependa de que cada call site se acuerde:
 *
 *   - la consulta filtra por `user_id` Y por `disabled_at`;
 *   - un rol suficiente pero suspendido NO pasa;
 *   - pasar devuelve tenant y usuario de la MISMA fila que autorizó.
 *
 * La matriz (`rbac.ts`) es la real; sólo se reemplaza la frontera de DB, con
 * un doble que APLICA los filtros.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";
const SUSPENDIDO = "2026-09-01T12:00:00Z";
const DENIAL = "No tienes permiso para realizar esta acción.";

vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));

const { getStudioAccess, moduleEditGate, tenantAdminGate, moduleEditDenial } = await import(
  "@/lib/studio/rbac-guard"
);

let db: DoubleHandle;
/** El mensaje si denegó, o null si pasó — para comparar con moduleEditDenial. */
const denialDe = (gate: { ok: boolean; denied?: string }) => (gate.ok ? null : gate.denied);

const cliente = () => db.client as unknown as Parameters<typeof moduleEditGate>[0];

function conMembresias(
  rows: { user_id?: string; role: string | null; disabled_at: string | null }[],
  userId: string | null = USER,
) {
  db = supabaseDouble({
    userId,
    memberships: rows.map((r) => ({
      user_id: r.user_id ?? USER,
      tenant_id: TENANT,
      role: r.role,
      disabled_at: r.disabled_at,
      warehouse_scope: "all",
    })),
  });
}

beforeEach(() => {
  conMembresias([]);
});

describe("getStudioAccess · resolución única (SDD-0498)", () => {
  it("devuelve tenant y usuario junto al rol, de la misma fila", async () => {
    conMembresias([{ role: "accounting", disabled_at: null }]);

    const access = await getStudioAccess(cliente() as unknown as SupabaseClient);

    expect(access).toMatchObject({
      role: "accounting",
      tenantId: TENANT,
      userId: USER,
      warehouseScope: "all",
    });
  });

  it("un usuario SUSPENDIDO no resuelve rol NI tenant", async () => {
    conMembresias([{ role: "admin", disabled_at: SUSPENDIDO }]);

    const access = await getStudioAccess(cliente() as unknown as SupabaseClient);

    expect(access.role).toBeNull();
    expect(access.tenantId).toBeNull();
  });

  it("sin sesión no resuelve nada y no toca `user_tenants`", async () => {
    conMembresias([{ role: "admin", disabled_at: null }], null);

    const access = await getStudioAccess(cliente() as unknown as SupabaseClient);

    expect(access).toMatchObject({ role: null, tenantId: null, userId: null });
    expect(db.reads).toEqual([]);
  });

  it("la membresía de otro usuario no se confunde con la de la sesión", async () => {
    conMembresias([
      { user_id: OTRO, role: "admin", disabled_at: null },
      { user_id: USER, role: "support", disabled_at: null },
    ]);

    const access = await getStudioAccess(cliente() as unknown as SupabaseClient);

    expect(access.role).toBe("support");
  });
});

describe("moduleEditGate · permiso + contexto en una sola resolución", () => {
  it("un `accounting` activo pasa el gate de fiscal y recibe el tenant", async () => {
    conMembresias([{ role: "accounting", disabled_at: null }]);

    const gate = await moduleEditGate(cliente(), "fiscal");

    expect(gate.ok).toBe(true);
    if (!gate.ok) throw new Error("inalcanzable");
    expect(gate).toMatchObject({ tenantId: TENANT, userId: USER, role: "accounting" });
  });

  it("un `accounting` SUSPENDIDO no pasa, y no hay tenant que ofrecer", async () => {
    conMembresias([{ role: "accounting", disabled_at: SUSPENDIDO }]);

    const gate = await moduleEditGate(cliente(), "fiscal");

    expect(denialDe(gate)).toBe(DENIAL);
    expect(gate).not.toHaveProperty("tenantId");
  });

  it("`support` no edita ni estando activo (read-only V1)", async () => {
    conMembresias([{ role: "support", disabled_at: null }]);

    expect(denialDe(await moduleEditGate(cliente(), "fiscal"))).toBe(DENIAL);
  });

  it("acepta un mensaje propio sin reimplementar el gate", async () => {
    conMembresias([{ role: "operations", disabled_at: null }]);

    const gate = await moduleEditGate(cliente(), "fiscal", { denied: "Solo Contabilidad." });

    expect(denialDe(gate)).toBe("Solo Contabilidad.");
  });

  it("decide igual que `moduleEditDenial` — un solo predicado para los dos", async () => {
    for (const role of ["admin", "accounting", "operations", "support", null]) {
      for (const disabled_at of [null, SUSPENDIDO]) {
        conMembresias(role === null ? [] : [{ role, disabled_at }]);
        const porDenial = await moduleEditDenial(cliente(), "fiscal");
        conMembresias(role === null ? [] : [{ role, disabled_at }]);
        const porGate = await moduleEditGate(cliente(), "fiscal");

        expect(denialDe(porGate), `role=${role} disabled=${Boolean(disabled_at)}`).toBe(porDenial);
      }
    }
  });
});

describe("tenantAdminGate · admin-only con contexto", () => {
  it("un admin activo pasa y recibe tenant y usuario", async () => {
    conMembresias([{ role: "admin", disabled_at: null }]);

    const gate = await tenantAdminGate(cliente());

    expect(gate.ok).toBe(true);
    if (!gate.ok) throw new Error("inalcanzable");
    expect(gate).toMatchObject({ tenantId: TENANT, userId: USER, role: "admin" });
  });

  it("un admin SUSPENDIDO no pasa", async () => {
    conMembresias([{ role: "admin", disabled_at: SUSPENDIDO }]);

    expect(denialDe(await tenantAdminGate(cliente()))).toBe(DENIAL);
  });

  it("ningún rol distinto de admin pasa, por muy activo que esté", async () => {
    for (const role of ["accounting", "operations", "commercial", "warehouse", "support", "marketing"]) {
      conMembresias([{ role, disabled_at: null }]);
      expect(denialDe(await tenantAdminGate(cliente())), role).toBe(DENIAL);
    }
  });

  it("sin membresía tampoco pasa (fail-closed)", async () => {
    conMembresias([]);

    expect(denialDe(await tenantAdminGate(cliente()))).toBe(DENIAL);
  });
});

// @vitest-environment node
/**
 * `setClosingDateAction` con un usuario SUSPENDIDO — SDD-0498.
 *
 * La action tenía gate artesanal: leía `user_tenants` filtrando por `user_id`
 * pero SIN `.is("disabled_at", null)`, el fail-closed que el endurecimiento de
 * la migración 0200 puso en `getStudioAccess`. Un admin al que le pusiste
 * `disabled_at` seguía pasando el candado de la aplicación y llegaba al upsert
 * de `accounting_settings`, o sea a fijar/levantar el cierre contable del
 * tenant.
 *
 * El gate y la matriz son los REALES (`rbac-guard.ts` + `rbac.ts`); sólo se
 * reemplaza la frontera de DB, con un doble que APLICA los filtros (ver
 * `lib/studio/__tests__/user-tenants-double.ts`): si aplicara la fila pase lo
 * que pase, esta prueba no podría distinguir el gate roto del arreglado.
 *
 * SE PRUEBA POR EL LADO NEGATIVO: lo que importa no es el mensaje, es que al
 * suspendido NO se le escriba una sola fila.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";
const SUSPENDIDO = "2026-09-01T12:00:00Z";
const ADMIN_MSG = "Solo los administradores pueden fijar el cierre de período.";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { setClosingDateAction } = await import("../actions");

function conMembresia(role: string, disabled_at: string | null, userId = USER) {
  db = supabaseDouble({
    userId,
    memberships: [{ user_id: userId, tenant_id: TENANT, role, disabled_at, warehouse_scope: "all" }],
  });
}

beforeEach(() => {
  db = supabaseDouble({ userId: USER, memberships: [] });
});

describe("setClosingDateAction · fail-closed por disabled_at (SDD-0498)", () => {
  it("un admin SUSPENDIDO no puede fijar el cierre y no escribe nada", async () => {
    conMembresia("admin", SUSPENDIDO);

    const res = await setClosingDateAction("2026-08-31");

    expect(res.ok).toBeUndefined();
    expect(res.error).toBe(ADMIN_MSG);
    expect(db.writes).toEqual([]);
  });

  it("un admin SUSPENDIDO tampoco puede REABRIR el período (closingDate null)", async () => {
    conMembresia("admin", SUSPENDIDO);

    const res = await setClosingDateAction(null);

    expect(res.error).toBe(ADMIN_MSG);
    expect(db.writes).toEqual([]);
  });

  it("un admin ACTIVO sí fija el cierre (control: el gate no se cerró de más)", async () => {
    conMembresia("admin", null);

    const res = await setClosingDateAction("2026-08-31");

    expect(res.error).toBeUndefined();
    expect(res.ok).toBe(true);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({
      table: "accounting_settings",
      op: "upsert",
      row: { tenant_id: TENANT, closing_date: "2026-08-31", locked_by: USER },
    });
  });

  it("un `accounting` activo sigue sin poder cerrar el período (SDD-0080 es admin-only)", async () => {
    conMembresia("accounting", null);

    const res = await setClosingDateAction("2026-08-31");

    expect(res.error).toBe(ADMIN_MSG);
    expect(db.writes).toEqual([]);
  });

  it("la membresía de OTRO usuario no habilita al de la sesión", async () => {
    db = supabaseDouble({
      userId: USER,
      memberships: [
        { user_id: OTRO, tenant_id: TENANT, role: "admin", disabled_at: null, warehouse_scope: "all" },
        { user_id: USER, tenant_id: TENANT, role: "operations", disabled_at: null, warehouse_scope: "all" },
      ],
    });

    const res = await setClosingDateAction("2026-08-31");

    expect(res.error).toBe(ADMIN_MSG);
    expect(db.writes).toEqual([]);
  });
});

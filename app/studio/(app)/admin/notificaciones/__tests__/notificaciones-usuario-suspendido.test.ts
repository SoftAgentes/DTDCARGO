// @vitest-environment node
/**
 * Config de notificaciones al cliente con un usuario SUSPENDIDO — SDD-0498.
 *
 * `requireAdmin()` de este archivo era la variante peor: leía `user_tenants`
 * SIN `.eq("user_id", …)` y SIN `.is("disabled_at", null)`. Dos huecos:
 *
 *  1. un admin suspendido seguía configurando los avisos al cliente;
 *  2. la consulta ni siquiera estaba acotada al usuario de la sesión — quien
 *     decidía era la primera fila que devolviera PostgREST, o sea la policy
 *     de `user_tenants`, que es justo de lo que `rbac-guard.ts:61-66` avisa
 *     que no hay que depender.
 *
 * El doble APLICA los filtros: sin `.eq("user_id")` ve las dos membresías y se
 * queda con la primera, igual que `maybeSingle()` contra una policy abierta.
 *
 * LADO NEGATIVO: al suspendido no se le ejecuta ninguna operación D1.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";
const SUSPENDIDO = "2026-09-01T12:00:00Z";
const DENY_MSG = "Solo admins pueden configurar notificaciones.";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

const executeD1OperationMock = vi.fn(async () => ({ entity_id: "rule-1" }));
vi.mock("@/lib/studio/audit/d1-access-config-adapters", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return { ...real, executeD1Operation: (...a: unknown[]) => executeD1OperationMock(...(a as [])) };
});

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { upsertRuleAction, deleteRuleAction, restoreDefaultsAction } = await import("../actions");

function conMembresia(role: string, disabled_at: string | null) {
  db = supabaseDouble({
    userId: USER,
    memberships: [{ user_id: USER, tenant_id: TENANT, role, disabled_at, warehouse_scope: "all" }],
  });
}

function formRegla(): FormData {
  const fd = new FormData();
  fd.set("id", "rule-1");
  fd.set("trigger_event", "status:shipped");
  fd.set("channel", "email");
  fd.set("anchor", "event");
  fd.set("offset_minutes", "0");
  fd.set("active", "on");
  return fd;
}

const PUERTAS: [string, () => Promise<{ ok?: boolean; error?: string }>][] = [
  ["upsertRuleAction", () => upsertRuleAction({}, formRegla())],
  ["deleteRuleAction", () => deleteRuleAction({}, formRegla())],
  ["restoreDefaultsAction", () => restoreDefaultsAction({}, new FormData())],
];

beforeEach(() => {
  vi.clearAllMocks();
  db = supabaseDouble({ userId: USER, memberships: [] });
});

describe("notificaciones · fail-closed por disabled_at (SDD-0498)", () => {
  for (const [nombre, invocar] of PUERTAS) {
    it(`${nombre} deniega a un admin SUSPENDIDO y no ejecuta la operación D1`, async () => {
      conMembresia("admin", SUSPENDIDO);

      const res = await invocar();

      expect(res.ok).toBeUndefined();
      expect(res.error).toBe(DENY_MSG);
      expect(executeD1OperationMock).not.toHaveBeenCalled();
    });
  }

  it("la membresía admin de OTRO usuario no habilita al de la sesión", async () => {
    db = supabaseDouble({
      userId: USER,
      memberships: [
        { user_id: OTRO, tenant_id: TENANT, role: "admin", disabled_at: null, warehouse_scope: "all" },
        { user_id: USER, tenant_id: TENANT, role: "operations", disabled_at: null, warehouse_scope: "all" },
      ],
    });

    const res = await restoreDefaultsAction({}, new FormData());

    expect(res.error).toBe(DENY_MSG);
    expect(executeD1OperationMock).not.toHaveBeenCalled();
  });

  it("un admin ACTIVO sí restaura los valores por defecto (control)", async () => {
    conMembresia("admin", null);

    const res = await restoreDefaultsAction({}, new FormData());

    expect(res.error).toBeUndefined();
    expect(res.ok).toBe(true);
    expect(executeD1OperationMock).toHaveBeenCalledTimes(1);
  });

  it("un `marketing` activo sigue sin poder configurar notificaciones", async () => {
    conMembresia("marketing", null);

    const res = await restoreDefaultsAction({}, new FormData());

    expect(res.error).toBe(DENY_MSG);
    expect(executeD1OperationMock).not.toHaveBeenCalled();
  });
});

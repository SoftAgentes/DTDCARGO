// @vitest-environment node
/**
 * SDD-0622 · `lookupRateForNewDestination`: la tarifa sugerida al cambiar el
 * destino de un envío.
 *
 * Decisión del Director (revisión de la #509, M1): no quitarle a Almacén la
 * tarifa que hoy recibe. El candado es editar Tracking y además ver el
 * Cotizador O la CN, el mismo criterio con que la RLS de `rates` (0531) deja
 * leer tarifas.
 *
 *   - almacén con scope CN → recibe la tarifa (ve la CN);
 *   - almacén con scope VE → no (no ve la CN ni el Cotizador);
 *   - marketing con Tracking concedido para editar pero sin Cotizador ni CN
 *     → no: pasa el primer candado y lo frena el segundo;
 *   - comercial → sí (ve el Cotizador).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const TARIFA = { id: "r-1", service: "maritimo", destination: "Valencia" };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));
let grants: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/user-module-grants-queries", () => ({
  getMyModuleGrants: async () => grants,
}));
vi.mock("@/lib/studio/platform-admin", () => ({ isPlatformAdmin: async () => false }));
const findRateMock = vi.fn(async () => TARIFA);
vi.mock("@/lib/studio/destination-change", async (orig) => ({
  ...(await orig<typeof import("@/lib/studio/destination-change")>()),
  findRateForDestination: (...a: unknown[]) => findRateMock(...(a as [])),
}));

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { lookupRateForNewDestination } = await import("../actions");

function conRol(role: string, warehouse_scope = "all") {
  db = supabaseDouble({
    userId: USER,
    memberships: [{ user_id: USER, tenant_id: TENANT, role, disabled_at: null, warehouse_scope }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  grants = {};
});

describe("lookupRateForNewDestination · editar Tracking y ver Cotizador o CN", () => {
  it("almacén con scope CN recibe la tarifa sugerida (ve la CN)", async () => {
    conRol("warehouse", "cn");
    expect(await lookupRateForNewDestination("maritimo" as never, "Valencia")).toEqual({ rate: TARIFA });
    expect(findRateMock).toHaveBeenCalled();
  });

  it("almacén con scope VE no la recibe y no se busca", async () => {
    conRol("warehouse", "ve");
    expect(await lookupRateForNewDestination("maritimo" as never, "Valencia")).toEqual({ rate: null });
    expect(findRateMock).not.toHaveBeenCalled();
  });

  it("marketing con Tracking concedido pero sin Cotizador ni CN no la recibe", async () => {
    conRol("marketing");
    grants = { tracking: { view: true, edit: true } };
    expect(await lookupRateForNewDestination("maritimo" as never, "Valencia")).toEqual({ rate: null });
    expect(findRateMock).not.toHaveBeenCalled();
  });

  it("marketing sin Tracking tampoco (primer candado)", async () => {
    conRol("marketing");
    expect(await lookupRateForNewDestination("maritimo" as never, "Valencia")).toEqual({ rate: null });
    expect(findRateMock).not.toHaveBeenCalled();
  });

  it("comercial la recibe (ve el Cotizador)", async () => {
    conRol("commercial");
    expect(await lookupRateForNewDestination("maritimo" as never, "Valencia")).toEqual({ rate: TARIFA });
  });
});

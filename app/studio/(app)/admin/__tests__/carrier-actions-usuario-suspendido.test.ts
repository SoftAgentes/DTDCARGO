// @vitest-environment node
/**
 * Transportistas y tarifario con un usuario SUSPENDIDO — SDD-0498.
 *
 * `resolveTenantAdmin` cubre las CINCO actions del archivo y leía
 * `user_tenants` por `user_id` pero SIN `.is("disabled_at", null)`. Un admin
 * suspendido pasaba el candado de la aplicación y llegaba a escribir
 * transportistas y tarifas de flete — que es lo que cotiza la web pública.
 *
 * `carrier-actions.ts` NO lo mira el anti-drift de `rbac-actions-guard.test.ts`:
 * ese escáner sólo abre archivos llamados exactamente `actions.ts`. Por eso
 * estas cinco puertas necesitan su prueba propia.
 *
 * LADO NEGATIVO: al suspendido no se le escribe una sola fila.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const CARRIER = "44444444-4444-4444-8444-444444444444";
const SUSPENDIDO = "2026-09-01T12:00:00Z";
const DENY_MSG = "Solo un administrador puede editar los transportistas.";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

const setDefaultCarrierMock = vi.fn(async () => undefined);
vi.mock("@/lib/studio/freight-carriers/queries", () => ({
  setDefaultCarrier: (...a: unknown[]) => setDefaultCarrierMock(...(a as [])),
}));

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const {
  saveCarrierAction,
  setDefaultCarrierAction,
  deleteCarrierAction,
  saveTariffAction,
  deleteTariffAction,
} = await import("../carrier-actions");

function conMembresia(role: string, disabled_at: string | null) {
  db = supabaseDouble({
    userId: USER,
    memberships: [{ user_id: USER, tenant_id: TENANT, role, disabled_at, warehouse_scope: "all" }],
    // SDD-0537: dar de alta una tarifa exige que la ciudad exista viva en el
    // catálogo del tenant. Sin esto, el control del admin activo cae por la
    // ciudad y no por el gate, que es lo que este archivo mide.
    tables: { calculator_cities: [{ tenant_id: TENANT, slug: "valencia", deleted_at: null }] },
  });
}

function formCarrier(): FormData {
  const fd = new FormData();
  fd.set("name", "Transporte Sintético");
  return fd;
}

function formTarifa(): FormData {
  const fd = new FormData();
  fd.set("carrierId", CARRIER);
  fd.set("citySlug", "valencia");
  fd.set("costUsdCbm", "80");
  fd.set("priceUsdCbm", "120");
  return fd;
}

function formConId(): FormData {
  const fd = new FormData();
  fd.set("id", CARRIER);
  return fd;
}

/** Las cinco puertas del archivo, con una entrada que pasaría la validación. */
const PUERTAS: [string, () => Promise<{ ok?: boolean; error?: string }>][] = [
  ["saveCarrierAction", () => saveCarrierAction({}, formCarrier())],
  ["setDefaultCarrierAction", () => setDefaultCarrierAction({}, formConId())],
  ["deleteCarrierAction", () => deleteCarrierAction({}, formConId())],
  ["saveTariffAction", () => saveTariffAction({}, formTarifa())],
  ["deleteTariffAction", () => deleteTariffAction({}, formConId())],
];

beforeEach(() => {
  vi.clearAllMocks();
  db = supabaseDouble({ userId: USER, memberships: [] });
});

describe("carrier-actions · fail-closed por disabled_at (SDD-0498)", () => {
  for (const [nombre, invocar] of PUERTAS) {
    it(`${nombre} deniega a un admin SUSPENDIDO y no escribe nada`, async () => {
      conMembresia("admin", SUSPENDIDO);

      const res = await invocar();

      expect(res.ok).toBeUndefined();
      expect(res.error).toBe(DENY_MSG);
      expect(db.writes).toEqual([]);
      expect(setDefaultCarrierMock).not.toHaveBeenCalled();
    });
  }

  it("un admin ACTIVO sí guarda el transportista (control)", async () => {
    conMembresia("admin", null);

    const res = await saveCarrierAction({}, formCarrier());

    expect(res.error).toBeUndefined();
    expect(res.ok).toBe(true);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({
      table: "freight_carriers",
      op: "insert",
      row: { tenant_id: TENANT, name: "Transporte Sintético" },
    });
  });

  it("un admin ACTIVO sí guarda la tarifa (control)", async () => {
    conMembresia("admin", null);

    const res = await saveTariffAction({}, formTarifa());

    expect(res.error).toBeUndefined();
    expect(res.ok).toBe(true);
    expect(db.writes[0]).toMatchObject({
      table: "carrier_tariffs",
      op: "insert",
      row: { tenant_id: TENANT, carrier_id: CARRIER, city_slug: "valencia" },
    });
  });

  it("un `commercial` activo sigue sin poder tocar el tarifario", async () => {
    conMembresia("commercial", null);

    const res = await saveTariffAction({}, formTarifa());

    expect(res.error).toBe(DENY_MSG);
    expect(db.writes).toEqual([]);
  });
});

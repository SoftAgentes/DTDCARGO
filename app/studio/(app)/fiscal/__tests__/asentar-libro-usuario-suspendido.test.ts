// @vitest-environment node
/**
 * `postFiscalBookAction` con un usuario SUSPENDIDO — SDD-0498.
 *
 * `resolveFiscalGate` era el único gate de esta action (las otras tres del
 * archivo llaman antes a `moduleEditDenial`, así que ya cortaban). Leía
 * `user_tenants` por `user_id` pero SIN `.is("disabled_at", null)`: un
 * `accounting` suspendido pasaba el candado de la aplicación y la action
 * seguía — clasificaba el período vivo y recién ahí llamaba a la RPC.
 *
 * Gate y matriz REALES; se reemplazan la DB y los lectores de libros. El doble
 * APLICA los filtros, que es lo que separa el gate roto del arreglado.
 *
 * LADO NEGATIVO: al suspendido no se le lee el libro ni se le llama la RPC.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const SUSPENDIDO = "2026-09-01T12:00:00Z";
const DENY_MSG = "Solo Contabilidad puede asentar libros o registrar retenciones.";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

const getFiscalSettingsMock = vi.fn(async () => ({
  fiscal_module_enabled: true,
  default_invoice_iva_mode: "incluido",
}));
const salesBookMock = vi.fn(async () => ({ rows: [] as unknown[] }));
const purchaseBookMock = vi.fn(async () => ({ rows: [] as unknown[] }));
vi.mock("@/lib/studio/fiscal/queries", () => ({
  getFiscalSettings: (...a: unknown[]) => getFiscalSettingsMock(...(a as [])),
  salesBook: (...a: unknown[]) => salesBookMock(...(a as [])),
  purchaseBook: (...a: unknown[]) => purchaseBookMock(...(a as [])),
}));

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { postFiscalBookAction } = await import("../actions");

function conMembresia(role: string, disabled_at: string | null) {
  db = supabaseDouble({
    userId: USER,
    memberships: [{ user_id: USER, tenant_id: TENANT, role, disabled_at, warehouse_scope: "all" }],
    rpc: { fiscal_post_book: { data: "book-1", error: null } },
  });
}

/** El gate corta ANTES de todo: ni settings, ni libro, ni RPC. */
function esperarQueNoAsentó() {
  expect(db.rpcCalls).toEqual([]);
  expect(getFiscalSettingsMock).not.toHaveBeenCalled();
  expect(salesBookMock).not.toHaveBeenCalled();
  expect(purchaseBookMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  db = supabaseDouble({ userId: USER, memberships: [] });
});

describe("postFiscalBookAction · fail-closed por disabled_at (SDD-0498)", () => {
  it("un `accounting` SUSPENDIDO no asienta el libro de ventas", async () => {
    conMembresia("accounting", SUSPENDIDO);

    const res = await postFiscalBookAction("2026-08", "ventas");

    expect(res.ok).toBeUndefined();
    expect(res.error).toBe(DENY_MSG);
    esperarQueNoAsentó();
  });

  it("un admin SUSPENDIDO tampoco asienta el libro de compras", async () => {
    conMembresia("admin", SUSPENDIDO);

    const res = await postFiscalBookAction("2026-08", "compras");

    expect(res.error).toBe(DENY_MSG);
    esperarQueNoAsentó();
  });

  it("un `accounting` ACTIVO sí asienta (control: el gate no se cerró de más)", async () => {
    conMembresia("accounting", null);

    const res = await postFiscalBookAction("2026-08", "ventas");

    expect(res.error).toBeUndefined();
    expect(res.ok).toBe(true);
    expect(db.rpcCalls.map((c) => c.name)).toEqual(["fiscal_post_book"]);
  });

  it("un `operations` activo sigue sin poder asentar (candado de dinero)", async () => {
    conMembresia("operations", null);

    const res = await postFiscalBookAction("2026-08", "ventas");

    expect(res.error).toBe(DENY_MSG);
    esperarQueNoAsentó();
  });
});

/**
 * SDD-0531 · Almacén CN usa la regla compartida y se comporta igual que antes.
 *
 * La regla «China ve códigos, no nombres» (SDD-0039 B.9) vivía escrita a mano en
 * esta página. Ahora la lee de `lib/studio/privacidad-cn.ts`, igual que Tracking
 * y Naviera. Lo que no puede cambiar es lo que la página le pide a
 * `listReceipts`: redactar para un usuario de China sin rol admin, no redactar
 * para Venezuela. (La matriz completa de la regla, admin incluido, está en
 * `lib/studio/__tests__/privacidad-cn.test.ts`.)
 */
import { describe, expect, it, vi } from "vitest";
import { dobleSupabase } from "@/lib/studio/__tests__/privacidad-cn-double";

const h = vi.hoisted(() => ({
  client: null as unknown,
  listReceipts: vi.fn(async () => []),
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => h.client }));
vi.mock("@/lib/studio/rbac-guard", async (original) => ({
  ...(await original<typeof import("@/lib/studio/rbac-guard")>()),
  requireModuleView: async () => "operations",
}));
vi.mock("@/lib/studio/warehouse-cn-queries", async (original) => ({
  ...(await original<typeof import("@/lib/studio/warehouse-cn-queries")>()),
  listReceipts: h.listReceipts,
  listWarehouses: async () => [],
  computeWarehouseKpis: async () => ({}),
}));
vi.mock("@/lib/studio/client-queries", () => ({ listClients: async () => [] }));
vi.mock("@/lib/studio/dispatch-routes-queries", () => ({ listCities: async () => [] }));
vi.mock("@/lib/studio/expense-alerts-queries", () => ({
  activeAlertShipmentIds: async () => new Set<string>(),
}));
vi.mock("@/lib/i18n/resolve-server", () => ({
  resolveLocale: async () => ({ locale: "es-VE" }),
}));
vi.mock("../_components/AlmacenCnClient", () => ({ AlmacenCnClient: () => null }));
vi.mock("../_components/HeaderActions", () => ({ HeaderActions: () => null }));
vi.mock("../_components/WarehouseKpis", () => ({ WarehouseKpis: () => null }));

import CnPage from "../page";

async function pedidoA(region: string, role: string) {
  h.listReceipts.mockClear();
  h.client = dobleSupabase({
    userId: "u1",
    tablas: {
      user_profiles: [{ user_id: "u1", locale: null }],
      user_tenants: [{ user_id: "u1", tenant_id: "t1", region, role, disabled_at: null }],
    },
  }).client;
  await CnPage({ searchParams: Promise.resolve({}) });
  expect(h.listReceipts).toHaveBeenCalledTimes(1);
  return (h.listReceipts.mock.calls[0] as unknown[])[2];
}

describe("Almacén CN con la regla compartida", () => {
  it("China sin rol admin: le pide a listReceipts que redacte", async () => {
    expect(await pedidoA("cn", "warehouse")).toEqual({ redactClientNames: true });
  });

  it("Venezuela: no redacta", async () => {
    expect(await pedidoA("ve", "warehouse")).toEqual({ redactClientNames: false });
  });
});

/** P1 authorship only: these adapter oracles do not certify SQL/concurrency. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scope: vi.fn(), from: vi.fn(), createAdmin: vi.fn(), moduleDenial: vi.fn(), capabilityDenial: vi.fn(),
  findContainer: vi.fn(), ensureAlert: vi.fn(), revertAlert: vi.fn(), invoice: vi.fn(), remove: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn(async () => ({ from: mocks.from })) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdmin }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: mocks.moduleDenial, capabilityDenial: mocks.capabilityDenial }));
vi.mock("@/lib/studio/client-consolidation/queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/studio/client-consolidation/queries")>("@/lib/studio/client-consolidation/queries");
  return { ...actual, readNormalAssociations: mocks.scope };
});
vi.mock("@/lib/studio/expense-alerts-queries", () => ({
  findOrCreateConsolidationShipment: mocks.findContainer, ensureActiveAlert: mocks.ensureAlert, revertAlertIfShipmentEmpty: mocks.revertAlert,
}));
vi.mock("@/lib/studio/sales-orders/actions", () => ({ autoInvoiceForReceipt: mocks.invoice }));
vi.mock("@/lib/studio/borrado/servidor", () => ({ eliminarRecepciones: mocks.remove }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn() }));
vi.mock("@/lib/studio/notifications/schedule-fanout", () => ({ notaSinAvisoBodega: vi.fn(), scheduleReceiptInWarehouse: vi.fn() }));

import { bulkChangeReceiptStatusAction, changeReceiptStatusAction, deleteReceiptsAction } from "../actions";
import { LEGACY_COHORT_DENIAL } from "@/lib/studio/client-consolidation/normal-flow";
import { NormalReadError } from "@/lib/studio/client-consolidation/queries";

const receipt = "00000000-0000-0000-0000-000000000101";
const legacy = "00000000-0000-0000-0000-000000000102";
const tenant = "00000000-0000-0000-0000-000000000001";
const ship = "00000000-0000-0000-0000-000000000501";
const scope = (receiptIds: string[]) => ({ available: true, receiptIds, shipmentIds: [], containerIds: [], boxIds: [] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.moduleDenial.mockResolvedValue(null); mocks.capabilityDenial.mockResolvedValue(null);
  mocks.scope.mockResolvedValue(scope([receipt]));
  mocks.createAdmin.mockReturnValue({ from: mocks.from });
  mocks.findContainer.mockResolvedValue({ shipmentId: ship, code: "C-LEGACY" });
  mocks.ensureAlert.mockResolvedValue({ created: false }); mocks.invoice.mockResolvedValue({ ok: false, notApplicable: true });
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: table === "user_tenants" ? { tenant_id: tenant }
        : { status: "pendiente_consolidacion", receipt_code: "WR-2026-0101", destination_city: null, shipment_id: null }, error: null })),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ error: null, data: [] })),
    };
    return chain;
  });
});

describe("CN prospective cohort cannot enter the legacy C-/OV confirmation", () => {
  it("rejects a single enrolled receipt before a C- helper, no-op read or auto invoice", async () => {
    const result = await changeReceiptStatusAction(receipt, "consolidado", { destinationCity: "Valencia" });
    expect(result.error).toBe(LEGACY_COHORT_DENIAL);
    expect(mocks.scope).toHaveBeenCalledWith(expect.anything(), { receiptIds: [receipt] });
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.findContainer).not.toHaveBeenCalled(); expect(mocks.invoice).not.toHaveBeenCalled();
  });
  it.each(["pendiente_consolidacion", "incidencia"] as const)("does not unform or invent recovery through %s", async (status) => {
    expect((await changeReceiptStatusAction(receipt, status)).error).toBe(LEGACY_COHORT_DENIAL);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.revertAlert).not.toHaveBeenCalled();
  });
  it("rejects an entire mixed bulk rather than mutating the legacy subset silently", async () => {
    const result = await bulkChangeReceiptStatusAction([legacy, receipt], "pendiente_consolidacion");
    expect(result.error).toBe(LEGACY_COHORT_DENIAL); expect(result.updated).toBeUndefined();
    expect(mocks.scope).toHaveBeenCalledWith(expect.anything(), { receiptIds: [legacy, receipt] });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("missing RPC/partial membership evidence never falls back to C-/OV", async () => {
    mocks.scope.mockRejectedValue(new NormalReadError("Prerrequisito no disponible", "missing_schema"));
    const result = await changeReceiptStatusAction(receipt, "consolidado", { destinationCity: "Valencia" });
    expect(result.error).toBe("Prerrequisito no disponible");
    expect(mocks.findContainer).not.toHaveBeenCalled(); expect(mocks.invoice).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not route a deletion of enrolled receipts into the legacy deletion RPC", async () => {
    const result = await deleteReceiptsAction([receipt], "Selección revisada");
    expect(result).toMatchObject({ errorCode: "cn_delete_blocked", errorParams: { count: 1 } });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("retains the prior OV auto-invoice hook on the actual legacy branch", async () => {
    mocks.scope.mockResolvedValue(scope([]));
    const result = await changeReceiptStatusAction(legacy, "consolidado", { destinationCity: "Valencia" });
    expect(result.ok).toBe(true);
    expect(mocks.findContainer).toHaveBeenCalledWith(expect.anything(), { tenantId: tenant, destination: "Valencia" });
    expect(mocks.invoice).toHaveBeenCalledWith({ admin: expect.anything(), tenantId: tenant, receiptId: legacy });
  });
  it("keeps the current CN permission check before membership and legacy reads", async () => {
    mocks.moduleDenial.mockResolvedValue("Sin permiso CN");
    expect((await changeReceiptStatusAction(receipt, "consolidado", { destinationCity: "Valencia" })).error).toBe("Sin permiso CN");
    expect(mocks.scope).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
});

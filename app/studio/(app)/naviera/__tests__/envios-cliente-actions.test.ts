// @vitest-environment node
/** Adapter oracles only. SQL authority/rollback/concurrency run separately. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MembershipResult, NormalContext, NormalGroup } from "@/lib/studio/client-consolidation/types";

const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), scope: vi.fn(), read: vi.fn(), view: vi.fn(), edit: vi.fn(),
  admin: vi.fn(), notify: vi.fn(), names: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: h.rpc, from: h.from }) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: h.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleViewDenial: h.view, moduleEditDenial: h.edit }));
vi.mock("@/lib/studio/client-consolidation/queries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/studio/client-consolidation/queries")>(), readNormalAssociations: h.scope, readNormalContext: h.read,
}));
vi.mock("@/lib/studio/privacidad-cn", () => ({ readCanSeeClientNames: h.names }));
vi.mock("@/lib/studio/warehouse-cn-queries", () => ({ resolveClientNameByMarkbox: vi.fn() }));
vi.mock("@/lib/studio/naviera/consolidation-request-notify", () => ({ notifyConsolidationAuthorizedToOperario: vi.fn() }));
vi.mock("@/lib/studio/notifications/schedule-fanout", () => ({ scheduleConsolidationEvent: h.notify, scheduleSailingEvent: vi.fn() }));
vi.mock("@/lib/studio/naviera-tracking/tracking-api", () => ({ getContainerTracking: vi.fn() }));
vi.mock("@/lib/studio/naviera-tracking/snapshot-queries", () => ({ getTrackingUsage: vi.fn() }));
vi.mock("@/lib/studio/naviera/queries", () => ({ authorizeConsolidationGoverned: vi.fn() }));

import { assignLooseCargo, changeConsolidationStatus, closeClientManifestAction, confirmClientShipmentsAction,
  loadClientManifestAction, removeConsolidationItem } from "../actions";
import { LEGACY_COHORT_DENIAL } from "@/lib/studio/client-consolidation/normal-flow";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const group: NormalGroup = { groupId: id(20), shipmentId: id(30), itemId: id(40), clientId: id(1), clientMarkbox: "DTD-1001", clientName: null,
  code: "S-2026-0001", service: "consolidado_lcl", destinationId: id(90), destination: "Valencia", revision: 1, status: "consolidating",
  receiptIds: [id(10)], boxIds: [id(100)], measures: { cbm: "1.000", weightKg: "100.00", boxes: 1 },
  rates: { membershipRevision: 1, observedAt: "2026-10-21T14:00:00Z", snapshotIds: [], missingReceiptIds: [id(10)], receiptCount: 1,
    knownSubtotalCents: "0", totalCents: null, complete: true } };
const input = () => ({ operation: "form", containerId: id(50), expectedContainerRevision: 0, reference: id(99), reason: "Carga revisada por cliente",
  groups: [{ clientId: id(1), destinationId: id(90), service: "consolidado_lcl", code: " s-2026-0001 ",
    groupId: null, expectedGroupRevision: null, receipts: [{ receiptId: id(10), sourceVersion: "a".repeat(32) }] }] });
const historical = (): MembershipResult => ({ outcome: "confirmed", operation: "form", reference: id(99), occurredAt: "2026-10-21T14:00:00Z",
  containerId: id(50), containerRevision: 1, groups: [structuredClone(group)] });

beforeEach(() => {
  vi.clearAllMocks(); h.view.mockResolvedValue(null); h.edit.mockResolvedValue(null);
  h.rpc.mockResolvedValue({ data: historical(), error: null }); h.admin.mockReturnValue({}); h.notify.mockResolvedValue(2);
  h.scope.mockResolvedValue({ available: true, receiptIds: [], shipmentIds: [], containerIds: [id(50)], boxIds: [] });
  h.from.mockImplementation((table: string) => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: async () => ({ data: table === "user_tenants" ? { tenant_id: id(5) } : { consolidation_id: id(50), shipment_id: id(30) }, error: null }) }));
});

describe("prospective formation/extension adapters", () => {
  it("sends one canonical intention through the session RPC, never client measures/tenant/actor or an admin writer", async () => {
    const raw = { ...input(), tenantId: id(666), actorId: id(667), cbm: "999", groups: input().groups.map((entry) => ({ ...entry, cbm: "999" })) };
    const result = await confirmClientShipmentsAction(raw);
    expect(result).toMatchObject({ ok: true, result: { outcome: "confirmed", containerRevision: 1 } });
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith("client_consolidation_confirm", { p_operation: "form", p_container_id: id(50), p_expected_revision: 0,
      p_reference: id(99), p_reason: "Carga revisada por cliente", p_groups: [{ ...input().groups[0], code: "S-2026-0001" }] });
    expect(h.from).not.toHaveBeenCalled(); expect(h.admin).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled();
  });
  it("bad code/duplicate receipt/empty reason cannot reach a writer", async () => {
    const raw = input(); raw.groups[0].code = "C-LEGACY";
    expect((await confirmClientShipmentsAction(raw)).fieldErrors).toBeDefined(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("SQL denial/conflict is safe and never falls back to legacy mutations", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { hint: "dtd-client-normal", message: "NORMAL_FORBIDDEN" } });
    expect((await confirmClientShipmentsAction(input())).error).toBe("No tienes permiso para esta operación.");
    expect(h.from).not.toHaveBeenCalled(); expect(h.admin).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled();
  });
  it("returns an exact historical replay without scheduling formation again", async () => {
    h.rpc.mockResolvedValue({ data: { ...historical(), outcome: "replay" }, error: null });
    const result = await confirmClientShipmentsAction(input());
    expect(result.result).toMatchObject({ outcome: "replay", containerRevision: 1, groups: [{ rates: { totalCents: null } }] });
    expect(h.notify).not.toHaveBeenCalled(); expect(h.admin).not.toHaveBeenCalled();
  });
  it("an unreadable success response is uncertain, not an invented empty success", async () => {
    h.rpc.mockResolvedValue({ data: { outcome: "confirmed" }, error: null });
    const result = await confirmClientShipmentsAction(input());
    expect(result.ok).toBeUndefined(); expect(result.error).toContain("Conserva la referencia");
  });
});

describe("cohort close/legacy escapes and reads", () => {
  const close = () => ({ containerId: id(50), expectedContainerRevision: 2, reference: id(98), reason: "Cobertura completa revisada" });
  const closed = () => ({ outcome: "closed", reference: id(98), occurredAt: "2026-10-21T15:00:00Z", containerId: id(50), containerRevision: 2, sealId: id(51) });
  it("schedules the existing consolidated notification only after an effective atomic close, never on replay", async () => {
    h.rpc.mockResolvedValueOnce({ data: closed(), error: null }).mockResolvedValueOnce({ data: { ...closed(), outcome: "replay" }, error: null });
    expect((await closeClientManifestAction(close())).ok).toBe(true);
    expect((await closeClientManifestAction(close())).ok).toBe(true);
    expect(h.notify).toHaveBeenCalledTimes(1); expect(h.notify).toHaveBeenCalledWith({}, id(5), id(50), "consolidated");
  });
  it("notification failure is reported after the committed close, without compensating it", async () => {
    h.rpc.mockResolvedValue({ data: closed(), error: null }); h.notify.mockRejectedValue(new Error("mail unavailable"));
    expect(await closeClientManifestAction(close())).toMatchObject({ ok: true, warning: expect.stringContaining("El cierre quedó registrado") });
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it("generic close, loose assignment and item removal reject cohort before legacy effects", async () => {
    expect((await changeConsolidationStatus(id(50), "cerrado")).error).toBe(LEGACY_COHORT_DENIAL);
    expect((await assignLooseCargo(id(50), { cbm: 1, weightKg: 100, pieces: 1 })).error).toBe(LEGACY_COHORT_DENIAL);
    expect((await removeConsolidationItem(id(40))).error).toBe(LEGACY_COHORT_DENIAL);
    expect(h.rpc).not.toHaveBeenCalled(); expect(h.admin).not.toHaveBeenCalled();
  });
  it("reads check current Naviera viewing permission and preserve a complete context", async () => {
    h.view.mockResolvedValueOnce("Sin permiso");
    expect(await loadClientManifestAction(id(50))).toEqual({ error: "Sin permiso" }); expect(h.read).not.toHaveBeenCalled();
    h.read.mockResolvedValue({ complete: true } as NormalContext);
    expect(await loadClientManifestAction(id(50))).toMatchObject({ context: { complete: true } });
  });
});

// @vitest-environment node
/** Adapter oracles only. SQL permissions/atomicity/replay/concurrency need real DB fixtures. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), edit: vi.fn(), capability: vi.fn(), remove: vi.fn(),
  admin: vi.fn(), notify: vi.fn(), user: vi.fn(), tenant: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: h.rpc, from: h.from }) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: h.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: h.edit, capabilityDenial: h.capability }));
vi.mock("@/lib/auth/session", () => ({ getUser: h.user, getUserTenantId: h.tenant }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("@/lib/studio/borrado/servidor", () => ({ eliminarEmbarques: h.remove, RUTAS_EMBARQUES: [] }));
vi.mock("@/lib/studio/notifications/schedule-client-notifications", () => ({ scheduleClientNotifications: h.notify }));
import { addShipmentEvent, cancelShipment, changeDestination, deleteShipment, recordClientShipmentNote, transitionClientShipment,
  transitionShipment, updateShipment, updateShipmentPlan } from "../actions";
import { LEGACY_COHORT_DENIAL } from "@/lib/studio/client-consolidation/normal-flow";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const shipment = id(1); const tenant = id(2); const time = "2026-10-21T18:00:00.000Z";
const input = () => ({ shipmentId: shipment, operation: "transit", expectedStatus: "shipped", expectedGroupRevision: 2,
  expectedContainerRevision: 4, reason: "Hito de tránsito revisado", reference: id(90) });
const scope = (cohort: boolean) => ({ available: true, complete: true,
  checked: { shipmentIds: [shipment], receiptIds: [], containerIds: [], boxIds: [] },
  shipmentIds: cohort ? [shipment] : [], receiptIds: [], containerIds: [], boxIds: [] });
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; };
beforeEach(() => {
  vi.clearAllMocks(); h.edit.mockResolvedValue(null); h.capability.mockResolvedValue(null);
  h.tenant.mockResolvedValue(tenant); h.user.mockResolvedValue({ id: id(3) }); h.admin.mockReturnValue({}); h.notify.mockResolvedValue({ scheduled: 1 });
  h.rpc.mockImplementation(async (name: string) => name === "client_consolidation_scope" ? { data: scope(true), error: null }
    : { data: { outcome: "transitioned", reference: id(90), shipmentId: shipment, occurredAt: time, from: "shipped", to: "in_transit" }, error: null });
  h.from.mockImplementation((table: string) => {
    const chain = { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: async () => ({ data: table === "shipments" ? { code: "S-2026-0101", client_markbox: "DTD-1001", client_name: null,
        status: "in_warehouse", shipment_service: "consolidado_lcl" } : null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve) };
    return chain;
  });
});
describe("generic Tracking writers cannot bypass the normal cohort", () => {
  it("blocks fields/planning/cancellation/destination/deletion before legacy effects", async () => {
    expect((await updateShipment(shipment, {}, form({ weight_kg: "999" }))).error).toBe(LEGACY_COHORT_DENIAL);
    expect((await updateShipmentPlan(shipment, {}, form({ planning_version: "1", planning_reason: "Plan revisado" }))).error).toBe(LEGACY_COHORT_DENIAL);
    expect((await cancelShipment(shipment, "Razón válida y completa")).error).toBe(LEGACY_COHORT_DENIAL);
    expect((await changeDestination(shipment, { newDestination: "Caracas", fee: 5, reason: "Nuevo destino" })).error).toBe(LEGACY_COHORT_DENIAL);
    expect((await deleteShipment(shipment, "Selección revisada")).error).toBe(LEGACY_COHORT_DENIAL);
    expect(h.from).not.toHaveBeenCalled(); expect(h.remove).not.toHaveBeenCalled(); expect(h.admin).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled(); expect(h.redirect).not.toHaveBeenCalled();
    expect(h.rpc.mock.calls.every(([name]) => name === "client_consolidation_scope")).toBe(true);
  });
  it("resolves protocol before the TS hint, including TMS last_mile, and before retroactive manual events", async () => {
    expect((await transitionShipment(shipment, "last_mile")).error).toBe(LEGACY_COHORT_DENIAL);
    expect((await addShipmentEvent(shipment, {}, form({ status: "arrived_destination", note: "No acredita llegada", occurred_at: "2020-01-01" }))).error).toBe(LEGACY_COHORT_DENIAL);
    expect(h.from).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: { code: "PGRST202", message: "missing" } }, { data: null, error: null },
    { data: { ...scope(false), complete: false }, error: null },
    { data: { ...scope(false), checked: { ...scope(false).checked, shipmentIds: [id(999)] } }, error: null },
  ])("uncertain/foreign-shaped metadata cannot fall through to a legacy write", async (reply) => {
    h.rpc.mockResolvedValue(reply);
    expect((await transitionShipment(shipment, "shipped")).ok).toBeUndefined();
    expect(h.from).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled();
  });
  it("retains current permission and input gates before membership reads", async () => {
    h.edit.mockResolvedValue("Sin permiso");
    expect((await updateShipment(shipment, {}, new FormData())).error).toBe("Sin permiso"); expect(h.rpc).not.toHaveBeenCalled();
    expect((await cancelShipment(shipment, "corto")).error).toContain("10 caracteres"); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("known complete legacy still uses its original status/event/notification transport", async () => {
    h.rpc.mockResolvedValue({ data: scope(false), error: null });
    expect(await transitionShipment(shipment, "shipped")).toEqual({ ok: true });
    expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.rpc).toHaveBeenCalledWith("client_consolidation_scope",
      { p_shipment_ids: [shipment], p_receipt_ids: [], p_container_ids: [], p_box_ids: [] });
    expect(h.from.mock.calls.map(([table]) => table)).toEqual(["shipments", "shipments", "shipment_events"]);
    expect(h.notify).toHaveBeenCalledTimes(1);
  });
});
describe("typed normal transit and current-state notes", () => {
  it("sends only the canonical atomic transit intention, then the existing notification on effective success", async () => {
    const result = await transitionClientShipment({ ...input(), actorId: id(999), tenantId: id(998), arrived_destination_at: time });
    expect(result).toMatchObject({ ok: true, result: { from: "shipped", to: "in_transit", occurredAt: time } });
    expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.rpc).toHaveBeenCalledWith("client_consolidation_transition", {
      p_shipment_id: shipment, p_operation: "transit", p_expected_status: "shipped", p_expected_group_revision: 2,
      p_expected_container_revision: 4, p_reference: id(90), p_reason: input().reason, p_delivery_address: null, p_note: null });
    expect(h.notify).toHaveBeenCalledTimes(1); expect(h.edit).not.toHaveBeenCalled();
  });
  it("historical replay does not re-read mutable notification data, schedule or write another event", async () => {
    h.rpc.mockResolvedValue({ data: { outcome: "replay", reference: id(90), shipmentId: shipment, occurredAt: time, from: "shipped", to: "in_transit" }, error: null });
    expect((await transitionClientShipment(input())).result).toMatchObject({ outcome: "replay", occurredAt: time });
    expect(h.from).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled(); expect(h.admin).not.toHaveBeenCalled();
  });
  it("cannot smuggle VE release into the Tracking transit export", async () => {
    expect((await transitionClientShipment({ ...input(), operation: "release_ve" })).ok).toBeUndefined(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("a SQL conflict never triggers a fallback or a success notification", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { hint: "dtd-client-normal", message: "NORMAL_CONFLICT" } });
    expect((await transitionClientShipment(input())).error).toContain("revisión cambió");
    expect(h.from).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled();
  });
  it("a notification failure remains a committed transition with a warning", async () => {
    h.notify.mockRejectedValue(new Error("mail down"));
    expect(await transitionClientShipment(input())).toMatchObject({ ok: true, warning: expect.stringContaining("quedó registrado") });
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it("note records expected current state/revisions, reason/ref and no browser clock", async () => {
    h.rpc.mockResolvedValue({ data: { outcome: "recorded", reference: id(90), shipmentId: shipment, status: "last_mile", occurredAt: time }, error: null });
    expect((await recordClientShipmentNote({ ...input(), expectedStatus: "last_mile", note: "Entrega coordinada", occurredAt: "2020-01-01" })).ok).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith("client_consolidation_note", { p_shipment_id: shipment, p_expected_status: "last_mile",
      p_expected_group_revision: 2, p_expected_container_revision: 4, p_reference: id(90), p_note: "Entrega coordinada", p_reason: input().reason });
    expect(h.from).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled();
  });
});

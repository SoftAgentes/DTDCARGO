// @vitest-environment node
/** Adapter oracles; SQL35–38 separately test authority/rollback/persistence after GO. Not executed in P1. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), edit: vi.fn(), view: vi.fn(), revalidate: vi.fn(),
  splitRpc: vi.fn(), operario: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: h.rpc, from: h.from }) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ rpc: h.splitRpc }) }));
vi.mock("@/lib/auth/operario-session", () => ({ getCurrentOperario: h.operario, signOutOperario: vi.fn() }));
vi.mock("@/lib/studio/notify/notify-dispatch-events", () => ({ notifyCamioneroOdLista: h.notify }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: h.edit, moduleViewDenial: h.view }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { splitPackageP2Action } from "@/app/m/ve/bodeguero/actions";
import { assignDeliveryAction, completeNormalVeDeliveryAction, loadVeNormalContextAction, markCustomsReleasedAction,
  markDeliveredAction, reportIncidentAction, transitionNormalVeShipmentAction } from "../actions";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const shipment = id(1); const time = "2026-10-21T18:00:00Z";
const expected = () => ({ shipmentId: shipment, expectedStatus: "in_customs", expectedGroupRevision: 2,
  expectedContainerRevision: 4, reference: id(90), reason: "Liberación operativa revisada" });
const delivery = () => ({ ...expected(), expectedStatus: "last_mile", sealId: id(5), receiptIds: [id(7), id(6)],
  receivedBy: "Receptor sintético", attestComplete: true });
const scope = (cohort: boolean) => ({ available: true, complete: true,
  checked: { shipmentIds: [shipment], receiptIds: [], containerIds: [], boxIds: [] },
  shipmentIds: cohort ? [shipment] : [], receiptIds: [], containerIds: [], boxIds: [] });
beforeEach(() => {
  vi.clearAllMocks(); h.edit.mockResolvedValue(null); h.view.mockResolvedValue(null);
  h.rpc.mockResolvedValue({ data: scope(true), error: null }); h.from.mockImplementation(() => { throw new Error("Unexpected generic domain write"); });
  h.operario.mockResolvedValue({ operario_id: id(70), tenant_id: id(71), region: "ve", role: "supervisor" });
  h.splitRpc.mockResolvedValue({ data: id(73), error: null });
});
describe("actual Bodeguero split caller preserves new atomic contention intent", () => {
  const form = () => {
    const value = new FormData(); value.set("od_id", id(72)); value.set("package_id", id(74));
    value.set("boxes_shipped", "1"); value.set("split_reason", "falta_volumen");
    value.set("split_reason_text", "Fracción sintética");
    // No caller flag may choose retryability or SQL authority.
    value.set("retryable", "true"); value.set("operario_id", id(999)); return value;
  };
  const denied = { code: "P0001", message: "NORMAL_CONFLICT", hint: "dtd-client-normal" };
  const safeMessage = "El despacho está cambiando. No se fraccionó este paquete. Revisa la orden e inténtalo de nuevo.";
  it("only the exact server code/message/hint returns a safe retryable error, once", async () => {
    h.splitRpc.mockResolvedValue({ data: null, error: denied });
    expect(await splitPackageP2Action({}, form())).toEqual({ error: safeMessage, retryable: true });
    expect(h.splitRpc).toHaveBeenCalledTimes(1); expect(h.splitRpc).toHaveBeenCalledWith("bodeguero_split_p2", {
      p_operario_id: id(70), p_od_id: id(72), p_package_id: id(74), p_boxes_shipped: 1,
      p_split_reason: "falta_volumen", p_split_reason_text: "Fracción sintética" });
    expect(h.revalidate).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each([{ code: "40001" }, { code: undefined }, { hint: "another-surface" }, { hint: undefined },
    { message: "NORMAL_CONFLICT suffix" }, { message: "P0013" }])("does not generalize the retry flag from a discordant error", async (delta) => {
    const error = { ...denied, ...delta }; h.splitRpc.mockResolvedValue({ data: null, error });
    const result = await splitPackageP2Action({}, form());
    expect(result.retryable).toBeUndefined(); expect(result.ok).toBeUndefined(); expect(result.createdOdId).toBeUndefined();
    expect(result.error).toBe(error.message.includes("P0013") ? "Este paquete ya fue fraccionado." : error.message);
    expect(h.splitRpc).toHaveBeenCalledTimes(1); expect(h.revalidate).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled();
  });
  it.each([null, { operario_id: id(70), region: "cn", role: "supervisor" },
    { operario_id: id(70), region: "ve", role: "camionero" }])("keeps actual session/region/role rejection before SQL", async (session) => {
    h.operario.mockResolvedValue(session); const result = await splitPackageP2Action({}, form());
    expect(result.error).toBeTruthy(); expect(result.retryable).toBeUndefined(); expect(h.splitRpc).not.toHaveBeenCalled();
  });
  it("keeps real input validation and terminal P0013 handling", async () => {
    const invalid = form(); invalid.set("boxes_shipped", "0");
    expect((await splitPackageP2Action({}, invalid)).fieldErrors).toBeTruthy(); expect(h.splitRpc).not.toHaveBeenCalled();
    h.splitRpc.mockResolvedValue({ data: null, error: { code: "P0013", message: "P0013", hint: null } });
    expect(await splitPackageP2Action({}, form())).toEqual({ error: "Este paquete ya fue fraccionado." });
    expect(h.splitRpc).toHaveBeenCalledTimes(1); expect(h.revalidate).not.toHaveBeenCalled();
  });
  it("keeps actual success ID and the existing revalidation, with no flag from the form", async () => {
    expect(await splitPackageP2Action({}, form())).toEqual({ ok: true, createdOdId: id(73) });
    expect(h.splitRpc).toHaveBeenCalledTimes(1); expect(h.revalidate).toHaveBeenCalledTimes(1);
    expect(h.revalidate).toHaveBeenCalledWith("/m/ve/bodeguero");
    expect(h.notify).not.toHaveBeenCalled();
  });
  it("does not relabel ambiguous transport as an atomic denial or repeat SQL", async () => {
    h.splitRpc.mockRejectedValue(new Error("synthetic transport lost"));
    await expect(splitPackageP2Action({}, form())).rejects.toThrow("synthetic transport lost");
    expect(h.splitRpc).toHaveBeenCalledTimes(1); expect(h.revalidate).not.toHaveBeenCalled();
  });
});
describe("VE cohort closes individual legacy escapes", () => {
  it("release/dispatch/incident/manual legacy cut before generic state/event or the0487 transport", async () => {
    for (const result of [await markCustomsReleasedAction(shipment), await assignDeliveryAction(shipment),
      await reportIncidentAction(shipment, { reason: "Incidencia revisada" }), await markDeliveredAction({ shipmentId: shipment,
        from: "last_mile", receivedBy: "Receptor sintético", reason: "Constancia revisada", requestRef: "warehouse-ve:manual:1" })]) {
      expect(result.ok).toBeUndefined(); expect(result.error).toContain("manifiesto por cliente");
    }
    expect(h.from).not.toHaveBeenCalled(); expect(h.rpc.mock.calls.every(([name]) => name === "client_consolidation_scope")).toBe(true);
  });
  it("permission denial remains before metadata", async () => {
    h.edit.mockResolvedValue("Sin permiso"); expect(await markCustomsReleasedAction(shipment)).toEqual({ error: "Sin permiso" });
    expect(h.rpc).not.toHaveBeenCalled(); expect(h.from).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: null, error: { code: "PGRST202" } },
    { data: { ...scope(false), complete: false }, error: null },
    { data: { ...scope(false), checked: { ...scope(false).checked, shipmentIds: [] } }, error: null }])("unknown scope never opens legacy", async (reply) => {
    h.rpc.mockResolvedValue(reply); expect((await markCustomsReleasedAction(shipment)).ok).toBeUndefined(); expect(h.from).not.toHaveBeenCalled();
  });
  it("a complete known legacy manual delivery retains its original governed RPC", async () => {
    h.rpc.mockImplementation(async (name: string) => ({ data: name === "client_consolidation_scope" ? scope(false) : "transitioned", error: null }));
    expect(await markDeliveredAction({ shipmentId: shipment, from: "last_mile", receivedBy: "Receptor sintético", reason: "Constancia revisada", requestRef: "legacy:1" }))
      .toEqual({ ok: true, replayed: false });
    expect(h.rpc).toHaveBeenLastCalledWith("complete_ve_delivery_governed", {
      p_shipment_id: shipment, p_received_by: "Receptor sintético", p_reason: "Constancia revisada", p_request_ref: "legacy:1" });
    expect(h.from).not.toHaveBeenCalled();
  });
});
describe("typed VE normal intentions", () => {
  it.each(["release_ve", "dispatch_ve"] as const)("%s makes one atomic request, no financial/event fallback", async (operation) => {
    const from = operation === "release_ve" ? "in_customs" : "arrived_destination";
    const to = operation === "release_ve" ? "arrived_destination" : "out_for_delivery";
    h.rpc.mockResolvedValue({ data: { outcome: "transitioned", reference: id(90), shipmentId: shipment, occurredAt: time, from, to }, error: null });
    expect((await transitionNormalVeShipmentAction({ ...expected(), operation, expectedStatus: from, tenantId: id(999), occurredAt: "2020-01-01" })).ok).toBe(true);
    expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.rpc).toHaveBeenCalledWith("client_consolidation_transition", {
      p_shipment_id: shipment, p_operation: operation, p_expected_status: from, p_expected_group_revision: 2, p_expected_container_revision: 4,
      p_reference: id(90), p_reason: expected().reason, p_delivery_address: null, p_note: null });
    expect(h.from).not.toHaveBeenCalled();
  });
  it("manual completion carries exact whole-seal attestation and no browser actor/time", async () => {
    h.rpc.mockResolvedValue({ data: { outcome: "replay", reference: id(90), shipmentId: shipment, occurredAt: time, from: "last_mile", to: "delivered" }, error: null });
    expect((await completeNormalVeDeliveryAction({ ...delivery(), actorId: id(999), occurredAt: "2020-01-01" })).result?.occurredAt).toBe(time);
    expect(h.rpc).toHaveBeenCalledWith("client_consolidation_complete_delivery", { p_shipment_id: shipment, p_expected_status: "last_mile",
      p_expected_group_revision: 2, p_expected_container_revision: 4, p_seal_id: id(5), p_receipt_ids: [id(6), id(7)],
      p_received_by: "Receptor sintético", p_reason: expected().reason, p_reference: id(90), p_attest_complete: true });
    expect(h.from).not.toHaveBeenCalled();
  });
  it.each([{ attestComplete: false }, { receiptIds: [] }, { receiptIds: [id(6), id(6)] }, { sealId: null },
    { expectedGroupRevision: 0 }, { expectedStatus: "in_customs" }, { receivedBy: "" }])("invalid/incomplete manual attestation makes no request", async (delta) => {
    expect((await completeNormalVeDeliveryAction({ ...delivery(), ...delta })).ok).toBeUndefined(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("SQL conflict or AUD failure has no adapter fallback/success invalidation", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { hint: "dtd-client-normal", message: "NORMAL_CONFLICT" } });
    expect((await completeNormalVeDeliveryAction(delivery())).ok).toBeUndefined(); expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.from).not.toHaveBeenCalled(); expect(h.revalidate).not.toHaveBeenCalled();
  });
  it("Tracking transit cannot be smuggled into VE", async () => {
    expect((await transitionNormalVeShipmentAction({ ...expected(), operation: "transit" })).ok).toBeUndefined(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("read metadata is unavailable without current VE view or an exact shipment identity", async () => {
    h.view.mockResolvedValue("Sin vista"); expect(await loadVeNormalContextAction(shipment)).toEqual({ available: false, error: "Sin vista" });
    expect(h.rpc).not.toHaveBeenCalled(); h.view.mockResolvedValue(null);
    h.rpc.mockResolvedValue({ data: { shipmentId: id(999), complete: true, cohort: false, manifest: null }, error: null });
    expect((await loadVeNormalContextAction(shipment)).available).toBe(false);
  });
});

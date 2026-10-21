// @vitest-environment node
/** HTTP adapter oracles; the actual SQL authority/rollback is tested separately. */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), auth: vi.fn(), edit: vi.fn(), view: vi.fn(), capability: vi.fn(),
  tenant: vi.fn(), user: vi.fn(), remove: vi.fn(), shipment: vi.fn(), events: vi.fn(), normal: vi.fn(), names: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: h.rpc, from: h.from, auth: { getUser: h.auth } }) }));
vi.mock("@/lib/auth/session", () => ({ getUser: h.user, getUserTenantId: h.tenant }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: h.edit, moduleViewDenial: h.view, capabilityDenial: h.capability }));
vi.mock("@/lib/studio/borrado/servidor", () => ({ eliminarEmbarques: h.remove }));
vi.mock("@/lib/studio/shipment-queries", () => ({ getShipmentById: h.shipment, getShipmentEvents: h.events }));
vi.mock("@/lib/studio/client-consolidation/queries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/studio/client-consolidation/queries")>(), readNormalShipment: h.normal,
}));
vi.mock("@/lib/studio/privacidad-cn", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/studio/privacidad-cn")>(), readCanSeeClientNames: h.names,
}));
import { DELETE, GET, PATCH } from "../route";
import { POST } from "../events/route";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const shipment = id(1); const params = { params: Promise.resolve({ id: shipment }) }; const time = "2026-10-21T18:00:00Z";
const req = (method: string, body?: unknown) => new NextRequest("http://localhost/api/studio/shipments/fixture", {
  method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
const scope = () => ({ available: true, complete: true, checked: { shipmentIds: [shipment], receiptIds: [], containerIds: [], boxIds: [] },
  shipmentIds: [shipment], receiptIds: [], containerIds: [], boxIds: [] });
const intent = (operation = "transit") => ({ operation, expectedStatus: "shipped", expectedGroupRevision: 2, expectedContainerRevision: 4,
  reference: id(90), reason: "Hito revisado" });
beforeEach(() => {
  vi.clearAllMocks(); h.edit.mockResolvedValue(null); h.view.mockResolvedValue(null); h.capability.mockResolvedValue(null);
  h.auth.mockResolvedValue({ data: { user: { id: id(3) } } }); h.user.mockResolvedValue({ id: id(3) }); h.tenant.mockResolvedValue(id(2)); h.names.mockResolvedValue(false);
  h.rpc.mockImplementation(async (name: string) => name === "client_consolidation_scope" ? { data: scope(), error: null }
    : { data: { outcome: "transitioned", reference: id(90), shipmentId: shipment, from: "shipped", to: "in_transit", occurredAt: time }, error: null });
  h.shipment.mockResolvedValue({ id: shipment, client_name: "Cliente sintético", destination_gps: "10, -68" }); h.events.mockResolvedValue([]);
  h.normal.mockResolvedValue({ shipmentId: shipment, cohort: false, complete: true, manifest: null, group: null });
});
describe("individual API cannot bypass cohort identity or lifecycle", () => {
  it("PATCH/DELETE reject cohort before generic mutations or the deletion RPC", async () => {
    expect((await PATCH(req("PATCH", { weight_kg: 999, client_markbox: "DTD-9999", notes: "No es una edición tipada" }), params)).status).toBe(409);
    expect((await DELETE(req("DELETE", { reason: "Selección revisada" }), params)).status).toBe(409);
    expect(h.from).not.toHaveBeenCalled(); expect(h.remove).not.toHaveBeenCalled();
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(["client_consolidation_scope", "client_consolidation_scope"]);
  });
  it.each([
    { data: null, error: { code: "PGRST202", message: "missing" } }, { data: null, error: null },
    { data: { ...scope(), checked: { ...scope().checked, shipmentIds: [] } }, error: null },
    { data: { ...scope(), checked: { ...scope().checked, shipmentIds: [id(999)] } }, error: null },
  ])("unknown/partial/foreign-shaped metadata returns unavailable without a legacy writer", async (reply) => {
    h.rpc.mockResolvedValue(reply);
    expect((await PATCH(req("PATCH", { volume_m3: 1 }), params)).status).toBe(503);
    expect(h.from).not.toHaveBeenCalled(); expect(h.remove).not.toHaveBeenCalled();
  });
  it("a generic status/event, even last_mile, is rejected before the global TS service hint", async () => {
    expect((await POST(req("POST", { status: "last_mile", note: "No es TMS" }), params)).status).toBe(409);
    expect(h.from).not.toHaveBeenCalled(); expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it("legacy support denial remains before any membership/domain read", async () => {
    h.edit.mockResolvedValue("Sin permiso");
    expect((await POST(req("POST", { status: "shipped" }), params)).status).toBe(403);
    expect(h.rpc).not.toHaveBeenCalled(); expect(h.from).not.toHaveBeenCalled();
  });
});
describe("typed atomic API operations", () => {
  it("transit uses one writer with expected versions, no client authority or timestamp", async () => {
    const response = await POST(req("POST", { status: "in_transit", normal: { ...intent(), tenantId: id(999), actorId: id(998) } }), params);
    expect(response.status).toBe(201);
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(["client_consolidation_scope", "client_consolidation_transition"]);
    expect(h.rpc.mock.calls[1][1]).toEqual({ p_shipment_id: shipment, p_operation: "transit", p_expected_status: "shipped",
      p_expected_group_revision: 2, p_expected_container_revision: 4, p_reference: id(90), p_reason: "Hito revisado", p_delivery_address: null, p_note: null });
    expect(h.from).not.toHaveBeenCalled();
  });
  it("a note accepts the current TMS state without manufacturing another milestone", async () => {
    h.rpc.mockImplementation(async (name: string) => name === "client_consolidation_scope" ? { data: scope(), error: null }
      : { data: { outcome: "recorded", reference: id(90), shipmentId: shipment, status: "last_mile", occurredAt: time }, error: null });
    const response = await POST(req("POST", { status: "last_mile", note: "Coordinación de entrega", normal: { ...intent("note"), expectedStatus: "last_mile" } }), params);
    expect(response.status).toBe(201); expect(h.rpc.mock.calls[1][0]).toBe("client_consolidation_note"); expect(h.from).not.toHaveBeenCalled();
  });
  it("historical replay is returned once under current reading authority, never via legacy UPDATE", async () => {
    h.edit.mockResolvedValue("Ya no edita");
    h.rpc.mockImplementation(async (name: string) => name === "client_consolidation_scope" ? { data: scope(), error: null }
      : { data: { outcome: "replay", reference: id(90), shipmentId: shipment, from: "shipped", to: "in_transit", occurredAt: time }, error: null });
    const response = await POST(req("POST", { status: "in_transit", normal: intent() }), params);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ result: { outcome: "replay", occurredAt: time } });
    expect(h.view).toHaveBeenCalled(); expect(h.from).not.toHaveBeenCalled();
  });
  it("complete membership metadata never grants a viewer a fresh mutation denied by SQL", async () => {
    h.edit.mockResolvedValue("Ya no edita");
    h.rpc.mockImplementation(async (name: string) => name === "client_consolidation_scope" ? { data: scope(), error: null }
      : { data: null, error: { hint: "dtd-client-normal", message: "NORMAL_FORBIDDEN" } });
    const response = await POST(req("POST", { status: "in_transit", normal: intent() }), params);
    expect(response.status).toBe(403); expect(h.from).not.toHaveBeenCalled();
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(["client_consolidation_scope", "client_consolidation_transition"]);
  });
  it.each([
    [{ status: "in_transit", normal: intent(), occurred_at: "2020-01-01" }, 409],
    [{ status: "arrived_destination", normal: intent("release_ve") }, 400],
    [{ status: "shipped", normal: intent() }, 400],
  ] as const)("cannot supply another authority, fake time or state through the typed branch", async (body, expected) => {
    const response = await POST(req("POST", body), params);
    expect(response.status).toBe(expected); expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.from).not.toHaveBeenCalled();
  });
  it("read metadata remains explicit on errors and client fields are redacted", async () => {
    h.normal.mockRejectedValue(new Error("reader missing"));
    const response = await GET(req("GET"), params); const body = await response.json();
    expect(body.normal).toMatchObject({ available: false }); expect(body.normal).not.toHaveProperty("context");
    expect(body.shipment).toMatchObject({ client_name: null, destination_gps: null });
  });
});

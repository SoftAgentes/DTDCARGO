// @vitest-environment node
/** SDD-0578. Adapter/decoder oracles only; this double does NOT prove RLS or SQL ownership. */
import { describe, expect, it } from "vitest";
import { getMyShipment, getNextArrival, getPortalActivation, listMyDocuments, listMyShipments, PortalShipmentsUnavailableError } from "../portal-queries";
import { portalDouble, portalMembership, CLIENT_A, TENANT_A, TENANT_B, MARKBOX, type Row } from "./portal-tenant-double";

const instant = "2026-10-21T12:00:00Z";
const normal = () => ({ clientId: CLIENT_A, containerId: "container-a", containerRef: "NAV-001", groupRevision: 2, containerRevision: 3, sealed: true });
const row = (id: string, over: Row = {}): Row => ({ id, tenant_id: TENANT_A, code: `S-2026-${id}`, shipment_service: "consolidado_lcl",
  status: "in_transit", origin: "Yiwu", destination: "Valencia", volume_m3: 1.25, weight_kg: 100,
  arrived_destination_at: null, created_at: instant, updated_at: instant, normal: normal(), ...over });
const envelope = (shipments: Row[], over: Row = {}): Row => ({ available: true, complete: true, observedAt: instant,
  principal: { tenantId: TENANT_A, clientId: CLIENT_A, markbox: MARKBOX }, shipments, ...over });
function arrange(data: unknown = envelope([row("0001")]), tables: Record<string, Row[]> = {}) {
  return portalDouble({ tables: { client_users: [portalMembership()], clients: [{ id: CLIENT_A, portal_approved_at: null }], ...tables },
    rpc: { client_consolidation_portal_read: () => data } });
}

describe("SDD-0578 Portal: own server principal and explicit complete snapshot", () => {
  it("one own group stays one shipment, with Naviera association and fixed totals", async () => {
    const double = arrange();
    expect(await listMyShipments(double.db)).toEqual([{ id: "0001", code: "S-2026-0001", service: "consolidado_lcl", status: "in_transit",
      origin: "Yiwu", destination: "Valencia", updatedAt: instant, normal: normal() }]);
    expect(await getMyShipment(double.db, "S-2026-0001")).toMatchObject({ id: "0001", volumeM3: 1.25, weightKg: 100, normal: normal() });
    expect(double.on("shipments")).toEqual([]);
    expect(double.rpcCalls.every((call) => call.name === "client_consolidation_portal_read" && Object.keys(call.args).length === 0)).toBe(true);
  });
  it("keeps every cohort group beyond the legacy100/50 windows", async () => {
    const groups = Array.from({ length: 125 }, (_, i) => row(String(i).padStart(4, "0")));
    const legacy = Array.from({ length: 110 }, (_, i) => row(`legacy-${i}`, { normal: null, status: "delivered" }));
    const double = arrange(envelope([...legacy, ...groups]));
    const rows = await listMyShipments(double.db);
    expect(rows.filter((r) => r.normal !== null)).toHaveLength(125);
    expect(rows.filter((r) => r.normal === null)).toHaveLength(100);
    expect((await getNextArrival(double.db))?.id).toBe("0000");
  });
  it("an own legacy shipment and its old mark-filtered document stay visible", async () => {
    const double = arrange(envelope([row("legacy", { normal: null })]), { shipment_documents: [
      { id: "own", tenant_id: TENANT_A, shipment_id: "legacy", client_markbox: MARKBOX, deleted_at: null, shipments: { code: "S-2026-legacy" } },
      { id: "wrong-mark", tenant_id: TENANT_A, shipment_id: "legacy", client_markbox: "OTHER", deleted_at: null },
      { id: "wrong-parent", tenant_id: TENANT_A, shipment_id: "foreign", client_markbox: MARKBOX, deleted_at: null },
      { id: "wrong-tenant", tenant_id: TENANT_B, shipment_id: "legacy", client_markbox: MARKBOX, deleted_at: null },
    ] });
    expect((await listMyDocuments(double.db)).map((doc) => doc.id)).toEqual(["own"]);
    expect(double.on("shipment_documents")[0].filters).toContainEqual({ column: "shipment_id", op: "in", value: ["legacy"] });
  });
  it("cohort document ownership follows the already-authorized parent/client_id, not a historical mark", async () => {
    const double = arrange(envelope([row("0001")]), { shipment_documents: [
      { id: "group-doc", tenant_id: TENANT_A, shipment_id: "0001", client_markbox: "old-mark", deleted_at: null },
    ] });
    expect((await listMyDocuments(double.db)).map((doc) => doc.id)).toEqual(["group-doc"]);
    expect(await getPortalActivation(double.db)).toEqual({ activated: true, reason: "has_shipments" });
  });
  it.each([
    ["null", null], ["partial", envelope([], { complete: false })], ["no available", envelope([], { available: false })],
    ["missing principal", envelope([], { principal: null })],
    ["foreign principal", envelope([], { principal: { tenantId: TENANT_B, clientId: CLIENT_A, markbox: MARKBOX } })],
    ["wrong client", envelope([], { principal: { tenantId: TENANT_A, clientId: "other", markbox: MARKBOX } })],
    ["wrong mark", envelope([], { principal: { tenantId: TENANT_A, clientId: CLIENT_A, markbox: "OTHER" } })],
    ["duplicate", envelope([row("same"), row("same")])], ["foreign tenant row", envelope([row("x", { tenant_id: TENANT_B })])],
    ["foreign cohort identity", envelope([row("x", { normal: { ...normal(), clientId: "other" } })])],
    ["missing classification", envelope([row("x", { normal: undefined })])],
    ["bad revision", envelope([row("x", { normal: { ...normal(), groupRevision: 0 } })])],
    ["bad measures", envelope([row("x", { weight_kg: -1 })])], ["bad clock", envelope([], { observedAt: "invalid" })],
  ])("%s never opens legacy or becomes an empty success", async (_label, invalid) => {
    const double = arrange(invalid);
    await expect(listMyShipments(double.db)).rejects.toBeInstanceOf(PortalShipmentsUnavailableError);
    await expect(getMyShipment(double.db, "S-2026-0001")).rejects.toBeInstanceOf(PortalShipmentsUnavailableError);
    await expect(listMyDocuments(double.db)).rejects.toBeInstanceOf(PortalShipmentsUnavailableError);
    expect(double.on("shipment_documents")).toEqual([]);
  });
  it("transport failure is safe/unavailable and preserves no fake zero", async () => {
    const double = portalDouble({ tables: { client_users: [portalMembership()] },
      rpc: { client_consolidation_portal_read: () => { throw new Error("private transport detail"); } } });
    await expect(listMyShipments(double.db)).rejects.toThrow("PORTAL_ENVIOS_NO_DISPONIBLES");
    expect(double.on("shipments")).toEqual([]);
  });
  it("without a live principal neither team rights nor a fake envelope activate a reader", async () => {
    const double = portalDouble({ tables: { client_users: [] }, rpc: { client_consolidation_portal_read: envelope([row("0001")]) } });
    expect(await listMyShipments(double.db)).toEqual([]);
    expect(await getMyShipment(double.db, "S-2026-0001")).toBeNull();
    expect(double.rpcCalls).toEqual([]);
  });
});

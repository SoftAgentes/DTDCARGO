// @vitest-environment node
/** SDD-0578. Adapter/decoder oracles only; this double does NOT prove RLS or SQL ownership. */
import { describe, expect, it } from "vitest";
import { getMyShipment, getNextArrival, getPortalActivation, listMyDocuments, listMyShipments, PortalShipmentsUnavailableError } from "../portal-queries";
import { listMyRecentActivity, listMyShipmentEvents, PortalEventsUnavailableError, stepDatesFromEvents } from "../shipment-events-queries";
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

const eventRow = (id: string, over: Row = {}): Row => ({ id, shipmentId: "own-shipment", shipmentCode: "S-2026-OWN1",
  tenantId: TENANT_A, clientId: CLIENT_A, status: "in_warehouse", occurredAt: instant, note: null, ...over });
const eventEnvelope = (events: Row[], over: Row = {}): Row => ({ available: true, complete: true, observedAt: instant,
  principal: { tenantId: TENANT_A, clientId: CLIENT_A, markbox: MARKBOX }, view: "history", shipmentId: "own-shipment", limit: null, events, ...over });
function eventDouble(data: unknown = eventEnvelope([])) {
  return portalDouble({ tables: { client_users: [portalMembership()] }, rpc: { client_consolidation_portal_events: () => data } });
}

describe("SDD-0578 Portal events: actual principal and strict projection decoder (not SQL/RLS proof)", () => {
  it("Portal-only does not invoke a Studio tenant helper or native table", async () => {
    const double = eventDouble(eventEnvelope([eventRow("event-a")]));
    expect(await listMyShipmentEvents(double.db, "own-shipment")).toEqual([
      { id: "event-a", status: "in_warehouse", occurredAt: instant, note: null },
    ]);
    expect(double.rpcCalls).toEqual([{ name: "client_consolidation_portal_events", args: { p_shipment_id: "own-shipment", p_limit: null } }]);
    expect(double.operations.every((operation) => operation.table === "client_users")).toBe(true);
  });
  it("preserves all1105 history events and the first milestone beyond a PostgREST row cap", async () => {
    const events = Array.from({ length: 1105 }, (_, index) => eventRow(String(index).padStart(4, "0"), {
      status: index === 0 || index === 1104 ? "in_warehouse" : "shipped",
      occurredAt: new Date(Date.UTC(2026, 5, 10) + index * 60_000).toISOString(),
    }));
    const double = eventDouble(eventEnvelope(events));
    const history = await listMyShipmentEvents(double.db, "own-shipment");
    expect(history).toHaveLength(1105);
    expect(history[1104].id).toBe("1104");
    expect(stepDatesFromEvents(history).in_warehouse).toBe("2026-06-10T00:00:00.000Z");
    expect(double.rpcCalls[0].args).toEqual({ p_shipment_id: "own-shipment", p_limit: null });
  });
  it.each([8, 4])("recent requests exactly top%d with stable descending ties, separately from history", async (limit) => {
    const events = Array.from({ length: limit }, (_, index) => eventRow(String(limit - index).padStart(4, "0")));
    const double = eventDouble(eventEnvelope(events, { view: "recent", shipmentId: null, limit }));
    const feed = limit === 8 ? await listMyRecentActivity(double.db) : await listMyRecentActivity(double.db, limit);
    expect(feed.map((event) => event.id)).toEqual(events.map((event) => event.id));
    expect(feed.every((event) => event.shipmentCode === "S-2026-OWN1")).toBe(true);
    expect(double.rpcCalls).toEqual([{ name: "client_consolidation_portal_events", args: { p_shipment_id: null, p_limit: limit } }]);
  });
  it.each([
    ["null", null], ["partial", eventEnvelope([], { complete: false })], ["unavailable", eventEnvelope([], { available: false })],
    ["wrong principal tenant", eventEnvelope([], { principal: { tenantId: TENANT_B, clientId: CLIENT_A, markbox: MARKBOX } })],
    ["wrong principal client", eventEnvelope([], { principal: { tenantId: TENANT_A, clientId: "other", markbox: MARKBOX } })],
    ["wrong principal mark", eventEnvelope([], { principal: { tenantId: TENANT_A, clientId: CLIENT_A, markbox: "OTHER" } })],
    ["bad observation", eventEnvelope([], { observedAt: "invalid" })], ["wrong view", eventEnvelope([], { view: "recent" })],
    ["observation without actual timestamp", eventEnvelope([], { observedAt: "2026" })],
    ["wrong selector", eventEnvelope([], { shipmentId: "foreign" })], ["truncated history", eventEnvelope([], { limit: 8 })],
    ["duplicate event", eventEnvelope([eventRow("same"), eventRow("same")])],
    ["foreign tenant event", eventEnvelope([eventRow("a", { tenantId: TENANT_B })])],
    ["foreign client event", eventEnvelope([eventRow("a", { clientId: "other" })])],
    ["foreign selector event", eventEnvelope([eventRow("a", { shipmentId: "foreign" })])],
    ["missing parent code", eventEnvelope([eventRow("a", { shipmentCode: "" })])],
    ["unknown status", eventEnvelope([eventRow("a", { status: "fabricated" })])],
    ["bad occurrence", eventEnvelope([eventRow("a", { occurredAt: "invalid" })])],
    ["bad note", eventEnvelope([eventRow("a", { note: undefined })])],
    ["unordered tie", eventEnvelope([eventRow("b"), eventRow("a")])],
  ])("%s is unavailable, never an empty successful history or native fallback", async (_label, value) => {
    const double = eventDouble(value);
    await expect(listMyShipmentEvents(double.db, "own-shipment")).rejects.toBeInstanceOf(PortalEventsUnavailableError);
    expect(double.on("shipment_events")).toEqual([]);
  });
  it("valid empty is known absence, while SQL/transport absence is sanitized unavailability", async () => {
    expect(await listMyShipmentEvents(eventDouble().db, "own-shipment")).toEqual([]);
    const absent = eventDouble(null);
    await expect(listMyShipmentEvents(absent.db, "own-shipment")).rejects.toThrow("PORTAL_EVENTOS_NO_DISPONIBLES");
    const failed = portalDouble({ tables: { client_users: [portalMembership()] }, rpc: {
      client_consolidation_portal_events: () => { throw new Error("private SQL/auth/row detail"); },
    } });
    await expect(listMyShipmentEvents(failed.db, "own-shipment")).rejects.toThrow("PORTAL_EVENTOS_NO_DISPONIBLES");
  });
  it.each([0, -1, 1.5, Number.NaN, 2_147_483_648])("invalid feed bound%s is rejected without coercion or RPC", async (limit) => {
    const double = eventDouble();
    await expect(listMyRecentActivity(double.db, limit)).rejects.toBeInstanceOf(PortalEventsUnavailableError);
    expect(double.rpcCalls).toEqual([]);
  });
  it("feed cannot silently accept a wrong bound or excess rows", async () => {
    const wrong = eventDouble(eventEnvelope([], { view: "recent", shipmentId: null, limit: 8 }));
    await expect(listMyRecentActivity(wrong.db, 4)).rejects.toBeInstanceOf(PortalEventsUnavailableError);
    const excess = eventDouble(eventEnvelope(Array.from({ length: 5 }, (_, index) => eventRow(String(5 - index))), { view: "recent", shipmentId: null, limit: 4 }));
    await expect(listMyRecentActivity(excess.db, 4)).rejects.toBeInstanceOf(PortalEventsUnavailableError);
  });
  it("no coherent principal means no domain query or RPC, despite a supplied envelope", async () => {
    for (const members of [[], [portalMembership({ clientTenant: TENANT_B })], [portalMembership(), portalMembership()]]) {
      const double = portalDouble({ tables: { client_users: members }, rpc: { client_consolidation_portal_events: eventEnvelope([eventRow("a")]) } });
      expect(await listMyShipmentEvents(double.db, "own-shipment")).toEqual([]);
      expect(await listMyRecentActivity(double.db)).toEqual([]);
      expect(double.rpcCalls).toEqual([]);
    }
  });
});

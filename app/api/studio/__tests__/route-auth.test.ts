import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  denial: null as string | null,
  from: vi.fn(),
  getShipmentById: vi.fn(),
  getShipmentEvents: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: mocks.from,
  }),
}));

vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => mocks.denial,
}));

vi.mock("@/lib/studio/shipment-queries", () => ({
  getShipmentById: mocks.getShipmentById,
  getShipmentEvents: mocks.getShipmentEvents,
}));

vi.mock("@/lib/studio/conversaciones/messages-queries", () => ({
  listMessages: vi.fn(),
}));

vi.mock("@/lib/studio/conversaciones/conversations-queries", () => ({
  getClientContext: vi.fn(),
  listClientConversationDigests: vi.fn(),
}));

import { GET as getConversation } from "../conversaciones/[id]/route";
import { GET as getKpis } from "../kpis/route";
import {
  DELETE as deleteShipment,
  GET as getShipment,
  PATCH as patchShipment,
} from "../shipments/[id]/route";

const context = { params: Promise.resolve({ id: "shipment-1" }) };

describe("API Studio · sesión y RBAC obligatorios", () => {
  beforeEach(() => {
    mocks.user = null;
    mocks.denial = null;
    mocks.from.mockReset();
    mocks.from.mockImplementation(() => {
      throw new Error("La consulta no debe ejecutarse antes del gate");
    });
    mocks.getShipmentById.mockReset();
    mocks.getShipmentEvents.mockReset();
  });

  it("rechaza sin sesión antes de consultar shipments", async () => {
    const response = await getShipment({} as never, context);
    expect(response.status).toBe(401);
    expect(mocks.getShipmentById).not.toHaveBeenCalled();
  });

  it("rechaza sin sesión antes de consultar KPIs", async () => {
    const response = await getKpis();
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rechaza sin sesión antes de consultar conversaciones", async () => {
    const response = await getConversation({} as never, context);
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rechaza PATCH y DELETE cuando el rol no puede editar tracking", async () => {
    mocks.user = { id: "user-1" };
    mocks.denial = "No tienes permiso para realizar esta acción.";

    const patchResponse = await patchShipment(
      { json: async () => ({ notes: "legítimo" }) } as never,
      context,
    );
    const deleteResponse = await deleteShipment({} as never, context);

    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

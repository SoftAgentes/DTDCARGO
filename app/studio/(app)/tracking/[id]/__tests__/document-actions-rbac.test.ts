import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  denial: null as string | null,
  modules: [] as string[],
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async (_client: unknown, moduleId: string) => {
    mocks.modules.push(moduleId);
    return mocks.denial;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  deleteShipmentDocumentAction,
  uploadShipmentDocumentAction,
} from "../document-actions";

const SHIPMENT_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";

function emptyBuilder() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  return builder;
}

describe("documentos legacy de Tracking · RBAC", () => {
  beforeEach(() => {
    mocks.denial = null;
    mocks.modules = [];
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.from.mockImplementation(() => emptyBuilder());
  });

  it("rechaza subir y borrar antes de consultar el dominio", async () => {
    mocks.denial = "No tienes permiso para realizar esta acción.";

    const upload = await uploadShipmentDocumentAction(
      SHIPMENT_ID,
      {},
      new FormData(),
    );
    const remove = await deleteShipmentDocumentAction(SHIPMENT_ID, DOCUMENT_ID);

    expect(upload.error).toBe(mocks.denial);
    expect(remove.error).toBe(mocks.denial);
    expect(mocks.modules).toEqual(["tracking", "tracking"]);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("con edición permitida conserva los caminos existentes", async () => {
    const upload = await uploadShipmentDocumentAction(
      SHIPMENT_ID,
      {},
      new FormData(),
    );
    const remove = await deleteShipmentDocumentAction(SHIPMENT_ID, DOCUMENT_ID);

    expect(upload.error).toMatch(/tenant/i);
    expect(remove.error).toMatch(/no encontrado/i);
    expect(mocks.modules).toEqual(["tracking", "tracking"]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  principal: null as null | {
    userId: string;
    tenantId: string;
    client: { id: string; markbox: string; name: string };
  },
  legacyClient: { id: "client-a" },
  insert: vi.fn(),
  update: vi.fn(),
  clear: vi.fn(),
  setDefault: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClient: async () => mocks.legacyClient,
  getPortalClientPrincipal: async () => mocks.principal,
}));
vi.mock("@/lib/studio/client-address-queries", () => ({
  insertClientDeliveryAddress: mocks.insert,
  updateClientDeliveryAddress: mocks.update,
  clearDefaultForClient: mocks.clear,
  setDefaultDeliveryAddress: mocks.setDefault,
}));

const {
  addAddressAction,
  updateAddressAction,
  setDefaultAddressAction,
} = await import("./address-actions");

const scope = { tenantId: "tenant-a", markbox: "DTD-0001" };

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("line", "Av. Principal");
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.principal = {
    userId: "portal-user",
    tenantId: "tenant-a",
    client: { id: "client-a", markbox: "DTD-0001", name: "Cliente" },
  };
  mocks.insert.mockResolvedValue({});
  mocks.update.mockResolvedValue(undefined);
  mocks.clear.mockResolvedValue(undefined);
  mocks.setDefault.mockResolvedValue(undefined);
});

describe("SDD0394 · direcciones Portal por principal", () => {
  it("principal inválido corta antes de cualquier helper", async () => {
    mocks.principal = null;
    const result = await addAddressAction({}, form());
    expect(result.ok).toBeUndefined();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it("alta predeterminada pasa scope canónico a clear e insert", async () => {
    const result = await addAddressAction({}, form({ isDefault: "true" }));
    expect(result).toEqual({ ok: true });
    expect(mocks.clear).toHaveBeenCalledWith(expect.anything(), "client-a", scope);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.anything(), "client-a", expect.objectContaining({ line: "Av. Principal" }), scope,
    );
  });

  it("edición pasa tenant, cliente y Shipping Mark al helper", async () => {
    const result = await updateAddressAction({}, form({ addressId: "address-a" }));
    expect(result).toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.anything(),
      "address-a",
      expect.objectContaining({ line: "Av. Principal" }),
      { ...scope, clientId: "client-a" },
    );
  });

  it("predeterminada pasa el scope canónico completo", async () => {
    const data = new FormData();
    data.set("addressId", "address-a");
    await setDefaultAddressAction(data);
    expect(mocks.setDefault).toHaveBeenCalledWith(
      expect.anything(), "client-a", "address-a", scope,
    );
  });
});

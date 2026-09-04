import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAddressAction, type AddressActionState } from "./address-actions";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), createClient: vi.fn(), revalidate: vi.fn(), legacy: vi.fn(),
  getPortalClient: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/portal/portal-queries", () => ({ getPortalClient: mocks.getPortalClient }));
vi.mock("@/lib/studio/client-address-queries", () => ({
  softDeleteClientDeliveryAddress: mocks.legacy,
  insertClientDeliveryAddress: vi.fn(), updateClientDeliveryAddress: vi.fn(),
  clearDefaultForClient: vi.fn(), setDefaultDeliveryAddress: vi.fn(),
}));
const id = "de305d54-75b4-431b-adb2-eb6b9e546014";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function form(value: string | Blob = id) {
  const data = new FormData();
  data.append("addressId", value);
  data.append("tenantId", "untrusted-tenant");
  data.append("clientId", "untrusted-client");
  data.append("correlationId", "untrusted-correlation");
  return data;
}
// Adaptador sólo para RED: ejercicio real del legacy, no fallo por aridad.
function call(data: FormData): Promise<AddressActionState | void> {
  const action = deleteAddressAction as unknown as (...args: unknown[]) => Promise<AddressActionState | void>;
  return action.length === 1 ? action(data) : action({}, data);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.getPortalClient.mockResolvedValue({ id: "own-client" });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});
describe("SDD0377: comando de borrado Portal confirmado", () => {
  it("usa sesión, UUID servidor y RPC estrecha; nunca identidad del body ni legacy", async () => {
    const result = await call(form());
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("delete_portal_delivery_address", {
      p_address_id: id, p_correlation_id: expect.stringMatching(uuid),
    });
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
    expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("/portal/perfil");
  });
  it.each([false, null, undefined, "true", 1])("no falsea éxito para data=%s", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    const result = await call(form());
    expect(result?.ok).not.toBe(true);
    expect(result?.error).toMatch(/intenta|reintenta/i);
    expect(result?.correlationId).toMatch(uuid);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each(["rpc-error", "rpc-reject", "session-reject"])("recupera %s sin filtrar contenido proveedor", async (mode) => {
    const secret = "PRIVATE postal address token";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      if (mode === "rpc-error") mocks.rpc.mockResolvedValue({ data: true, error: { message: secret } });
      if (mode === "rpc-reject") mocks.rpc.mockRejectedValue(new Error(secret));
      if (mode === "session-reject") mocks.createClient.mockRejectedValue(new Error(secret));
      const result = await call(form());
      expect(result?.error).toBeTruthy();
      expect(result?.correlationId).toMatch(uuid);
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
      expect(mocks.revalidate).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it.each(["missing", "empty", "bad", "file", "duplicate"])("rechaza %s antes de abrir sesión", async (mode) => {
    const data = mode === "missing" ? new FormData() : form(mode === "empty" ? "" :
      mode === "bad" ? "not-a-uuid" : mode === "file" ? new Blob(["address"]) : id);
    if (mode === "duplicate") data.append("addressId", id);
    const result = await call(data);
    expect(result?.error).toBeTruthy();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
  it("un fallo de caché posterior no niega una mutación confirmada", async () => {
    mocks.revalidate.mockImplementation(() => { throw new Error("PRIVATE cache failure"); });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await call(form())).toEqual({ ok: true });
      expect(mocks.rpc).toHaveBeenCalledOnce();
      expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE");
    } finally { log.mockRestore(); }
  });
});

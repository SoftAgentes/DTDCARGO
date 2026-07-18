import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests de la server action requestConsolidationAction (SDD-0157, Slice A).
 *
 * Cubre la acceptance: valida el tipo de contenedor (20GP/40GP/40HC), exige un
 * operario CN, llama el RPC con los args correctos y avisa a la oficina
 * (best-effort). createAdminClient / getCurrentOperario / notify / revalidatePath
 * se mockean; la lógica de la action corre real.
 */

const mockGetOperario = vi.fn();
const mockRpc = vi.fn();
const mockRevalidate = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/lib/auth/operario-session", () => ({
  getCurrentOperario: () => mockGetOperario(),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({ rpc: (name: string, args: unknown) => mockRpc(name, args) }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidate(...a),
}));
vi.mock("@/lib/studio/naviera/consolidation-request-notify", () => ({
  notifyConsolidationRequestToOffice: (...a: unknown[]) => mockNotify(...a),
}));

import { requestConsolidationAction } from "../actions";

const OPERARIO = {
  operario_id: "op-1",
  tenant_id: "tenant-1",
  region: "cn",
  display_name: "李伟",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOperario.mockResolvedValue(OPERARIO);
  mockRpc.mockResolvedValue({ data: "cons-123", error: null });
});

describe("requestConsolidationAction", () => {
  it("crea la solicitud con un tipo válido y llama el RPC con los args correctos", async () => {
    const res = await requestConsolidationAction("40HC");
    expect(res.ok).toBe(true);
    expect(res.id).toBe("cons-123");
    expect(mockRpc).toHaveBeenCalledWith("request_consolidation_as_operario", {
      p_operario_id: "op-1",
      p_container_type: "40HC",
    });
    expect(mockRevalidate).toHaveBeenCalledWith("/m/cn/estibar");
    expect(mockNotify).toHaveBeenCalledOnce();
  });

  it("rechaza un tipo de contenedor inválido y NO llama el RPC", async () => {
    const res = await requestConsolidationAction("45HC");
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rechaza tipo vacío", async () => {
    const res = await requestConsolidationAction("");
    expect(res.error).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("exige sesión de operario", async () => {
    mockGetOperario.mockResolvedValueOnce(null);
    const res = await requestConsolidationAction("20GP");
    expect(res.error).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("solo operarios de China pueden solicitar", async () => {
    mockGetOperario.mockResolvedValueOnce({ ...OPERARIO, region: "ve" });
    const res = await requestConsolidationAction("20GP");
    expect(res.error).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("un error del RPC se traduce a mensaje amable y no rompe", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await requestConsolidationAction("40GP");
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

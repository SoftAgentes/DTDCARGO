// @vitest-environment node
/** Complete input/version adapters; real database races have separate oracles. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { planificarCarga } from "@/lib/shared/estiba-plan";
import type { NormalPlanInput } from "@/lib/studio/client-consolidation/types";
const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), scope: vi.fn(), input: vi.fn(), edit: vi.fn(), view: vi.fn(), legacy: vi.fn(), current: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: h.rpc, from: h.from }) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: h.edit, moduleViewDenial: h.view }));
vi.mock("@/lib/studio/client-consolidation/queries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/studio/client-consolidation/queries")>(), readNormalAssociations: h.scope, readNormalPlanInput: h.input,
}));
vi.mock("@/lib/studio/naviera/plan-queries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/studio/naviera/plan-queries")>(), listLotesForPlan: h.legacy, getCurrentPlan: h.current,
}));
import { calcularPlanCargaAction } from "../plan-actions";
const container = "00000000-0000-4000-8000-000000000050";
const reference = "00000000-0000-4000-8000-000000000099";
const source = (): NormalPlanInput => ({ manifestRevision: 4, manifestHash: "full-manifest", groupRevisions: { group: 3 }, previousPlanVersion: 8,
  input: Array.from({ length: 501 }, (_, i) => ({ id: `item-${i}`, markbox: `DTD-${i}`, clientName: null, cajas: 1, cbm: 0.01 })),
  space: { code: "40HC", label: "40' HC", cbmCapacity: 68, cbmAlertCeiling: 66.4, layout: { nx: 3, ny: 2, nz: 3 } } });
beforeEach(() => {
  vi.clearAllMocks(); h.edit.mockResolvedValue(null); h.view.mockResolvedValue(null);
  h.scope.mockResolvedValue({ available: true, containerIds: [container], receiptIds: [], shipmentIds: [], boxIds: [] }); h.input.mockResolvedValue(source());
  h.rpc.mockImplementation(async (name: string) => ({ data: name === "client_consolidation_plan_replay" ? null
    : { outcome: "recorded", reference, versionNo: 9 }, error: null }));
});
describe("cohort load plan", () => {
  it("uses all 501 complete items and max version after invalidation in one save RPC, no legacy flip/insert", async () => {
    expect(await calcularPlanCargaAction(container, reference)).toEqual({ ok: true, versionNo: 9 });
    expect(h.rpc).toHaveBeenLastCalledWith("client_consolidation_save_plan", expect.objectContaining({
      p_expected_revision: 4, p_previous_plan_version: 8, p_manifest_hash: "full-manifest", p_input: source().input,
      p_result: planificarCarga(source().input, source().space), p_reference: reference,
    }));
    expect(h.from).not.toHaveBeenCalled(); expect(h.legacy).not.toHaveBeenCalled(); expect(h.current).not.toHaveBeenCalled();
  });
  it("same item IDs with added load use new fixed measures, never a pieces=1 fallback", async () => {
    const extended = source(); extended.input[0] = { ...extended.input[0], cajas: 7, cbm: 3.125 };
    extended.manifestRevision = 5; extended.groupRevisions = { group: 4 }; h.input.mockResolvedValue(extended);
    await calcularPlanCargaAction(container, reference);
    expect(h.rpc.mock.calls.at(-1)?.[1]).toMatchObject({ p_expected_revision: 5 });
    expect(h.rpc.mock.calls.at(-1)?.[1].p_input[0]).toMatchObject({ id: "item-0", cajas: 7, cbm: 3.125 });
  });
  it("stale calculation rejected by SQL never archives the old plan in a separate request", async () => {
    h.rpc.mockImplementation(async (name: string) => name === "client_consolidation_plan_replay" ? { data: null, error: null }
      : { data: null, error: { hint: "dtd-client-normal", message: "NORMAL_CONFLICT" } });
    expect((await calcularPlanCargaAction(container, reference)).error).toContain("revisión cambió"); expect(h.from).not.toHaveBeenCalled();
  });
  it("historical replay is read before deriving a newer input, including current reader after losing edit", async () => {
    h.edit.mockResolvedValue("Sin edición"); h.rpc.mockResolvedValue({ data: { outcome: "replay", reference, versionNo: 3 }, error: null });
    expect(await calcularPlanCargaAction(container, reference)).toEqual({ ok: true, versionNo: 3 });
    expect(h.input).not.toHaveBeenCalled(); expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.from).not.toHaveBeenCalled();
  });
  it("missing classification or a missing reference cannot fall through to legacy planning", async () => {
    expect((await calcularPlanCargaAction(container)).error).toContain("manifiesto"); expect(h.from).not.toHaveBeenCalled();
    h.scope.mockRejectedValue(new Error("metadata unavailable"));
    expect((await calcularPlanCargaAction(container, reference)).error).toBeTruthy(); expect(h.from).not.toHaveBeenCalled();
  });
});

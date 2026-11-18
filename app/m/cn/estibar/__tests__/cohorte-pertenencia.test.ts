// @vitest-environment node
/** Transport/decoder oracles; actual box/lot selection, locks and rollback need SQL35–38. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), session: vi.fn(), revalidate: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ rpc: h.rpc, from: h.from }) }));
vi.mock("@/lib/auth/operario-session", () => ({ getCurrentOperario: h.session }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("@/lib/studio/naviera/consolidation-request-notify", () => ({ notifyConsolidationRequestToOffice: h.notify }));
import { stuffLotAction, unstuffLotAction, stuffBoxAction, unstuffBoxAction } from "../actions";
const context = (cohort = true) => ({ available: true, complete: true, containerId: "container", cohort, revision: cohort ? 2 : null,
  sealed: false, status: "consolidando", expectedBoxIds: cohort ? ["box"] : [], stowedBoxIds: [],
  missingBoxIds: cohort ? ["box"] : [], unexpectedBoxIds: [], stuffedCount: 0, lotsCount: 0, plan: null });
beforeEach(() => {
  vi.clearAllMocks(); h.session.mockResolvedValue({ operario_id: "operator", tenant_id: "tenant", region: "cn" });
  h.from.mockImplementation(() => { throw new Error("Unexpected generic position write"); });
  h.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "client_consolidation_operario_read" ? context()
    : name === "client_consolidation_annotate_plan" ? { ok: true, annotated: 1 }
    : { ok: true, stuffed: 1, remaining: 0, lot_size: 1, load_order: 0, client_name: "MUST BE REDACTED", normal_revision: 2 } }));
});
describe("normal physical adapters", () => {
  it("uses the real cookie principal and reviewed revision, one physical mutation and separate trace", async () => {
    expect(await stuffLotAction("container", "DTD-B-000123", 1, 1, "plan", true, 2)).toMatchObject({ ok: true, stuffed: 1, clientName: null, normalRevision: 2 });
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(["client_consolidation_operario_read", "client_consolidation_physical", "client_consolidation_annotate_plan"]);
    expect(h.rpc).toHaveBeenNthCalledWith(2, "client_consolidation_physical", { p_operario_id: "operator", p_container_id: "container",
      p_operation: "stow_lot", p_expected_revision: 2, p_code: "DTD-B-000123", p_width: 1, p_count: 1 });
    expect(h.from).not.toHaveBeenCalled();
  });
  it("failed plan annotation preserves visible physical success and never repeats stow", async () => {
    h.rpc.mockImplementation(async (name: string) => name === "client_consolidation_operario_read" ? { data: context(), error: null }
      : name === "client_consolidation_annotate_plan" ? { data: null, error: { hint: "dtd-client-normal", message: "NORMAL_CONFLICT" } }
      : { data: { stuffed: 1, remaining: 0, load_order: 0, normal_revision: 2 }, error: null });
    const result = await stuffLotAction("container", "DTD-B-000123", 0, 1, "old-plan", true, 2);
    expect(result).toMatchObject({ ok: true, warning: expect.stringContaining("quedó registrada") });
    expect(h.rpc.mock.calls.filter(([name]) => name === "client_consolidation_physical")).toHaveLength(1);
    expect(h.from).not.toHaveBeenCalled();
  });
  it.each([undefined, null, 1])("missing/stale reviewed revision %s makes no physical request", async (revision) => {
    expect((await stuffLotAction("container", "DTD-B-000123", 0, null, null, null, revision)).ok).toBeUndefined();
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(["client_consolidation_operario_read"]);
  });
  it.each([null, { ...context(), complete: false }, { ...context(), containerId: "foreign" },
    { ...context(), stowedBoxIds: ["box"], stuffedCount: 0 }, { ...context(), missingBoxIds: [] }])("incomplete coverage does not become legacy", async (data) => {
    h.rpc.mockResolvedValue({ data, error: null }); expect((await stuffLotAction("container", "DTD-B-000123", 0, 1, null, null, 2)).ok).toBeUndefined();
    expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.from).not.toHaveBeenCalled();
  });
  it("known legacy retains the original five-argument RPC and no cohort command", async () => {
    h.rpc.mockImplementation(async (name: string) => ({ data: name === "client_consolidation_operario_read" ? context(false) : { stuffed: 1, remaining: 0 }, error: null }));
    expect((await stuffLotAction("container", "DTD-B-000123", 2, null)).ok).toBe(true);
    expect(h.rpc).toHaveBeenLastCalledWith("stuff_lot_as_operario", { p_operario_id: "operator", p_consolidation_id: "container",
      p_scanned_code: "DTD-B-000123", p_width: 2, p_count: null });
  });
  it("all individual/bulk undo paths use the typed operation for cohort", async () => {
    await stuffBoxAction("container", "DTD-B-000123", { zx: 0, zy: 0, zz: 0 }, { nx: 1, ny: 1, nz: 3 }, false, 2);
    await unstuffBoxAction("container", "DTD-B-000123", 2); await unstuffLotAction("container", 2);
    expect(h.rpc.mock.calls.filter(([name]) => name === "client_consolidation_physical").map(([, args]) => args.p_operation))
      .toEqual(["stow_box", "unstow_box", "unstow_lot"]);
    expect(h.from).not.toHaveBeenCalled();
  });
  it("membership/lot conflict returns a safe explanation, no trace or legacy retry", async () => {
    h.rpc.mockImplementation(async (name: string) => name === "client_consolidation_operario_read" ? { data: context(), error: null }
      : { data: null, error: { hint: "dtd-client-normal", message: "NORMAL_INCOMPATIBLE: foreign private id" } });
    expect((await stuffLotAction("container", "DTD-B-000123", 0, 1, "plan", true, 2)).error).not.toContain("private");
    expect(h.rpc).toHaveBeenCalledTimes(2); expect(h.from).not.toHaveBeenCalled();
  });
  it("a non-CN or expired session cuts before privileged metadata", async () => {
    h.session.mockResolvedValue(null); expect((await unstuffLotAction("container", 2)).ok).toBeUndefined();
    h.session.mockResolvedValue({ region: "ve" }); expect((await unstuffLotAction("container", 2)).ok).toBeUndefined(); expect(h.rpc).not.toHaveBeenCalled();
  });
});

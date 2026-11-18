// @vitest-environment jsdom
/** UI oracles with controlled promises. No database or browser proof. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmMembershipInput, NormalContext, NormalGroup, NormalReceipt } from "@/lib/studio/client-consolidation/types";
const h = vi.hoisted(() => ({ load: vi.fn(), confirm: vi.fn(), close: vi.fn(), plan: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../../actions", () => ({ loadClientManifestAction: h.load, confirmClientShipmentsAction: h.confirm, closeClientManifestAction: h.close }));
vi.mock("../../plan-actions", () => ({ calcularPlanCargaAction: h.plan }));
import { ConfirmarEnviosClienteDrawer } from "../ConfirmarEnviosClienteDrawer";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-10-21T14:00:00Z";
const receipt = (n: number, over: Partial<NormalReceipt> = {}): NormalReceipt => ({ receiptId: id(n), receiptCode: `WR-${n}`, warehouseId: id(8),
  clientId: id(1), clientMarkbox: "DTD-1001", clientName: null, service: "consolidado_lcl", destination: "Valencia",
  sourceVersion: "a".repeat(32), eligible: true, blockedReason: null, shipmentId: null, groupId: null,
  measures: { cbm: "1.125", weightKg: "100.25", boxes: 2 }, rate: null, ...over });
const group = (): NormalGroup => ({ groupId: id(20), shipmentId: id(30), itemId: id(40), clientId: id(1), clientMarkbox: "DTD-1001", clientName: null,
  code: "S-2026-0001", service: "consolidado_lcl", destinationId: id(90), destination: "Valencia", revision: 2, status: "consolidating",
  receiptIds: [id(11)], boxIds: [id(101), id(102)], measures: { cbm: "2.000", weightKg: "200.00", boxes: 2 },
  rates: { membershipRevision: 2, observedAt: now, snapshotIds: [id(80)], receiptCount: 1, missingReceiptIds: [], knownSubtotalCents: "15000", totalCents: "15000", complete: true } });
const context = (groups: NormalGroup[] = []): NormalContext => ({ availability: "ready", complete: true, observedAt: now, readToken: "full-input",
  manifest: { containerId: id(50), revision: groups.length ? 3 : 0, status: "consolidando", sealed: false, sealId: null, canConfirm: true, canClose: true,
    groups, expectedBoxIds: groups.flatMap((entry) => entry.boxIds), stowedBoxIds: [], missingBoxIds: groups.flatMap((entry) => entry.boxIds), unexpectedBoxIds: [], currentPlan: null },
  destinations: [{ id: id(90), destination: "Valencia", label: "Valencia · Carabobo · Valencia" }],
  receipts: [receipt(10, { rate: { snapshotId: id(81), amountCents: "15000" } }), receipt(12)],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
beforeAll(() => Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body }));
afterAll(() => { if (originalOffsetParent) Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.clearAllMocks(); let reference = 200;
  vi.stubGlobal("crypto", { randomUUID: () => id(reference++) });
  h.load.mockResolvedValue({ context: context() }); h.confirm.mockResolvedValue({ error: "La carga o su revisión cambió. Actualiza y revisa la selección." });
  h.plan.mockResolvedValue({ ok: true, versionNo: 2 });
});
async function open() {
  const onClose = vi.fn(); const user = userEvent.setup();
  render(<ConfirmarEnviosClienteDrawer containerId={id(50)} containerRef="DTD-CONSOL-0001" onClose={onClose} />);
  await screen.findByRole("checkbox", { name: /WR-10/ });
  return { user, onClose };
}
async function prepareNew(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Seleccionar todas las compatibles" }));
  await user.type(screen.getByLabelText("Código manual del envío"), " s-2026-0001 ");
  await user.type(screen.getByLabelText("Motivo de la incorporación o del cierre"), "Carga nueva revisada");
  await user.click(screen.getByRole("button", { name: "Revisar incorporación" }));
  return screen.findByRole("heading", { name: "Confirmar incorporación de recepciones" });
}
describe("client shipment membership preparation", () => {
  it("selection is cancelable and creates no durable intention before confirmation", async () => {
    const { user, onClose } = await open();
    await user.click(screen.getByRole("checkbox", { name: /WR-10/ }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1); expect(h.confirm).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled();
  });
  it("reviews canonical code, exact before+delta=after, known subtotal and pending price with focus before a single write", async () => {
    const { user } = await open(); const heading = await prepareNew(user);
    expect(heading).toHaveFocus();
    const review = screen.getByRole("region", { name: "Confirmación de la intención revisada" });
    expect(review).toHaveTextContent("S-2026-0001"); expect(review).toHaveTextContent("4 cajas · 2.250 CBM · 200.50 kg");
    expect(review).toHaveTextContent("Subtotal conocido: 150,00 USD"); expect(review).toHaveTextContent("Total pendiente");
    expect(review).toHaveTextContent("no permite retirarlas"); expect(h.confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar incorporación" }));
    expect(h.confirm).toHaveBeenCalledTimes(1);
    const intent = h.confirm.mock.calls[0][0] as ConfirmMembershipInput;
    expect(intent).toMatchObject({ operation: "form", expectedContainerRevision: 0, groups: [{ code: "S-2026-0001", clientId: id(1) }] });
    expect(intent.groups[0].receipts.map((entry) => entry.receiptId)).toEqual([id(10), id(12)]);
    expect(intent.groups[0]).not.toHaveProperty("cbm");
  });
  it("extends the same group with no new code and retains the exact reference after an uncertain error", async () => {
    h.load.mockResolvedValue({ context: context([group()]) });
    const { user } = await open();
    await user.selectOptions(screen.getByLabelText("Destino de la incorporación"), id(20));
    await user.click(screen.getByRole("checkbox", { name: /WR-12/ }));
    expect(screen.queryByLabelText("Código manual del envío")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Motivo de la incorporación o del cierre"), "Segunda tanda revisada");
    await user.click(screen.getByRole("button", { name: "Revisar incorporación" }));
    await user.click(screen.getByRole("button", { name: "Confirmar incorporación" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Volver a la selección" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Confirmar incorporación" }));
    expect(h.confirm).toHaveBeenCalledTimes(2); expect(h.confirm.mock.calls[0][0]).toEqual(h.confirm.mock.calls[1][0]);
    expect(h.confirm.mock.calls[0][0]).toMatchObject({ operation: "extend", expectedContainerRevision: 3,
      groups: [{ groupId: id(20), expectedGroupRevision: 2, code: null, receipts: [{ receiptId: id(12) }] }] });
  });
  it("pending locks the operation and close; two submissions cannot produce two simultaneous writes", async () => {
    const waiting = deferred<{ error: string }>(); h.confirm.mockReturnValue(waiting.promise);
    const { user, onClose } = await open(); await prepareNew(user);
    const form = screen.getByRole("heading", { name: "Confirmar incorporación de recepciones" }).closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(h.confirm).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Confirmando…" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" }); expect(onClose).not.toHaveBeenCalled();
    await act(async () => waiting.resolve({ error: "Respuesta no comprobada" }));
  });
  it("a failed complete read never offers an editable legacy fallback", async () => {
    h.load.mockResolvedValue({ error: "No se pudo leer el manifiesto completo." });
    render(<ConfirmarEnviosClienteDrawer containerId={id(50)} containerRef="DTD-CONSOL-0001" onClose={vi.fn()} />);
    await screen.findByRole("alert"); expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar incorporación" })).toBeDisabled();
    expect(h.confirm).not.toHaveBeenCalled();
  });
  it("a sealed manifest cannot add members or close again even when an old capability flag says true", async () => {
    const sealed = context([group()]); sealed.manifest!.sealed = true; sealed.manifest!.sealId = id(88); sealed.manifest!.status = "cerrado";
    h.load.mockResolvedValue({ context: sealed });
    render(<ConfirmarEnviosClienteDrawer containerId={id(50)} containerRef="DTD-CONSOL-0001" onClose={vi.fn()} />);
    await screen.findByText(/Manifiesto sellado/);
    expect(screen.getByRole("button", { name: "Revisar incorporación" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Revisar cierre del manifiesto" })).not.toBeInTheDocument();
    expect(h.confirm).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled();
  });
  it("a late response for a previous container cannot replace the current complete read", async () => {
    const old = deferred<{ context: NormalContext }>(); h.load.mockReturnValueOnce(old.promise);
    const view = render(<ConfirmarEnviosClienteDrawer containerId={id(50)} containerRef="Anterior" onClose={vi.fn()} />);
    const current = context(); current.manifest!.containerId = id(51); current.receipts = [receipt(13)]; h.load.mockResolvedValueOnce({ context: current });
    view.rerender(<ConfirmarEnviosClienteDrawer containerId={id(51)} containerRef="Actual" onClose={vi.fn()} />);
    await screen.findByRole("checkbox", { name: /WR-13/ }); await act(async () => old.resolve({ context: context() }));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: /WR-10/ })).not.toBeInTheDocument());
    expect(screen.getByRole("checkbox", { name: /WR-13/ })).toBeInTheDocument(); expect(h.confirm).not.toHaveBeenCalled();
  });
  it("closure requires all expected boxes and reviews the complete sealed object without inventing a shipment transition", async () => {
    const complete = context([group()]); complete.manifest!.stowedBoxIds = [...complete.manifest!.expectedBoxIds]; complete.manifest!.missingBoxIds = [];
    h.load.mockResolvedValue({ context: complete });
    const { user } = await open(); await user.type(screen.getByLabelText("Motivo de la incorporación o del cierre"), "Cobertura revisada completa");
    await user.click(screen.getByRole("button", { name: "Revisar cierre del manifiesto" }));
    expect(screen.getByRole("heading", { name: "Confirmar cierre del manifiesto" })).toHaveFocus();
    expect(within(screen.getByRole("region", { name: "Confirmación de la intención revisada" })).getByText(/no permite reabrirlo/)).toBeInTheDocument();
    h.close.mockResolvedValue({ error: "NORMAL_CONFLICT" }); await user.click(screen.getByRole("button", { name: "Confirmar cierre del manifiesto" }));
    expect(h.close).toHaveBeenCalledWith(expect.objectContaining({ containerId: id(50), expectedContainerRevision: 3, reason: "Cobertura revisada completa" }));
    expect(h.confirm).not.toHaveBeenCalled();
  });
});

/**
 * SDD-0571 · El cajón solo confirma la vista previa de la entrada actual.
 * Las acciones tienen promesas controladas: medimos respuestas fuera de orden,
 * el intervalo de debounce y la recuperación. No se llama a la base.
 */
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RateSnapshot } from "@/lib/studio/rate-snapshots/types";
import type { ShipmentService } from "@/lib/studio/shipment-types";
import type { RateDrawerData } from "../rate-snapshot-actions";

const actions = vi.hoisted(() => ({
  load: vi.fn(),
  preview: vi.fn(),
  freeze: vi.fn(),
  elevated: vi.fn(),
  toast: vi.fn(),
}));
const traducciones = vi.hoisted(() => ({ renders: 0, limite: Infinity }));
// Como useT real: la identidad de la función cambia en cada render.
vi.mock("@/lib/i18n", () => ({ useT: () => {
  // Cota del control rojo: una recarga circular debe fallar, no dejar el
  // proceso bloqueado dentro de act por una cadena infinita de promesas.
  if (++traducciones.renders > traducciones.limite) throw new Error("Ciclo de render por identidad del traductor");
  return (key: string) => key;
} }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: actions.toast }),
}));
vi.mock("../rate-snapshot-actions", () => ({
  loadRateDrawerAction: actions.load,
  previewRateAction: actions.preview,
  freezeRateAction: actions.freeze,
  freezeElevatedRateAction: actions.elevated,
}));
// Conserva form/submit; el campo numérico real sigue montado para ejercitar
// sus cambios controlados. La presentación del cajón requiere revisión visible.
vi.mock("@/app/studio/_components/ui/drawer/DrawerShell", () => ({
  DrawerShell: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  DrawerFooter: ({ formId, canSubmit, isPending, submitLabel }: {
    formId: string; canSubmit: boolean; isPending: boolean; submitLabel: string;
  }) => <button type="submit" form={formId} disabled={!canSubmit || isPending}>{submitLabel}</button>,
}));
import { RateSnapshotDrawer } from "./RateSnapshotDrawer";

const DDP: ShipmentService = "puerta_a_puerta_DDP";
const LCL: ShipmentService = "consolidado_lcl";
const RID = "00000000-0000-4000-8000-000000000001";
const RID2 = "00000000-0000-4000-8000-000000000002";
const Q1 = "00000000-0000-4000-8000-000000000011";
const Q2 = "00000000-0000-4000-8000-000000000012";
const MOTIVO = "Precio acordado para esta carga";
const K = "warehouse_cn.rate.drawer.";
const snapshot = (per = 850, service: ShipmentService = DDP, receiptId = RID): RateSnapshot => ({
  id: "snapshot", receipt_id: receiptId, shipment_id: null, client_id: "client", client_markbox: "DTD-0001",
  service, destination: "Valencia", source: "casa", rate_origin: null, rate_id: `rate-${service}`,
  price_book_id: "house", quote_id: null, discount_pct: null, per_cbm: per, min_charge: 0,
  cbm: 2, weight_kg: null, included_kg_per_cbm: 500, amount_to_invoice: 2 * per, excess_weight_kg: 0,
  reason: null, frozen_at: "", frozen_by: null, superseded_at: null, superseded_by_id: null,
});
const drawerData = (per = 850, service: ShipmentService = DDP, receiptId = RID): RateDrawerData => ({
  ok: true, receiptCode: receiptId === RID ? "WR-1" : "WR-2", currentCbm: 2, live: null, history: [],
  propuesta: { kind: "tarifario", rateId: `rate-${service}`, origen: "casa", bookName: "Casa", service },
  preview: snapshot(per, service, receiptId), previewErrorKey: null, canElevate: true, canFreeze: true,
  acceptedQuotes: [
    { id: Q1, quote_code: "EST-1", rate_per_cbm: 800, service: DDP },
    { id: Q2, quote_code: "EST-2", rate_per_cbm: 900, service: DDP },
  ],
});
type PreviewResult = { ok: true; snapshot: RateSnapshot } | { ok: false; errorKey: string };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function abrir() {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<RateSnapshotDrawer receiptId={RID} receiptCode="WR-1" onClose={() => {}} />);
  });
  return view;
}
const submit = () => screen.getByRole("button", { name: K + "submit_freeze" });
function intentarConPreviewInvalida() {
  expect(submit()).toBeDisabled();
  // También ejercita onSubmit: un evento de formulario no debe saltar la
  // protección solo porque el botón deshabilitado no se pueda pulsar.
  fireEvent.submit(document.querySelector("form")!);
  expect(actions.freeze).not.toHaveBeenCalled();
  expect(actions.elevated).not.toHaveBeenCalled();
}
function manual(per = 800) {
  fireEvent.click(screen.getByRole("radio", { name: K + "mode_manual" }));
  fireEvent.change(screen.getByLabelText(K + "per_cbm"), { target: { value: String(per) } });
  fireEvent.change(screen.getByLabelText(K + "reason"), { target: { value: MOTIVO } });
}
async function debounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}

beforeEach(() => {
  vi.useFakeTimers();
  traducciones.renders = 0;
  traducciones.limite = Infinity;
  for (const action of Object.values(actions)) action.mockReset();
  actions.load.mockResolvedValue(drawerData());
  actions.preview.mockResolvedValue({ ok: true, snapshot: snapshot(800) });
  actions.freeze.mockResolvedValue({ ok: false, errorKey: "warehouse_cn.rate.err.generic" });
  actions.elevated.mockResolvedValue({ ok: false, errorKey: "warehouse_cn.rate.err.generic" });
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("RateSnapshotDrawer · vigencia de la vista previa", () => {
  it("cambiar el precio invalida inmediatamente el importe y el submit durante debounce y petición", async () => {
    await abrir();
    manual();
    await debounce();
    expect(screen.getByText("$1,600.00")).toBeInTheDocument();
    expect(submit()).toBeEnabled();

    const siguiente = deferred<PreviewResult>();
    actions.preview.mockReturnValueOnce(siguiente.promise);
    fireEvent.change(screen.getByLabelText(K + "per_cbm"), { target: { value: "900" } });
    expect(screen.queryByText("$1,600.00")).not.toBeInTheDocument();
    expect(screen.getByText(K + "preview_loading")).toBeInTheDocument();
    intentarConPreviewInvalida();
    await debounce();
    expect(actions.preview).toHaveBeenLastCalledWith(expect.objectContaining({ perCbm: 900 }));
    intentarConPreviewInvalida();

    await act(async () => { siguiente.resolve({ ok: true, snapshot: snapshot(900) }); });
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
    await act(async () => { fireEvent.click(submit()); });
    expect(actions.elevated).toHaveBeenCalledTimes(1);
    expect(actions.elevated).toHaveBeenCalledWith(expect.objectContaining({ perCbm: 900, reason: MOTIVO }));
  });

  it("una respuesta de preview anterior no reemplaza la que llegó para la entrada actual", async () => {
    const anterior = deferred<PreviewResult>();
    const actual = deferred<PreviewResult>();
    actions.preview.mockReturnValueOnce(anterior.promise).mockReturnValueOnce(actual.promise);
    await abrir();
    manual(800);
    await debounce();
    fireEvent.change(screen.getByLabelText(K + "per_cbm"), { target: { value: "900" } });
    await debounce();
    await act(async () => { actual.resolve({ ok: true, snapshot: snapshot(900) }); });
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    await act(async () => { anterior.resolve({ ok: true, snapshot: snapshot(800) }); });
    expect(screen.queryByText("$1,600.00")).not.toBeInTheDocument();
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it("volver al precio anterior exige una nueva preview de esa edición", async () => {
    await abrir();
    manual(800);
    await debounce();
    expect(submit()).toBeEnabled();
    const intermedia = deferred<PreviewResult>();
    const actual = deferred<PreviewResult>();
    actions.preview.mockReturnValueOnce(intermedia.promise).mockReturnValueOnce(actual.promise);
    fireEvent.change(screen.getByLabelText(K + "per_cbm"), { target: { value: "900" } });
    await debounce();
    fireEvent.change(screen.getByLabelText(K + "per_cbm"), { target: { value: "800" } });
    expect(screen.queryByText("$1,600.00")).not.toBeInTheDocument();
    intentarConPreviewInvalida();
    await debounce();
    await act(async () => { intermedia.resolve({ ok: true, snapshot: snapshot(900) }); });
    intentarConPreviewInvalida();
    await act(async () => { actual.resolve({ ok: true, snapshot: snapshot(800) }); });
    expect(screen.getByText("$1,600.00")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
    expect(actions.preview).toHaveBeenCalledTimes(3);
  });

  it.each(["respuesta", "rechazo"] as const)("una preview fallida (%s) impide congelar y se recupera al corregir", async (fallo) => {
    const pendiente = deferred<PreviewResult>();
    actions.preview.mockReturnValueOnce(pendiente.promise);
    await abrir();
    manual();
    await debounce();
    await act(async () => {
      if (fallo === "respuesta") pendiente.resolve({ ok: false, errorKey: "warehouse_cn.rate.err.generic" });
      else pendiente.reject(new Error("fallo simulado"));
    });
    expect(screen.getByText("warehouse_cn.rate.err.generic")).toBeInTheDocument();
    intentarConPreviewInvalida();
    actions.preview.mockResolvedValueOnce({ ok: true, snapshot: snapshot(900) });
    fireEvent.change(screen.getByLabelText(K + "per_cbm"), { target: { value: "900" } });
    expect(screen.queryByText("warehouse_cn.rate.err.generic")).not.toBeInTheDocument();
    intentarConPreviewInvalida();
    await debounce();
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it("una propuesta cuya preview de carga falló no habilita el envío", async () => {
    actions.load.mockResolvedValue({ ...drawerData(), preview: null, previewErrorKey: "warehouse_cn.rate.err.rate_expired" });
    await abrir();
    expect(screen.getByText("warehouse_cn.rate.err.rate_expired")).toBeInTheDocument();
    intentarConPreviewInvalida();
  });

  it("cambiar el estimado tampoco permite confirmar la preview del anterior", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: K + "mode_quote" }));
    fireEvent.change(screen.getByLabelText(K + "quote"), { target: { value: Q1 } });
    await debounce();
    expect(screen.getByText("$1,600.00")).toBeInTheDocument();
    const siguiente = deferred<PreviewResult>();
    actions.preview.mockReturnValueOnce(siguiente.promise);
    fireEvent.change(screen.getByLabelText(K + "quote"), { target: { value: Q2 } });
    expect(screen.queryByText("$1,600.00")).not.toBeInTheDocument();
    intentarConPreviewInvalida();
    await debounce();
    await act(async () => { siguiente.resolve({ ok: true, snapshot: snapshot(900) }); });
    await act(async () => { fireEvent.click(submit()); });
    expect(actions.freeze).toHaveBeenCalledWith(expect.objectContaining({ quoteId: Q2, source: "estimado" }));
    expect(actions.elevated).not.toHaveBeenCalled();
  });

  it("cambiar solo un motivo válido conserva los números y no vuelve a pedir preview", async () => {
    await abrir();
    manual();
    await debounce();
    fireEvent.change(screen.getByLabelText(K + "reason"), { target: { value: "Otro motivo suficientemente largo" } });
    await debounce();
    expect(actions.preview).toHaveBeenCalledTimes(1);
    expect(screen.getByText("$1,600.00")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it.each(["recepción", "servicio"] as const)("una preview de otra %s no sustituye la actual", async (cambio) => {
    const anterior = deferred<PreviewResult>();
    const actual = deferred<PreviewResult>();
    actions.preview.mockReturnValueOnce(anterior.promise).mockReturnValueOnce(actual.promise);
    const view = await abrir();
    manual();
    await debounce();
    const nuevoReceipt = cambio === "recepción" ? RID2 : RID;
    const nuevoServicio = cambio === "servicio" ? LCL : DDP;
    actions.load.mockResolvedValueOnce(drawerData(900, nuevoServicio, nuevoReceipt));
    await act(async () => {
      if (cambio === "recepción") {
        view.rerender(<RateSnapshotDrawer receiptId={RID2} receiptCode="WR-2" onClose={() => {}} />);
      } else {
        fireEvent.change(screen.getByLabelText(K + "service"), { target: { value: LCL } });
      }
    });
    intentarConPreviewInvalida();
    await debounce();
    expect(actions.preview).toHaveBeenLastCalledWith(expect.objectContaining({ receiptId: nuevoReceipt, service: nuevoServicio }));
    await act(async () => { actual.resolve({ ok: true, snapshot: snapshot(900, nuevoServicio, nuevoReceipt) }); });
    await act(async () => { anterior.resolve({ ok: true, snapshot: snapshot(800) }); });
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    expect(screen.queryByText("$1,600.00")).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(submit()); });
    expect(actions.elevated).toHaveBeenCalledWith(expect.objectContaining({ receiptId: nuevoReceipt, service: nuevoServicio }));
  });
});

describe("RateSnapshotDrawer · vigencia de la carga", () => {
  it("los renders del formulario no repiten la carga por la identidad del traductor", async () => {
    traducciones.limite = 100;
    await abrir();
    manual();
    await debounce();
    fireEvent.change(screen.getByLabelText(K + "reason"), { target: { value: "Otro motivo suficientemente largo" } });
    expect(actions.load).toHaveBeenCalledTimes(1);
    expect(screen.getByText("$1,600.00")).toBeInTheDocument();
  });

  it("DDP → LCL → DDP conserva la última selección si LCL responde al final", async () => {
    await abrir();
    const lcl = deferred<RateDrawerData>();
    const ddp = deferred<RateDrawerData>();
    actions.load.mockReturnValueOnce(lcl.promise).mockReturnValueOnce(ddp.promise);
    fireEvent.change(screen.getByLabelText(K + "service"), { target: { value: LCL } });
    intentarConPreviewInvalida();
    fireEvent.change(screen.getByLabelText(K + "service"), { target: { value: DDP } });
    await act(async () => { ddp.resolve(drawerData(900, DDP)); });
    await act(async () => { lcl.resolve(drawerData(580, LCL)); });
    expect(actions.load).toHaveBeenNthCalledWith(2, RID, LCL);
    expect(actions.load).toHaveBeenNthCalledWith(3, RID, DDP);
    expect(screen.getByLabelText(K + "service")).toHaveValue(DDP);
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    expect(screen.queryByText("$1,160.00")).not.toBeInTheDocument();
    expect(submit()).toBeEnabled();
    await act(async () => { fireEvent.click(submit()); });
    expect(actions.freeze).toHaveBeenCalledWith(expect.objectContaining({ service: DDP, rateId: `rate-${DDP}` }));
  });

  it("una respuesta de otra recepción no sustituye la recepción actual", async () => {
    const primera = deferred<RateDrawerData>();
    const segunda = deferred<RateDrawerData>();
    actions.load.mockReturnValueOnce(primera.promise).mockReturnValueOnce(segunda.promise);
    const view = await abrir();
    await act(async () => {
      view.rerender(<RateSnapshotDrawer receiptId={RID2} receiptCode="WR-2" onClose={() => {}} />);
    });
    await act(async () => { segunda.resolve(drawerData(900, DDP, RID2)); });
    await act(async () => { primera.resolve(drawerData(850)); });
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    expect(screen.queryByText("$1,700.00")).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(submit()); });
    expect(actions.freeze).toHaveBeenCalledWith(expect.objectContaining({ receiptId: RID2 }));
  });

  it("una carga fallida impide usar la propuesta anterior y una nueva carga permite continuar", async () => {
    await abrir();
    const fallida = deferred<RateDrawerData>();
    actions.load.mockReturnValueOnce(fallida.promise);
    fireEvent.change(screen.getByLabelText(K + "service"), { target: { value: LCL } });
    await act(async () => { fallida.reject(new Error("fallo de carga simulado")); });
    expect(screen.getAllByText("warehouse_cn.rate.err.generic").length).toBeGreaterThan(0);
    intentarConPreviewInvalida();
    actions.load.mockResolvedValueOnce(drawerData(900));
    await act(async () => {
      fireEvent.change(screen.getByLabelText(K + "service"), { target: { value: DDP } });
    });
    expect(screen.queryByText("warehouse_cn.rate.err.generic")).not.toBeInTheDocument();
    expect(screen.getByText("$1,800.00")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });
});

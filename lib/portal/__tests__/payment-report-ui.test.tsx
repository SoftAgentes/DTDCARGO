/** SDD-0365 · consumidores reales, recibos sintéticos y ninguna E/S externa. */
import { Component, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentReport } from "@/lib/portal/payment-report-types";
import type { PaymentCommandReceipt } from "@/lib/portal/payment-report-commands";

const mocks = vi.hoisted(() => ({ report: vi.fn(), cancel: vi.fn(), resolve: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/portal/(app)/facturas/[code]/reportar/actions", () => ({
  reportPaymentAction: mocks.report,
  cancelPaymentReportAction: mocks.cancel,
}));
vi.mock("@/app/studio/(app)/facturacion/payment-report-actions", () => ({ resolvePaymentReport: mocks.resolve }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

import { PaymentReportForm } from "@/app/portal/(app)/facturas/[code]/reportar/PaymentReportForm";
import { InvoicePaymentReports } from "@/app/portal/(app)/facturas/[code]/_components/InvoicePaymentReports";
import { StudioInvoicePaymentReports } from "@/app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";

const CODE = "FAC-UI-0365";
const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REASON = "Comprobante revisado con el cliente";
const KNOWN_ERROR = "La operación no se aplicó. Conserva este intento.";
const UNCERTAIN_ERROR = "No pudimos confirmar el resultado. Reintenta el mismo intento.";
const SUCCESS = /^reporte (enviado|registrado)\.$/i;
// SDD-0630: cuentas de caja inventadas. Con una sola, el Studio la deja elegida.
const CASH = { id: "44444444-4444-4444-8444-444444444444", code: "1.1.1.01", name: "Caja sintética" };
const BANK = { id: "66666666-6666-4666-8666-666666666666", code: "1.1.1.02", name: "Banco sintético" };
type Surface = "portal" | "studio";
type User = ReturnType<typeof userEvent.setup>;

const report: PaymentReport = {
  id: REPORT_ID, invoiceId: INVOICE_ID, invoiceCode: CODE, clientMarkbox: "DTD-TEST",
  amount: 120.5, currency: "USD", method: "transferencia", paidAt: "2026-09-01",
  proofPath: null, status: "reportado", note: "Referencia original del cliente",
  confirmedBy: null, confirmedAt: null, cancelledAt: null, cancelledBy: null,
  resolutionReason: null, createdAt: "2026-09-01T12:00:00Z",
};

// Un throw no contenido debe fallar la aserción de recuperación, no contaminar
// otros casos con un error React sin capturar. No sustituye ningún componente.
class UiBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div role="alert">Fallo no contenido por la UI</div> : this.props.children; }
}
function mount(ui: ReactNode) {
  return render(<UiBoundary>{ui}</UiBoundary>, { onCaughtError: () => undefined });
}
function mountForm() {
  return mount(<PaymentReportForm invoiceCode={CODE} currency="USD" todayIso="2026-09-02" />);
}
function mountReports(surface: Surface, value: PaymentReport = report) {
  return mount(surface === "portal"
    ? <InvoicePaymentReports invoiceCode={CODE} reports={[value]} />
    : <StudioInvoicePaymentReports items={[{ report: value, proofUrl: null }]} cashAccounts={[CASH]} />);
}
function receipt(requestId: string, reportId: string, status: PaymentReport["status"] = "reportado", cancelled = false): PaymentCommandReceipt {
  return { requestId, reportId, invoiceId: INVOICE_ID, invoiceCode: CODE, status, cancelled,
    auditEventId: "33333333-3333-4333-8333-333333333333", replayed: false };
}
function formSuccess(_code: string, _previous: unknown, data: FormData) {
  return Promise.resolve({ ok: true, receipt: receipt(String(data.get("request_id")), String(data.get("report_id"))) });
}
function commandSuccess(surface: Surface) {
  if (surface === "portal") {
    mocks.cancel.mockImplementation((_code: string, _previous: unknown, data: FormData) => Promise.resolve({
      ok: true, receipt: receipt(String(data.get("request_id")), String(data.get("report_id")), "reportado", true),
    }));
  } else {
    mocks.resolve.mockImplementation((id: string, action: "confirmado" | "rechazado", _reason: string, requestId: string) => Promise.resolve({
      ok: true, receipt: receipt(requestId, id, action),
    }));
  }
}
async function fillForm(user: User) {
  const file = new File(["comprobante sintetico 0365"], "comprobante.png", { type: "image/png" });
  await user.type(screen.getByLabelText(/monto pagado/i), "120.50");
  await user.selectOptions(screen.getByLabelText(/cómo pagaste/i), "transferencia");
  fireEvent.change(screen.getByLabelText(/fecha del pago/i), { target: { value: "2026-09-01" } });
  await user.type(screen.getByLabelText(/^nota/i), "Referencia original del cliente");
  const input = screen.getByLabelText(/^comprobante$/i) as HTMLInputElement;
  const nativeFiles = input.files!;
  await user.upload(input, file);
  // jsdom29 carece de DataTransfer. user-event cambia el getter público, pero
  // su FileList de fachada no llega al FormData/validity nativo de jsdom.
  // Se completa el fixture nativo (no se sustituye FormData ni ningún método).
  const implKey = (value: object) => Object.getOwnPropertySymbols(value).find((key) => key.description === "impl");
  const listKey = implKey(nativeFiles);
  const fileKey = implKey(file);
  if (!listKey || !fileKey) throw new Error("El fixture FileList de jsdom cambió; revisar sin simular FormData.");
  (Reflect.get(nativeFiles, listKey) as unknown[]).push(Reflect.get(file, fileKey));
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")!.set!.call(input, nativeFiles);
  expect(new FormData(input.form!).get("proof")).toBe(file);
  return file;
}
function formDataAt(index: number) { return mocks.report.mock.calls[index][2] as FormData; }
async function submitForm() {
  // jsdom no sincroniza la validez nativa de file con userEvent.upload.
  // El submit real conserva el FormData/React action; no se simula el componente.
  const form = screen.getByLabelText(/monto pagado/i).closest("form");
  expect(form).not.toBeNull();
  await act(async () => { fireEvent.submit(form!); });
}
function expectFormValues(file: File) {
  expect(screen.getByLabelText(/monto pagado/i)).toHaveValue(120.5);
  expect(screen.getByLabelText(/cómo pagaste/i)).toHaveValue("transferencia");
  expect(screen.getByLabelText(/fecha del pago/i)).toHaveValue("2026-09-01");
  expect(screen.getByLabelText(/^nota/i)).toHaveValue(report.note);
  expect((screen.getByLabelText(/^comprobante$/i) as HTMLInputElement).files?.[0]).toBe(file);
}
function actionMock(surface: Surface) { return surface === "portal" ? mocks.cancel : mocks.resolve; }
async function openDialog(user: User, surface: Surface, verb: "confirmado" | "rechazado" = "confirmado") {
  await user.click(screen.getByRole("button", { name: surface === "portal" ? /cancelar reporte|reintentar.*cancel/i : verb === "confirmado" ? /confirmar pago|reintentar.*confirm/i : /^rechazar$|reintentar.*rechaz/i }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog.tagName).toBe("FORM"); // ConfirmDialog canonical, no window.confirm ni overlay simulado.
  return dialog;
}
function dialogSubmit(dialog: HTMLElement) {
  const button = dialog.querySelector<HTMLButtonElement>('button[type="submit"]');
  expect(button).not.toBeNull();
  return button!;
}
function attemptAt(surface: Surface, index: number) {
  const args = actionMock(surface).mock.calls[index];
  if (surface === "portal") {
    const data = args[2] as FormData;
    return { reportId: data.get("report_id"), requestId: data.get("request_id"), reason: data.get("reason") };
  }
  return { reportId: args[0], requestId: args[3], reason: args[2] };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function expectNoCrash() {
  expect(screen.queryByText("Fallo no contenido por la UI")).not.toBeInTheDocument();
}
function expectTerminalAbsent(surface: Surface) {
  expect(screen.queryByText(surface === "portal" ? /^cancelado$/i : /^pago confirmado$/i)).not.toBeInTheDocument();
}
async function expectTerminal(surface: Surface, verb: "confirmado" | "rechazado" = "confirmado") {
  // Studio conserva el badge y anuncia la misma transición en role=status.
  const label = surface === "portal" ? /^cancelado$/i : verb === "confirmado" ? /^pago confirmado$/i : /^reporte rechazado$/i;
  expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
}
function expectOwnNavigationBlocked() {
  const cancel = screen.getByText(/^(cancelar|volver a la factura)$/i);
  if (cancel instanceof HTMLButtonElement) expect(cancel).toBeDisabled();
  else {
    expect(cancel).toHaveAttribute("aria-disabled", "true");
    if (cancel instanceof HTMLAnchorElement && cancel.hasAttribute("href")) {
      expect(fireEvent.click(cancel)).toBe(false);
    }
  }
  expect(mocks.push).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.report.mockResolvedValue({ error: KNOWN_ERROR, uncertain: false });
  mocks.cancel.mockResolvedValue({ error: KNOWN_ERROR, uncertain: false });
  mocks.resolve.mockResolvedValue({ error: KNOWN_ERROR, uncertain: false });
});
afterEach(cleanup);

describe("SDD-0365 · alta conserva el intento", () => {
  it("C1: recovery reenvía por botón la fecha aceptada ahora futura con los mismos IDs, payload y prueba", async () => {
    const user = userEvent.setup();
    mocks.report.mockResolvedValueOnce({ error: UNCERTAIN_ERROR, uncertain: true }).mockImplementationOnce(formSuccess);
    const view = mountForm();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /^reportar pago$/i }));
    await screen.findByText(UNCERTAIN_ERROR);
    const first = formDataAt(0);
    view.rerender(<UiBoundary><PaymentReportForm invoiceCode={CODE} currency="USD" todayIso="2026-08-31" /></UiBoundary>);
    expect(screen.getByLabelText(/fecha del pago/i)).toHaveAttribute("max", "2026-08-31");
    expect(screen.getByLabelText(/fecha del pago/i)).toHaveValue("2026-09-01");
    await user.click(screen.getByRole("button", { name: /reintentar el mismo envío/i }));
    await screen.findByText(SUCCESS);
    for (const key of ["request_id", "report_id", "amount", "method", "paid_at", "note", "proof"]) {
      expect(formDataAt(1).get(key)).toBe(first.get(key));
    }
  });

  it("conserva valores y archivo tras un rechazo conocido", async () => {
    const user = userEvent.setup();
    mountForm();
    const file = await fillForm(user);
    await submitForm();
    await screen.findByText(KNOWN_ERROR);
    expectFormValues(file);
    expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();
  });

  it("envía UUID canónicos y conserva request_id/report_id al reintentar", async () => {
    const user = userEvent.setup();
    mountForm();
    await fillForm(user);
    await submitForm();
    await screen.findByText(KNOWN_ERROR);
    const first = formDataAt(0);
    expect(first.get("request_id")).toMatch(UUID);
    expect(first.get("report_id")).toMatch(UUID);
    await submitForm();
    await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(2));
    expect(formDataAt(1).get("request_id")).toBe(first.get("request_id"));
    expect(formDataAt(1).get("report_id")).toBe(first.get("report_id"));
    expect(formDataAt(1).get("proof")).toBe(first.get("proof"));
  });

  it("un resultado incierto congela datos/archivo y reenvía el mismo snapshot", async () => {
    const user = userEvent.setup();
    mocks.report.mockResolvedValueOnce({ error: UNCERTAIN_ERROR, uncertain: true }).mockImplementationOnce(formSuccess);
    mountForm();
    const file = await fillForm(user);
    await submitForm();
    await screen.findByText(UNCERTAIN_ERROR);
    expectFormValues(file);
    for (const label of [/monto pagado/i, /cómo pagaste/i, /fecha del pago/i, /^nota/i, /^comprobante$/i]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: /reintentar el mismo envío/i })).toBeEnabled();
    const first = formDataAt(0);
    await submitForm();
    await screen.findByText(SUCCESS);
    const retry = formDataAt(1);
    for (const key of ["request_id", "report_id", "amount", "method", "paid_at", "note", "proof"]) {
      expect(retry.get(key)).toBe(first.get(key));
    }
  });

  it("pending bloquea doble envío, campos y navegación propia", async () => {
    const user = userEvent.setup();
    const gate = deferred<{ error: string; uncertain: boolean }>();
    mocks.report.mockImplementationOnce(() => gate.promise);
    mountForm();
    await fillForm(user);
    try {
      await submitForm();
      await submitForm();
      await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("button", { name: /enviando|procesando/i })).toBeDisabled();
      for (const label of [/monto pagado/i, /cómo pagaste/i, /fecha del pago/i, /^nota/i, /^comprobante$/i]) {
        expect(screen.getByLabelText(label)).toBeDisabled();
      }
      expectOwnNavigationBlocked();
    } finally {
      await act(async () => { gate.resolve({ error: KNOWN_ERROR, uncertain: false }); });
    }
  });

  it("sólo presenta éxito con el recibo del mismo alta", async () => {
    const user = userEvent.setup();
    mocks.report.mockImplementation(formSuccess);
    mountForm();
    await fillForm(user);
    await submitForm();
    expect(await screen.findByText(SUCCESS)).toBeInTheDocument();
    expect(screen.queryByLabelText(/monto pagado/i)).not.toBeInTheDocument();
    expect(mocks.report).toHaveBeenCalledTimes(1);
  });

  it("vacío, ok sin recibo, throw, error y recibos incompatibles no producen éxito ni pierden el intento", async () => {
    const user = userEvent.setup();
    mocks.report.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("fallo sintético de transporte"))
      .mockResolvedValueOnce({ error: KNOWN_ERROR, uncertain: false })
      .mockImplementationOnce((_code: string, _previous: unknown, data: FormData) => Promise.resolve({
        ok: true, receipt: receipt("44444444-4444-4444-8444-444444444444", String(data.get("report_id"))),
      }))
      .mockImplementationOnce((_code: string, _previous: unknown, data: FormData) => Promise.resolve({
        ok: true, receipt: receipt(String(data.get("request_id")), String(data.get("report_id")), "confirmado"),
      }));
    mountForm();
    const file = await fillForm(user);
    for (let index = 0; index < 6; index++) {
      await submitForm();
      await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(index + 1));
      expect(await screen.findByRole("alert")).not.toBeEmptyDOMElement();
      expectNoCrash();
      expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();
      expectFormValues(file);
      expect(screen.getByLabelText(/monto pagado/i)).toBeDisabled();
      expect(screen.getByLabelText(/^comprobante$/i)).toBeDisabled();
      expect(screen.getByRole("button", { name: /reintentar/i })).toBeEnabled();
      expect(formDataAt(index).get("request_id")).toBe(formDataAt(0).get("request_id"));
      expect(formDataAt(index).get("report_id")).toBe(formDataAt(0).get("report_id"));
    }
  });

  it("ok true junto con error y recibo ajeno nunca entra en la pantalla de éxito", async () => {
    const user = userEvent.setup();
    mocks.report.mockImplementation((_code: string, _previous: unknown, data: FormData) => Promise.resolve({
      ok: true, error: KNOWN_ERROR,
      receipt: receipt("44444444-4444-4444-8444-444444444444", String(data.get("report_id"))),
    }));
    mountForm();
    const file = await fillForm(user);
    await submitForm();
    expect(screen.queryByText(SUCCESS)).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(KNOWN_ERROR);
    expectFormValues(file);
  });
});

it("ConfirmDialog normal activa una sola confirmación con Space", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  mount(<ConfirmDialog open title="Confirmar pago" message="La factura conservará su historial." onCancel={vi.fn()} onConfirm={onConfirm} />);
  screen.getByRole("button", { name: /^confirmar$/i }).focus();
  await user.keyboard(" ");
  expect(onConfirm).toHaveBeenCalledExactlyOnceWith("");
});

describe("SDD-0365 · confirmación explícita", () => {
  it.each([
    { surface: "portal" as const, verb: "confirmado" as const, label: "cancelar" },
    { surface: "studio" as const, verb: "confirmado" as const, label: "confirmar" },
    { surface: "studio" as const, verb: "rechazado" as const, label: "rechazar" },
  ])("$surface/$label exige contexto, confirmación y motivo de 4–500 caracteres", async ({ surface, verb }) => {
    const user = userEvent.setup();
    commandSuccess(surface);
    mountReports(surface);
    const dialog = await openDialog(user, surface, verb);
    expect(actionMock(surface)).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent(CODE);
    expect(dialog).toHaveTextContent(/120[.,]50/);
    const reason = within(dialog).getByLabelText(/motivo/i);
    for (const invalid of ["", "abc", "x".repeat(501)]) {
      fireEvent.input(reason, { target: { value: invalid } });
      await user.click(dialogSubmit(dialog));
      expect(actionMock(surface)).not.toHaveBeenCalled();
    }
    fireEvent.input(reason, { target: { value: "Pago" } });
    reason.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(actionMock(surface)).toHaveBeenCalledTimes(1));
    expect(attemptAt(surface, 0)).toEqual({ reportId: REPORT_ID, requestId: expect.stringMatching(UUID), reason: "Pago" });
    if (surface === "studio") expect(mocks.resolve.mock.calls[0][1]).toBe(verb);
    await expectTerminal(surface, verb);
  });

  it.each(["portal", "studio"] as const)("%s bloquea doble click/Escape/cancel pending y recupera el mismo intento tras rechazo", async (surface) => {
    const user = userEvent.setup();
    const gate = deferred<{ error: string; uncertain: boolean }>();
    commandSuccess(surface);
    actionMock(surface).mockImplementationOnce(() => gate.promise);
    mountReports(surface);
    let dialog!: HTMLElement;
    try {
      // La implementación antigua ejecuta al pulsar el trigger: el finally
      // también libera esa promesa si falla la aserción de diálogo inicial.
      dialog = await openDialog(user, surface);
      fireEvent.input(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
      await user.dblClick(dialogSubmit(dialog));
      await waitFor(() => expect(actionMock(surface)).toHaveBeenCalledTimes(1));
      expect(dialogSubmit(dialog)).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: /^cancelar$/i })).toBeDisabled();
      expect(within(dialog).getByLabelText(/motivo/i)).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog")).toBe(dialog);
      fireEvent.submit(dialog);
      expect(actionMock(surface)).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => { gate.resolve({ error: KNOWN_ERROR, uncertain: false }); });
    }
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(KNOWN_ERROR);
    expect(within(dialog).getByLabelText(/motivo/i)).toHaveValue(REASON);
    await user.click(dialogSubmit(dialog));
    await waitFor(() => expect(actionMock(surface)).toHaveBeenCalledTimes(2));
    expect(attemptAt(surface, 1)).toEqual(attemptAt(surface, 0));
    await expectTerminal(surface);
  });

  it.each(["portal", "studio"] as const)("%s conserva motivo/clave de resultado incierto incluso al cerrar y reabrir", async (surface) => {
    const user = userEvent.setup();
    commandSuccess(surface);
    actionMock(surface).mockResolvedValueOnce({ error: UNCERTAIN_ERROR, uncertain: true });
    mountReports(surface);
    let dialog = await openDialog(user, surface);
    fireEvent.input(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    await user.click(dialogSubmit(dialog));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(UNCERTAIN_ERROR);
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent(REASON);
    const first = attemptAt(surface, 0);
    await user.click(within(dialog).getByRole("button", { name: /^(cancelar|volver|cerrar)$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(UNCERTAIN_ERROR);
    dialog = await openDialog(user, surface);
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent(REASON);
    expect(actionMock(surface)).toHaveBeenCalledTimes(1);
    expect(dialogSubmit(dialog)).toHaveTextContent(/reintentar/i);
    await user.click(dialogSubmit(dialog));
    await waitFor(() => expect(actionMock(surface)).toHaveBeenCalledTimes(2));
    expect(attemptAt(surface, 1)).toEqual(first);
    await expectTerminal(surface);
  });

  it.each(["portal", "studio"] as const)("%s no declara éxito ante vacío/ok incompleto/throw/error/transición ajena", async (surface) => {
    const user = userEvent.setup();
    const action = actionMock(surface);
    action.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("fallo sintético"))
      .mockResolvedValueOnce({ error: KNOWN_ERROR, uncertain: false })
      .mockImplementationOnce((...args: unknown[]) => {
        const data = surface === "portal" ? args[2] as FormData : null;
        const requestId = data ? String(data.get("request_id")) : String(args[3]);
        return Promise.resolve({ ok: true, receipt: receipt(requestId, REPORT_ID, "reportado", false) });
      });
    mountReports(surface);
    const dialog = await openDialog(user, surface);
    fireEvent.input(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    for (let index = 0; index < 5; index++) {
      await user.click(dialogSubmit(dialog));
      await waitFor(() => expect(action).toHaveBeenCalledTimes(index + 1));
      expect(await within(dialog).findByRole("alert")).not.toBeEmptyDOMElement();
      expectNoCrash();
      expectTerminalAbsent(surface);
      // Un error conocido posterior no resuelve la incertidumbre del primer envío.
      expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
      expect(dialog).toHaveTextContent(REASON);
      await waitFor(() => expect(dialogSubmit(dialog)).toBeEnabled());
      expect(attemptAt(surface, index)).toEqual(attemptAt(surface, 0));
    }
  });
});

describe("SDD-0365 · historia veraz", () => {
  it("Portal y Studio muestran un cancelado conservado sin ofrecer nuevas operaciones", () => {
    const cancelled = { ...report, cancelledAt: "2026-09-02T10:00:00Z", cancelledBy: "55555555-5555-4555-8555-555555555555" };
    for (const surface of ["portal", "studio"] as const) {
      const view = mountReports(surface, cancelled);
      const ui = within(view.container);
      expect(ui.getByText(/^cancelado$/i)).toBeInTheDocument();
      expect(ui.queryByText(/^pago reportado$/i)).not.toBeInTheDocument();
      expect(ui.queryByRole("button", { name: /cancelar reporte|confirmar pago|rechazar/i })).not.toBeInTheDocument();
      expect(ui.getByText(report.note!, { exact: false })).toBeInTheDocument();
      view.unmount();
    }
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("Portal y Studio separan la nota original del motivo de resolución", () => {
    const rejected = { ...report, status: "rechazado" as const, resolutionReason: REASON };
    for (const surface of ["portal", "studio"] as const) {
      const view = mountReports(surface, rejected);
      const ui = within(view.container);
      const original = ui.getByText(report.note!, { exact: false });
      const resolution = ui.getByText(REASON, { exact: false });
      expect(original).not.toBe(resolution);
      expect(original).toHaveTextContent(/nota del cliente/i);
      expect(resolution).toHaveTextContent(/motivo/i);
      expect(ui.queryByRole("button", { name: /cancelar reporte|confirmar pago|rechazar/i })).not.toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("SDD-0630 · confirmar crea el recibo en la cuenta elegida", () => {
  function confirmedWithCollection(requestId: string, code = "R-2026-0007"): PaymentCommandReceipt {
    return { ...receipt(requestId, REPORT_ID, "confirmado"), collection: {
      id: "77777777-7777-4777-8777-777777777777", code, tenantId: "88888888-8888-4888-8888-888888888888",
      amount: 120.5, currency: "USD", fxRate: null, cashAccountId: BANK.id, receivedAt: "2026-09-01",
      paidAmount: 120.5, invoiceStatus: "parcial", fullyPaid: false } };
  }

  it("con varias cuentas exige elegir una antes de abrir la confirmación y la envía", async () => {
    const user = userEvent.setup();
    mocks.resolve.mockImplementation((_id: string, _action: string, _reason: string, requestId: string) =>
      Promise.resolve({ ok: true, receipt: confirmedWithCollection(requestId) }));
    mount(<StudioInvoicePaymentReports items={[{ report, proofUrl: null }]} cashAccounts={[CASH, BANK]} />);
    await user.click(screen.getByRole("button", { name: /confirmar pago/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/elige la cuenta/i);
    await user.selectOptions(screen.getByLabelText(/cuenta donde entró el dinero/i), BANK.id);
    const dialog = await openDialog(user, "studio");
    expect(dialog).toHaveTextContent(BANK.name);
    expect(dialog).toHaveTextContent(/no lo registres también en cobranzas/i);
    fireEvent.input(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    await user.click(dialogSubmit(dialog));
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(1));
    expect(mocks.resolve.mock.calls[0][1]).toBe("confirmado");
    expect(mocks.resolve.mock.calls[0][4]).toBe(BANK.id);
    expect(await screen.findByText("R-2026-0007")).toBeInTheDocument();
    expect(screen.getByText(/ya está registrado en cobranzas/i)).toBeInTheDocument();
  });

  it("un resultado incierto reintenta con la misma clave y la misma cuenta, con el selector bloqueado", async () => {
    const user = userEvent.setup();
    mocks.resolve.mockResolvedValueOnce({ error: UNCERTAIN_ERROR, uncertain: true });
    mount(<StudioInvoicePaymentReports items={[{ report, proofUrl: null }]} cashAccounts={[CASH, BANK]} />);
    await user.selectOptions(screen.getByLabelText(/cuenta donde entró el dinero/i), CASH.id);
    const dialog = await openDialog(user, "studio");
    fireEvent.input(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    await user.click(dialogSubmit(dialog));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(UNCERTAIN_ERROR);
    expect(screen.getByLabelText(/cuenta donde entró el dinero/i)).toBeDisabled();
    mocks.resolve.mockImplementation((_id: string, _action: string, _reason: string, requestId: string) =>
      Promise.resolve({ ok: true, receipt: confirmedWithCollection(requestId) }));
    await user.click(dialogSubmit(dialog));
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(2));
    expect(mocks.resolve.mock.calls[1][3]).toBe(mocks.resolve.mock.calls[0][3]);
    expect(mocks.resolve.mock.calls[1][4]).toBe(CASH.id);
  });

  it("rechazar no pide ni envía cuenta", async () => {
    const user = userEvent.setup();
    commandSuccess("studio");
    mount(<StudioInvoicePaymentReports items={[{ report, proofUrl: null }]} cashAccounts={[CASH, BANK]} />);
    const dialog = await openDialog(user, "studio", "rechazado");
    fireEvent.input(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    await user.click(dialogSubmit(dialog));
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(1));
    expect(mocks.resolve.mock.calls[0][4]).toBeUndefined();
  });

  it("un reporte confirmado con recibo lo muestra y no ofrece operaciones", () => {
    const confirmed = { ...report, status: "confirmado" as const, resolutionReason: REASON };
    mount(<StudioInvoicePaymentReports items={[{ report: confirmed, proofUrl: null, receiptCode: "R-2026-0003" }]} cashAccounts={[CASH]} />);
    expect(screen.getByText("R-2026-0003")).toBeInTheDocument();
    expect(screen.getByText(/no lo registres otra vez/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirmar pago|rechazar/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cuenta donde entró el dinero/i)).not.toBeInTheDocument();
  });
});

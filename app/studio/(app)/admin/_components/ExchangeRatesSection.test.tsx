/**
 * SDD-0569 · B18: vigencia BCV veraz y conservación del formulario manual.
 * DOM/acciones simuladas; contraste, reflow y teclado en navegador se miden aparte.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExchangeRateActionState, FxRateLatest } from "@/lib/studio/exchange-rates-types";

const { saveRate, successToast } = vi.hoisted(() => ({
  saveRate: vi.fn(async (_previous: ExchangeRateActionState, _form: FormData): Promise<ExchangeRateActionState> => ({})),
  successToast: vi.fn(),
}));
vi.mock("../exchange-rates-actions", () => ({ recordExchangeRateAction: saveRate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn(), success: successToast, error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

import { ExchangeRatesSection } from "./ExchangeRatesSection";

const confirmed: FxRateLatest = { pair: "VES/USD", rate: 883.3963, validOn: "2026-10-21", source: "bcv" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  saveRate.mockReset().mockResolvedValue({});
  successToast.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ExchangeRatesSection", () => {
  it("el formulario manda la nota, con su etiqueta y su tope", () => {
    render(
      <ExchangeRatesSection
        data={{ latest: [{ pair: "VES/USD", rate: 36.5, validOn: "2026-10-20", source: "manual" }] }}
      />,
    );
    const nota = screen.getByLabelText("Nota (opcional)");
    expect(nota.getAttribute("name")).toBe("note");
    expect(nota.getAttribute("maxlength")).toBe("500");
    expect(screen.getByText("del 20/10/2026 · manual")).toBeTruthy();
  });

  it("una tasa BCV VES completa de hoy no muestra falta de confirmación", () => {
    render(<ExchangeRatesSection data={{ latest: [confirmed] }} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("del 21/10/2026 · BCV")).toBeTruthy();
  });

  it.each([
    ["manual de hoy", "2026-10-21", "manual", "21/10/2026 · manual"],
    ["operación de hoy", "2026-10-21", "operacion", "21/10/2026 · de una operación"],
    ["BCV de ayer", "2026-10-20", "bcv", "20/10/2026 · BCV"],
    ["BCV futura", "2026-10-22", "bcv", "22/10/2026 · BCV"],
  ] as const)("%s conserva fecha/fuente sin afirmar confirmación BCV de hoy", (_, validOn, source, metadata) => {
    render(<ExchangeRatesSection data={{ latest: [{ ...confirmed, validOn, source }] }} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("BCV: no se confirmó una tasa para hoy.");
    expect(status.textContent).toContain(`Última tasa informada en esta vista: ${metadata}.`);
    expect(status.textContent).toContain("Puedes registrar una tasa manual en el formulario.");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText(`del ${metadata}`)).toBeTruthy();
    expect(status.textContent).not.toMatch(/cron|caíd[oa]|no existe|sin tasa cargada/i);
  });

  it.each([
    ["sin valor", { rate: null }],
    ["sin fecha", { validOn: null }],
    ["sin fuente", { source: null }],
    ["fecha inválida", { validOn: "2026-02-30" }],
    ["valor no finito", { rate: Number.NaN }],
    ["valor cero", { rate: 0 }],
    ["todos nulos", { rate: null, validOn: null, source: null }],
  ] satisfies Array<[string, Partial<FxRateLatest>]>)("%s no prueba ausencia ni inventa fecha/fuente", (_, partial) => {
    render(<ExchangeRatesSection data={{ latest: [{ ...confirmed, ...partial }] }} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("La información disponible no permite confirmar una fecha y fuente completas.");
    expect(status.textContent).not.toContain("Última tasa informada");
    expect(screen.queryByText(/sin tasa cargada|cron|caíd[oa]/i)).toBeNull();
    expect(screen.getByText("tasa no confirmada")).toBeTruthy();
  });

  it("un arreglo vacío o CNY no confirma una tasa BCV en bolívares", () => {
    const { rerender } = render(<ExchangeRatesSection data={{ latest: [] }} />);
    expect(screen.getByRole("status").textContent).toContain("no se confirmó una tasa para hoy");
    rerender(<ExchangeRatesSection data={{ latest: [{ ...confirmed, pair: "CNY/USD" }] }} />);
    expect(screen.getByRole("status").textContent).not.toContain("Última tasa informada");
    expect(screen.getByLabelText("Par de moneda")).toBeTruthy();
  });

  it("el aviso usa el cambio de día de Caracas, no la fecha UTC", () => {
    vi.setSystemTime(new Date("2026-10-22T03:59:59Z"));
    const { rerender } = render(<ExchangeRatesSection data={{ latest: [confirmed] }} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByLabelText("Fecha de la tasa").getAttribute("max")).toBe("2026-10-21");
    vi.setSystemTime(new Date("2026-10-22T04:00:00Z"));
    rerender(<ExchangeRatesSection data={{ latest: [confirmed] }} />);
    expect(screen.getByRole("status").textContent).toContain("21/10/2026 · BCV");
    expect(screen.getByLabelText("Fecha de la tasa").getAttribute("max")).toBe("2026-10-22");
  });

  it("la aparición del aviso no secuestra foco ni borra una nota en edición", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ExchangeRatesSection data={{ latest: [confirmed] }} />);
    const note = screen.getByLabelText("Nota (opcional)") as HTMLInputElement;
    await user.click(note);
    await user.type(note, "Cotización por confirmar");
    rerender(<ExchangeRatesSection data={{ latest: [{ ...confirmed, validOn: "2026-10-20" }] }} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(document.activeElement).toBe(note);
    expect(note.value).toBe("Cotización por confirmar");
    expect(saveRate).not.toHaveBeenCalled();
  });

  it("un error de la acción conserva par, tasa, fecha, nota y contexto manual", async () => {
    const error = "No se pudo guardar la tasa. Revisa los datos y vuelve a intentarlo.";
    saveRate.mockResolvedValueOnce({ error });
    const user = userEvent.setup();
    render(<ExchangeRatesSection data={{ latest: [{ ...confirmed, source: "manual" }] }} />);
    await user.selectOptions(screen.getByLabelText("Par de moneda"), "VES/USD");
    const rate = screen.getByLabelText("Tasa (1 USD = ? VES)") as HTMLInputElement;
    const date = screen.getByLabelText("Fecha de la tasa") as HTMLInputElement;
    const note = screen.getByLabelText("Nota (opcional)") as HTMLInputElement;
    await user.type(rate, "883,3963");
    fireEvent.change(date, { target: { value: "2026-10-20" } });
    await user.type(note, "Respaldo manual");
    expect((screen.getByLabelText("Par de moneda") as HTMLSelectElement).value).toBe("VES/USD");
    expect(rate.value).toBe("883,3963");
    const submit = screen.getByRole("button", { name: "Registrar tasa" });
    await user.click(submit);
    expect(await screen.findByText(error)).toBeTruthy();
    expect((screen.getByLabelText("Par de moneda") as HTMLSelectElement).value).toBe("VES/USD");
    expect(rate.value).toBe("883,3963");
    expect(date.value).toBe("2026-10-20");
    expect(note.value).toBe("Respaldo manual");
    expect(document.activeElement).toBe(submit);
    expect(successToast).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("21/10/2026 · manual");
    expect(saveRate).toHaveBeenCalledTimes(1);
    const sent = saveRate.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(sent)).toEqual({ pair: "VES/USD", rate: "883,3963", valid_on: "2026-10-20", note: "Respaldo manual" });
  });

  it("pending bloquea la segunda acción y conserva el aviso y los campos", async () => {
    let finish!: (result: { error: string }) => void;
    saveRate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<ExchangeRatesSection data={{ latest: [] }} />);
    const rate = screen.getByLabelText("Tasa (1 USD = ? CNY)") as HTMLInputElement;
    await user.type(rate, "7.24");
    await user.click(screen.getByRole("button", { name: "Registrar tasa" }));
    try {
      const pending = screen.getByRole("button", { name: "Guardando…" }) as HTMLButtonElement;
      expect(pending.disabled).toBe(true);
      await user.click(pending);
      expect(saveRate).toHaveBeenCalledTimes(1);
      expect(rate.value).toBe("7.24");
      expect(screen.getByRole("status").textContent).toContain("no se confirmó una tasa para hoy");
    } finally {
      await act(async () => { finish({ error: "No se pudo guardar; conserva tus datos." }); });
    }
    expect(successToast).not.toHaveBeenCalled();
  });

  it("el éxito manual vacía solo tasa, sin atribuir confirmación BCV a ese resultado", async () => {
    saveRate.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<ExchangeRatesSection data={{ latest: [{ ...confirmed, source: "manual" }] }} />);
    await user.selectOptions(screen.getByLabelText("Par de moneda"), "VES/USD");
    const rate = screen.getByLabelText("Tasa (1 USD = ? VES)") as HTMLInputElement;
    const note = screen.getByLabelText("Nota (opcional)") as HTMLInputElement;
    await user.type(rate, "883,3963");
    await user.type(note, "Cotización manual");
    await user.click(screen.getByRole("button", { name: "Registrar tasa" }));
    await waitFor(() => expect(successToast).toHaveBeenCalledTimes(1));
    expect(rate.value).toBe("");
    expect((screen.getByLabelText("Par de moneda") as HTMLSelectElement).value).toBe("VES/USD");
    expect(note.value).toBe("Cotización manual");
    expect(successToast).toHaveBeenCalledTimes(1);
    expect(successToast).toHaveBeenCalledWith("Tasa registrada");
    expect(screen.getByRole("status").textContent).toContain("21/10/2026 · manual");
  });
});

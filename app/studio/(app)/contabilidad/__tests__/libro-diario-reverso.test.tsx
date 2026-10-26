/** SDD-0573 UI/B1: componentes/diálogos reales; JSDOM no acredita revisión visible ni A11Y integral. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry, JournalEntryProtection } from "@/lib/studio/journal-types";
import type { AvisoCierre } from "@/lib/studio/accounting/cierre-excepciones";

const actions = vi.hoisted(() => ({ postEntry: vi.fn(), voidEntry: vi.fn(), softDeleteEntry: vi.fn(), createJournalEntry: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn(), show: vi.fn() }));
vi.mock("@/app/studio/(app)/contabilidad/actions", () => actions);
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/studio/contabilidad", useSearchParams: () => new URLSearchParams("tab=diario") }));
import { LibroDiarioTab } from "../_components/LibroDiarioTab";

const MANUAL: JournalEntryProtection = { state: "sin_vinculo_visible", reading: "completa", relation: "ninguno_visible" };
const CLOSED: AvisoCierre = { closingDate: "2026-10-31", modo: "superclave", superclaveDefinida: true };
const KEY = "CLAVE_FICTICIA_CENTINELA";
const entry = (patch: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "m", tenant_id: "t1", entry_code: "A-2026-0001", entry_date: "2026-10-20", memo: "Asiento de prueba",
  source: "manual", status: "borrador", invoice_id: null, receipt_id: null, bill_id: null, supplier_payment_id: null,
  posted_at: null, created_at: "", updated_at: "", deleted_at: null, protection: MANUAL, lines: [], ...patch,
});
function mount(entries: JournalEntry[], closed: AvisoCierre | null = null, total = entries.length) {
  return render(<LibroDiarioTab entries={entries} totalEntries={total} asentadosCount={total === 1234 ? 900 : 0}
    postableAccounts={[]} accountsCount={0} showCreate={false} onOpenCreate={() => {}} onCloseCreate={() => {}} avisoCierre={closed} />);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({ ok: true });
  for (const fn of Object.values(toast)) fn.mockReset();
});
afterEach(cleanup);

const BLOCKED: { name: string; source?: JournalEntry["source"]; protection?: JournalEntryProtection }[] = [
  { name: "DTO ausente", protection: undefined },
  { name: "DTO ilegible", protection: { state: "sin_vinculo_visible", reading: "no_comprobada", relation: "ninguno_visible" } as unknown as JournalEntryProtection },
  { name: "lectura desconocida", protection: { state: "no_comprobado", reading: "no_comprobada", relation: "no_comprobado" } },
  { name: "manual vinculado", protection: { state: "protegido", reading: "completa", relation: "inconsistente" } },
  { name: "automático sin par", source: "invoice", protection: { state: "protegido", reading: "completa", relation: "ninguno_visible" } },
  { name: "positivo con lectura fallida", source: "invoice_reversal", protection: { state: "protegido", reading: "no_comprobada", relation: "no_comprobado" } },
  { name: "DTO favorable contradicho por source automático", source: "invoice", protection: MANUAL },
];
describe.each([false, true])("SDD-0573 · bloqueo accesible, cierre=%s", (closed) => {
  it.each(BLOCKED)("$name bloquea controles y no abre excepción", ({ source = "manual", protection }) => {
    mount([entry({ source, protection }), entry({ id: "a", entry_code: "A-2026-0002", source, protection, status: "asentado" })], closed ? CLOSED : null);
    for (const name of ["Asentar", "Eliminar", "Anular"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      const id = button.getAttribute("aria-describedby")!;
      expect(document.getElementById(id)?.textContent?.trim()).toBeTruthy();
      fireEvent.click(button);
    }
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(actions.postEntry).not.toHaveBeenCalled(); expect(actions.softDeleteEntry).not.toHaveBeenCalled(); expect(actions.voidEntry).not.toHaveBeenCalled();
    expect(screen.getAllByRole("note")).toHaveLength(2);
  });
});

describe("SDD-0573 · identidad y flujos conservados", () => {
  it("un DTO favorable no tapa metadata source/tenant ausente en la fila", () => {
    mount([entry({ source: undefined }), entry({ id: "n", entry_code: "A-2026-0002", tenant_id: undefined as unknown as string })]);
    for (const b of screen.getAllByRole("button", { name: "Asentar" })) expect(b).toBeDisabled();
    expect(screen.getAllByRole("note")).toHaveLength(2);
  });
  it("original/reverso identificados no son certificación financiera ni un enlace construido desde UUID", () => {
    const { container } = mount([
      entry({ source: "invoice", status: "asentado", protection: { state: "protegido", reading: "completa", relation: "original", counterpartCode: "A-2026-0002" } }),
      entry({ id: "r", entry_code: "A-2026-0002", source: "invoice_reversal", status: "asentado", protection: { state: "protegido", reading: "completa", relation: "reverso", counterpartCode: "A-2026-0001" } }),
    ]);
    expect(screen.getAllByText(/Esto no verifica los importes/)).toHaveLength(2);
    expect(screen.getByText(/identificados: A-2026-0002/)).toBeInTheDocument();
    expect(container.querySelector('a[href*="entry_id"]')).toBeNull();
    for (const b of screen.getAllByRole("button", { name: "Anular" })) expect(b).toBeDisabled();
  });

  it("protección y aviso500 coexisten con totales reales, CSV y rango elegido", () => {
    mount([entry({ source: "invoice", protection: undefined })], null, 1234);
    expect(screen.getByTestId("diario-contador")).toHaveTextContent("1.234 asientos");
    expect(screen.getByTestId("diario-contador")).toHaveTextContent("900 asentados");
    expect(within(screen.getByTestId("diario-aviso")).getByRole("link", { name: "Descargar el diario asentado (CSV)" })).toHaveAttribute("href", "/api/studio/contabilidad/export?tipo=diario");
    const form = screen.getByRole("form", { name: "Exportar el diario a CSV" });
    fireEvent.change(within(form).getByLabelText("Desde (opcional)"), { target: { value: "2026-10-21" } });
    fireEvent.change(within(form).getByLabelText("Hasta (opcional)"), { target: { value: "2026-10-01" } });
    expect(fireEvent.submit(form)).toBe(false);
    expect(within(form).getByRole("alert")).toHaveTextContent(/al revés/);
    expect(within(form).getByLabelText("Desde (opcional)")).toHaveValue("2026-10-21");
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});

describe("SDD-0573 · acuse y recuperación del manual abierto", () => {
  it.each(["sinok", "error", "throw"])("Asentar %s no da éxito y recupera el control", async (kind) => {
    if (kind === "throw") actions.postEntry.mockRejectedValueOnce(new Error(KEY));
    else actions.postEntry.mockResolvedValueOnce(kind === "sinok" ? {} : { error: "Revisión pendiente." });
    mount([entry()]);
    fireEvent.click(screen.getByRole("button", { name: "Asentar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(kind === "error" ? "Revisión pendiente." : "No se pudo confirmar el cambio");
    await waitFor(() => expect(screen.getByRole("button", { name: "Asentar" })).toBeEnabled());
    expect(actions.postEntry).toHaveBeenCalledTimes(1); expect(toast.show).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(KEY);
    // Nuevo gesto explícito, nunca retry automático por la respuesta incierta.
    fireEvent.click(screen.getByRole("button", { name: "Asentar" }));
    await waitFor(() => expect(toast.show).toHaveBeenCalledExactlyOnceWith({ eventKey: "accounting:journal-entry:posted", tone: "success", message: "Asiento A-2026-0001 asentado", priority: "normal", scope: "module", dedupeKey: "accounting:journal-entry:posted:m" }));
  });

  it("Asentar pendiente no envía dos veces", async () => {
    const d = deferred<{ ok: boolean }>(); actions.postEntry.mockReturnValueOnce(d.promise);
    mount([entry()]);
    const button = screen.getByRole("button", { name: "Asentar" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    await waitFor(() => expect(actions.postEntry).toHaveBeenCalledTimes(1));
    await act(async () => d.resolve({ ok: true }));
    await waitFor(() => expect(toast.show).toHaveBeenCalledTimes(1));
  });

  it.each(["sinok", "error", "throw"])("Eliminar %s conserva la confirmación y finally libera pending", async (kind) => {
    if (kind === "throw") actions.softDeleteEntry.mockRejectedValueOnce(new Error(KEY));
    else actions.softDeleteEntry.mockResolvedValueOnce(kind === "sinok" ? {} : { error: "No se eliminó." });
    mount([entry()]); fireEvent.click(screen.getByRole("button", { name: "Eliminar asiento A-2026-0001" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(kind === "error" ? "No se eliminó." : "No se pudo confirmar el cambio");
    await waitFor(() => expect(screen.getByRole("button", { name: "Sí" })).toBeEnabled());
    expect(toast.show).not.toHaveBeenCalled(); expect(actions.softDeleteEntry).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain(KEY);
    fireEvent.click(screen.getByRole("button", { name: "Sí" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Sí" })).toBeNull());
    expect(toast.show).toHaveBeenCalledExactlyOnceWith({ eventKey: "accounting:journal-entry:draft-deleted", tone: "info", message: "Asiento A-2026-0001 eliminado", priority: "normal", scope: "module", dedupeKey: "accounting:journal-entry:draft-deleted:m" });
  });

  it("Eliminar pendiente no duplica el envío ni cierra la confirmación por sinok", async () => {
    const d = deferred<Record<string, never>>(); actions.softDeleteEntry.mockReturnValueOnce(d.promise);
    mount([entry()]); fireEvent.click(screen.getByRole("button", { name: "Eliminar asiento A-2026-0001" }));
    const yes = screen.getByRole("button", { name: "Sí" });
    act(() => { fireEvent.click(yes); fireEvent.click(yes); });
    expect(actions.softDeleteEntry).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve({}));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sí" })).toBeEnabled());
    expect(toast.show).not.toHaveBeenCalled();
  });

  it.each(["sinok", "error", "throw"])("Anular %s conserva diálogo/motivo y finally libera pending", async (kind) => {
    if (kind === "throw") actions.voidEntry.mockRejectedValueOnce(new Error(KEY));
    else actions.voidEntry.mockResolvedValueOnce(kind === "sinok" ? {} : { error: "No se anuló." });
    mount([entry({ status: "asentado" })]); fireEvent.click(screen.getByRole("button", { name: "Anular" }));
    const dialog = screen.getByRole("dialog");
    const reason = within(dialog).getByRole("textbox");
    await waitFor(() => expect(reason).toHaveFocus());
    fireEvent.input(reason, { target: { value: "Corrección de prueba" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Anular asiento" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(kind === "error" ? "No se anuló." : "No se pudo confirmar el cambio");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Anular asiento" })).toBeEnabled());
    expect(reason).toHaveValue("Corrección de prueba"); expect(toast.show).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(KEY);
    fireEvent.input(reason, { target: { value: "Motivo revisado" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Anular asiento" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.show).toHaveBeenCalledExactlyOnceWith({ eventKey: "accounting:journal-entry:voided", tone: "success", message: "Asiento A-2026-0001 anulado", priority: "normal", scope: "module", dedupeKey: "accounting:journal-entry:voided:m" });
  });

  it("Anular pendiente no duplica el envío y sinok no cierra el diálogo", async () => {
    const d = deferred<Record<string, never>>(); actions.voidEntry.mockReturnValueOnce(d.promise);
    mount([entry({ status: "asentado" })]); fireEvent.click(screen.getByRole("button", { name: "Anular" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.input(within(dialog).getByRole("textbox"), { target: { value: "Corrección de prueba" } });
    const button = within(dialog).getByRole("button", { name: "Anular asiento" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(actions.voidEntry).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve({}));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Anular asiento" })).toBeEnabled());
    expect(screen.getByRole("dialog")).toBe(dialog); expect(toast.show).not.toHaveBeenCalled();
  });
});

const CLOSURES = [
  { action: "postEntry", op: "asentar", hecho: "asentado", status: "borrador", open: "Asentar…", submit: "Asentar con excepción" },
  { action: "softDeleteEntry", op: "eliminar", hecho: "eliminado", status: "borrador", open: "Eliminar…", submit: "Eliminar con excepción" },
  { action: "voidEntry", op: "anular", hecho: "anulado", status: "asentado", open: "Anular…", submit: "Anular con excepción" },
] as const;
describe.each(CLOSURES)("SDD-0573 · $action en0493", ({ action, op, hecho, status, open, submit }) => {
  it.each(["sinok", "throw"])("callback %s devuelve error, limpia clave y permite recuperación explícita", async (kind) => {
    if (kind === "throw") actions[action].mockRejectedValueOnce(new Error(KEY));
    else actions[action].mockResolvedValueOnce({ error: "" });
    mount([entry({ status })], CLOSED); fireEvent.click(screen.getByRole("button", { name: open }));
    const dialog = screen.getByRole("dialog");
    const key = within(dialog).getByLabelText("Superclave del cierre");
    await waitFor(() => expect(key).toHaveFocus());
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.change(within(dialog).getByLabelText("Motivo del cambio"), { target: { value: "Corrección de prueba" } });
    fireEvent.click(within(dialog).getByRole("button", { name: submit }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo confirmar el cambio");
    expect(key).toHaveValue(""); expect(within(dialog).getByLabelText("Motivo del cambio")).toHaveValue("Corrección de prueba");
    expect(toast.show).not.toHaveBeenCalled(); expect(actions[action]).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain(KEY);
    fireEvent.change(key, { target: { value: KEY } });
    const send = within(dialog).getByRole("button", { name: submit });
    expect(send).toBeEnabled(); fireEvent.click(send);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions[action]).toHaveBeenCalledTimes(2);
    expect(toast.show).toHaveBeenCalledExactlyOnceWith({ eventKey: "accounting:journal-entry:closing-exception-applied", tone: "success", message: `Asiento A-2026-0001 ${hecho} con excepción al cierre`, priority: "normal", scope: "module", dedupeKey: `accounting:journal-entry:closing-exception-applied:${op}:m` });
  });
  it("callback pendiente no duplica envío y el éxito confirmado cierra", async () => {
    const d = deferred<{ ok: boolean }>(); actions[action].mockReturnValueOnce(d.promise);
    mount([entry({ status })], CLOSED); fireEvent.click(screen.getByRole("button", { name: open }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Superclave del cierre"), { target: { value: KEY } });
    fireEvent.change(within(dialog).getByLabelText("Motivo del cambio"), { target: { value: "Corrección de prueba" } });
    const button = within(dialog).getByRole("button", { name: submit });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(actions[action]).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve({ ok: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.show).toHaveBeenCalledExactlyOnceWith({ eventKey: "accounting:journal-entry:closing-exception-applied", tone: "success", message: `Asiento A-2026-0001 ${hecho} con excepción al cierre`, priority: "normal", scope: "module", dedupeKey: `accounting:journal-entry:closing-exception-applied:${op}:m` });
  });
});

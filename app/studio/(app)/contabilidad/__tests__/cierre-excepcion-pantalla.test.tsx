/**
 * SDD-0566 · La pantalla del cierre con superclave: el Libro diario ofrece la
 * excepción en los asientos de período cerrado, el diálogo pide lo que el modo
 * pide y vacía la superclave después de cada intento, el reporte muestra las
 * excepciones y el historial, y el cajón del cierre maneja el modo y la clave.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "@/lib/studio/journal-types";
import type { AvisoCierre, EventoDelCierre, ExcepcionAlCierre } from "@/lib/studio/accounting/cierre-excepciones";

const acciones = vi.hoisted(() => ({
  postEntry: vi.fn(),
  voidEntry: vi.fn(),
  softDeleteEntry: vi.fn(),
  createJournalEntry: vi.fn(),
  fijarSuperclaveAction: vi.fn(),
  restablecerSuperclaveAction: vi.fn(),
  setClosingModeAction: vi.fn(),
}));
vi.mock("@/app/studio/(app)/contabilidad/actions", () => acciones);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/studio/contabilidad",
  useSearchParams: () => new URLSearchParams("tab=diario"),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn(), show: vi.fn() }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => toast }));

import { LibroDiarioTab } from "../_components/LibroDiarioTab";
import { ExcepcionesCierreTab } from "../_components/ExcepcionesCierreTab";
import { AjustesDelCierre } from "../_components/AjustesDelCierre";

const CLAVE = "Clave-Secreta-77";
const CON_CLAVE: AvisoCierre = { closingDate: "2026-01-31", modo: "superclave", superclaveDefinida: true };

const asiento = (id: string, status: JournalEntry["status"], entry_date: string): JournalEntry => ({
  id,
  tenant_id: "t",
  entry_code: `A-${id}`,
  entry_date,
  memo: null,
  status,
  source: "manual",
  protection: { state: "sin_vinculo_visible", reading: "completa", relation: "ninguno_visible" },
  invoice_id: null,
  receipt_id: null,
  bill_id: null,
  supplier_payment_id: null,
  posted_at: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  lines: [],
});

function montar(entries: JournalEntry[], avisoCierre: AvisoCierre | null = CON_CLAVE) {
  return render(
    <LibroDiarioTab
      entries={entries}
      totalEntries={entries.length}
      postableAccounts={[]}
      accountsCount={0}
      asentadosCount={0}
      showCreate={false}
      onOpenCreate={() => {}}
      onCloseCreate={() => {}}
      avisoCierre={avisoCierre}
    />,
  );
}

beforeEach(() => {
  for (const f of Object.values(acciones)) f.mockReset();
  toast.success.mockReset();
  toast.show.mockReset();
});

describe("SDD-0566 · el Libro diario con un período cerrado", () => {
  it("un borrador del cierre ofrece «Asentar…» y «Eliminar…»; uno abierto, los de siempre", () => {
    montar([asiento("cerrado", "borrador", "2026-01-12"), asiento("abierto", "borrador", "2026-03-01")]);
    expect(screen.getAllByRole("button", { name: "Asentar…" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Eliminar…" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Asentar" })).toHaveLength(1);
  });

  it("sin cierre no cambia nada", () => {
    montar([asiento("cerrado", "borrador", "2026-01-12")], null);
    expect(screen.queryByRole("button", { name: "Asentar…" })).toBeNull();
  });

  it("asentar con la superclave: pide clave y motivo, llama a la acción y cierra", async () => {
    acciones.postEntry.mockResolvedValue({ ok: true });
    montar([asiento("cerrado", "borrador", "2026-01-12")]);
    fireEvent.click(screen.getByRole("button", { name: "Asentar…" }));
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent(
      "Este período ya cerró contablemente (cierre al 31/01/2026). Para cambiarlo, ingresa la superclave y el motivo.",
    );
    const enviar = within(dialogo).getByRole("button", { name: "Asentar con excepción" });
    expect(enviar).toBeDisabled();
    const clave = within(dialogo).getByLabelText("Superclave del cierre");
    // El foco queda en lo primero que hay que llenar.
    await waitFor(() => expect(clave).toHaveFocus());
    expect(clave).toHaveAttribute("type", "password");
    expect(clave).toHaveAttribute("autocomplete", "off");
    fireEvent.change(clave, { target: { value: CLAVE } });
    fireEvent.change(within(dialogo).getByLabelText("Motivo del cambio"), { target: { value: "Faltaba asentar" } });
    expect(enviar).toBeEnabled();
    fireEvent.click(enviar);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(acciones.postEntry).toHaveBeenCalledWith("cerrado", { superclave: CLAVE, motivo: "Faltaba asentar" });
    expect(toast.show).toHaveBeenCalledWith({
      message: "Asiento A-cerrado asentado con excepción al cierre",
      eventKey: "accounting:journal-entry:closing-exception-applied",
      tone: "success",
      priority: "normal",
      scope: "module",
      dedupeKey: "accounting:journal-entry:closing-exception-applied:asentar:cerrado",
    });
  });

  it("si la clave es mala, muestra el error y vacía la superclave (el motivo queda)", async () => {
    acciones.softDeleteEntry.mockResolvedValue({ error: "La superclave no es correcta.", cierre: CON_CLAVE });
    montar([asiento("cerrado", "borrador", "2026-01-12")]);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar…" }));
    const dialogo = screen.getByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("Superclave del cierre"), { target: { value: CLAVE } });
    fireEvent.change(within(dialogo).getByLabelText("Motivo del cambio"), { target: { value: "Duplicado" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Eliminar con excepción" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("La superclave no es correcta.");
    expect(within(dialogo).getByLabelText("Superclave del cierre")).toHaveValue("");
    expect(within(dialogo).getByLabelText("Motivo del cambio")).toHaveValue("Duplicado");
  });

  it("anular en el cierre: el motivo es el de la anulación y va con la superclave", async () => {
    acciones.voidEntry.mockResolvedValue({ ok: true });
    montar([asiento("cerrado", "asentado", "2026-01-10")]);
    fireEvent.click(screen.getByRole("button", { name: "Anular…" }));
    const dialogo = screen.getByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("Superclave del cierre"), { target: { value: CLAVE } });
    fireEvent.change(within(dialogo).getByLabelText("Motivo del cambio"), { target: { value: "Corrección de enero" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Anular con excepción" }));
    await waitFor(() => expect(acciones.voidEntry).toHaveBeenCalledWith("cerrado", "Corrección de enero", CLAVE));
  });

  it("en modo advertencia no pide la superclave", async () => {
    acciones.postEntry.mockResolvedValue({ ok: true });
    montar([asiento("cerrado", "borrador", "2026-01-12")], { closingDate: "2026-01-31", modo: "advertencia", superclaveDefinida: false });
    fireEvent.click(screen.getByRole("button", { name: "Asentar…" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).queryByLabelText("Superclave del cierre")).toBeNull();
    await waitFor(() => expect(within(dialogo).getByLabelText("Motivo del cambio")).toHaveFocus());
    fireEvent.change(within(dialogo).getByLabelText("Motivo del cambio"), { target: { value: "Visto el aviso" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Asentar con excepción" }));
    await waitFor(() => expect(acciones.postEntry).toHaveBeenCalledWith("cerrado", { superclave: null, motivo: "Visto el aviso" }));
  });

  it("sin superclave definida no ofrece la excepción: explica y solo deja cerrar", () => {
    montar([asiento("cerrado", "borrador", "2026-01-12")], { ...CON_CLAVE, superclaveDefinida: false });
    fireEvent.click(screen.getByRole("button", { name: "Asentar…" }));
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent("todavía no está definida: pídele al admin");
    expect(within(dialogo).queryByLabelText("Superclave del cierre")).toBeNull();
    expect(within(dialogo).queryByRole("button", { name: /con excepción/ })).toBeNull();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("SDD-0566 · el reporte «Excepciones al cierre»", () => {
  const excepcion: ExcepcionAlCierre = {
    id: "x1",
    entryId: "e1",
    entryCode: "A-2026-0001",
    entryDate: "2026-01-10",
    closingDate: "2026-01-31",
    operation: "anular",
    authorizedBy: "superclave",
    reason: "Corrección de enero",
    amountBefore: 100,
    amountAfter: 0,
    userName: "Contadora",
    createdAt: "2026-02-03T14:05:00Z",
  };
  const evento: EventoDelCierre = {
    id: "h1",
    kind: "fecha_cambiada",
    oldValue: null,
    newValue: "2026-01-31",
    reason: null,
    userName: "Admin",
    createdAt: "2026-02-01T12:00:00Z",
  };

  it("muestra cada excepción con quién, cómo, cuándo, motivo y montos", () => {
    render(<ExcepcionesCierreTab excepciones={[excepcion]} historial={[evento]} />);
    const filaExcepcion = screen.getByRole("rowheader", { name: /A-2026-0001/ }).closest("tr")!;
    for (const texto of ["03/02/2026 10:05", "Anulación", "Contadora", "Con superclave", "Corrección de enero", "100.00", "0.00"]) {
      expect(within(filaExcepcion).getByText(texto)).toBeInTheDocument();
    }
    expect(screen.getByText("Cerró el período al 31/01/2026")).toBeInTheDocument();
  });

  it("sin excepciones lo dice, sin tabla vacía", () => {
    render(<ExcepcionesCierreTab excepciones={[]} historial={[]} />);
    expect(screen.getByText("Nadie cambió un período cerrado.")).toBeInTheDocument();
    expect(screen.getByText("El cierre no tiene cambios registrados.")).toBeInTheDocument();
  });
});

describe("SDD-0566 · el modo y la superclave en el cajón del cierre", () => {
  const ESTADO = { closingDate: "2026-01-31", modo: "superclave" as const, superclaveDefinida: false, bloqueadaHasta: null };

  it("definir la superclave llama a la acción y vacía los campos", async () => {
    acciones.fijarSuperclaveAction.mockResolvedValue({ ok: true });
    render(<AjustesDelCierre estado={ESTADO} />);
    fireEvent.change(screen.getByLabelText("Superclave"), { target: { value: CLAVE } });
    fireEvent.change(screen.getByLabelText("Repite la superclave"), { target: { value: CLAVE } });
    fireEvent.click(screen.getByRole("button", { name: "Definir superclave" }));
    await waitFor(() => expect(acciones.fijarSuperclaveAction).toHaveBeenCalledWith("", CLAVE, CLAVE));
    expect(screen.getByLabelText("Superclave")).toHaveValue("");
    expect(screen.getByLabelText("Repite la superclave")).toHaveValue("");
  });

  it("con superclave definida pide la actual, y restablecer pide el motivo", async () => {
    acciones.restablecerSuperclaveAction.mockResolvedValue({ ok: true });
    render(<AjustesDelCierre estado={{ ...ESTADO, superclaveDefinida: true }} />);
    expect(screen.getByLabelText("Superclave actual")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "¿La olvidaste? Restablecer" }));
    expect(screen.queryByLabelText("Superclave actual")).toBeNull();
    fireEvent.change(screen.getByLabelText("Superclave nueva"), { target: { value: CLAVE } });
    fireEvent.change(screen.getByLabelText("Repite la superclave"), { target: { value: CLAVE } });
    fireEvent.change(screen.getByLabelText("Motivo del restablecimiento"), { target: { value: "La olvidamos todos" } });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer superclave" }));
    await waitFor(() =>
      expect(acciones.restablecerSuperclaveAction).toHaveBeenCalledWith(CLAVE, CLAVE, "La olvidamos todos"),
    );
  });

  it("cambiar el modo llama a la acción con el modo elegido", async () => {
    acciones.setClosingModeAction.mockResolvedValue({ ok: true });
    render(<AjustesDelCierre estado={ESTADO} />);
    const guardar = screen.getByRole("button", { name: "Guardar modo" });
    expect(guardar).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Solo advertencia/ }));
    fireEvent.click(guardar);
    await waitFor(() => expect(acciones.setClosingModeAction).toHaveBeenCalledWith("advertencia"));
  });

  it("si la acción falla, el error queda a la vista", async () => {
    acciones.fijarSuperclaveAction.mockResolvedValue({ error: "La confirmación no coincide con la superclave nueva." });
    render(<AjustesDelCierre estado={ESTADO} />);
    fireEvent.change(screen.getByLabelText("Superclave"), { target: { value: CLAVE } });
    fireEvent.change(screen.getByLabelText("Repite la superclave"), { target: { value: "otra-cosa-77" } });
    fireEvent.click(screen.getByRole("button", { name: "Definir superclave" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La confirmación no coincide con la superclave nueva.");
  });
});

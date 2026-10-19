/**
 * SDD-0557 · El libro diario dice cuántos asientos hay de verdad.
 *
 * La pantalla trae como mucho 500 asientos. Antes mostraba `entries.length`
 * como total y contaba los asentados sobre esa misma lista: con 1.234 asientos
 * decía «500». Ahora los contadores salen de `countEntries` y, si se ven menos,
 * lo avisa y enlaza el diario en CSV.
 *
 * El CSV baja solo los asentados (pregunta abierta 3): el enlace y el botón
 * dicen «diario asentado» y el aviso dice cuántos trae, así nadie cree que le
 * faltan los borradores y los anulados del total.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "@/lib/studio/journal-types";

vi.mock("@/app/studio/(app)/contabilidad/actions", () => ({
  postEntry: vi.fn(),
  voidEntry: vi.fn(),
  softDeleteEntry: vi.fn(),
  createJournalEntry: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/studio/contabilidad",
  useSearchParams: () => new URLSearchParams("tab=diario"),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { LibroDiarioTab } from "../_components/LibroDiarioTab";

const asiento = (n: number, status: JournalEntry["status"]): JournalEntry => ({
  id: `e${n}`,
  tenant_id: "t",
  entry_code: `A-2025-000${n}`,
  entry_date: "2025-03-05",
  memo: `Asiento ${n}`,
  status,
  source: "manual",
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

function montar(entries: JournalEntry[], totalEntries: number, asentadosCount: number) {
  return render(
    <LibroDiarioTab
      entries={entries}
      totalEntries={totalEntries}
      postableAccounts={[]}
      accountsCount={0}
      asentadosCount={asentadosCount}
      showCreate={false}
      onOpenCreate={() => {}}
      onCloseCreate={() => {}}
    />,
  );
}

describe("LibroDiarioTab · totales reales", () => {
  it("con más asientos que los de la pantalla: contador real, aviso y enlace al CSV de los asentados", () => {
    // Los dos de pantalla son borradores: si el contador se calculara sobre la
    // lista, diría «0 asentados».
    montar([asiento(1, "borrador"), asiento(2, "borrador")], 1234, 900);
    const contador = screen.getByTestId("diario-contador");
    expect(contador).toHaveTextContent("1.234 asientos");
    expect(contador).toHaveTextContent("900 asentados");
    const aviso = screen.getByTestId("diario-aviso");
    expect(aviso).toHaveTextContent(
      "Mostrando 2 de 1.234 asientos (los más recientes). El CSV trae solo los 900 asentados.",
    );
    expect(within(aviso).getByRole("link", { name: "Descargar el diario asentado (CSV)" })).toHaveAttribute(
      "href",
      "/api/studio/contabilidad/export?tipo=diario",
    );
    // Ni el enlace ni el botón prometen «el diario completo».
    expect(screen.queryByText(/diario completo/)).toBeNull();
    const form = screen.getByRole("form", { name: "Exportar el diario a CSV" });
    expect(within(form).getByRole("button", { name: "Descargar el diario asentado (CSV)" })).toHaveAttribute("type", "submit");
  });

  it("si se ven todos, no hay aviso", () => {
    montar([asiento(1, "asentado"), asiento(2, "asentado")], 2, 2);
    expect(screen.queryByTestId("diario-aviso")).toBeNull();
    expect(screen.getByTestId("diario-contador")).toHaveTextContent("2 asientos");
  });

  it("con el diario vacío, el estado vacío", () => {
    montar([], 0, 0);
    expect(screen.getByText("Aún no hay asientos en el diario.")).toBeInTheDocument();
  });

  it("la exportación con fechas valida antes de enviar y conserva lo elegido", () => {
    montar([asiento(1, "asentado")], 1, 1);
    const form = screen.getByRole("form", { name: "Exportar el diario a CSV" });
    expect(form).toHaveAttribute("action", "/api/studio/contabilidad/export");
    fireEvent.change(within(form).getByLabelText("Desde (opcional)"), { target: { value: "2025-03-10" } });
    fireEvent.change(within(form).getByLabelText("Hasta (opcional)"), { target: { value: "2025-03-01" } });
    const enviado = fireEvent.submit(form);
    // preventDefault → fireEvent devuelve false.
    expect(enviado).toBe(false);
    expect(within(form).getByRole("alert")).toHaveTextContent(/al revés/);
    expect(within(form).getByLabelText("Desde (opcional)")).toHaveValue("2025-03-10");
  });
});

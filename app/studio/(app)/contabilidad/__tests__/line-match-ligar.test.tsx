/**
 * SDD-0603 · tramo 5b: cada asiento candidato se liga con un control real,
 * «Ligar», que es la única parada de teclado de la fila y dice con qué liga.
 * La fila sigue ligando con el ratón. Pulsar «Ligar» dentro de la fila liga
 * una sola vez (el botón corta la propagación).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BankStatementLine } from "@/lib/studio/accounting/bank-statement-types";
import type { EntryCandidate } from "@/lib/studio/accounting/bank-statement-queries";

const matchLine = vi.fn(async () => ({}));
vi.mock("@/app/studio/(app)/contabilidad/reconcile-actions", () => ({
  matchLine: (...a: unknown[]) => matchLine(...(a as [])),
  setLineStatus: vi.fn(async () => ({})),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn(), show: vi.fn() }),
}));

import { LineMatchDrawer } from "../_components/LineMatchDrawer";

const LINEA: BankStatementLine = {
  id: "l-1", statement_id: "st-1", tenant_id: "t", line_date: "2026-10-05",
  description: "Movimiento de prueba", reference: null, direction: "credit", amount: 100,
  status: "pending", matched_entry_id: null, match_confidence: null, note: null,
  reconciled_at: null, reconciled_by: null, created_at: "2026-10-05T00:00:00Z", updated_at: "2026-10-05T00:00:00Z",
};

const candidato = (i: number, alreadyLinked = false): EntryCandidate => ({
  id: `e-${i}`, entry_code: `A-2026-000${i}`, entry_date: "2026-10-05",
  memo: `Asiento ${i}`, amount: 100, alreadyLinked,
});

const CANDIDATOS = [candidato(1), candidato(2), candidato(3, true)];
const pintar = () => render(<LineMatchDrawer line={LINEA} candidates={CANDIDATOS} onClose={() => {}} />);

afterEach(() => {
  cleanup();
  matchLine.mockClear();
});

describe("LineMatchDrawer · «Ligar» en el candidato (SDD-0603, tramo 5b)", () => {
  it("cada candidato trae «Ligar» como secundario, con nombre que dice con qué liga", () => {
    pintar();
    const botones = screen.getAllByRole("button", { name: /^Ligar con / });
    expect(botones).toHaveLength(CANDIDATOS.length);
    for (const [i, b] of botones.entries()) {
      expect(b.getAttribute("aria-label")).toBe(`Ligar con ${CANDIDATOS[i].entry_code}`);
      expect(b.textContent).toBe("Ligar");
      expect(b.className.split(" ")).toEqual(
        expect.arrayContaining(["studio-btn", "studio-btn-ghost", "studio-btn-sm"]),
      );
    }
  });

  it("la fila sale del Tab y deja de ser un botón: una sola parada por fila", () => {
    const { container } = pintar();
    const fila = container.querySelector('[data-row-id="A-2026-0001"]') as HTMLElement;
    expect(fila.tagName).toBe("DIV");
    expect(fila.tabIndex).toBe(-1);
    expect(fila.querySelectorAll("button")).toHaveLength(1);
  });

  it("«Ligar» liga una sola vez aunque está dentro de la fila", async () => {
    pintar();
    fireEvent.click(screen.getByRole("button", { name: "Ligar con A-2026-0002" }));
    await waitFor(() => expect(matchLine).toHaveBeenCalledTimes(1));
    expect(matchLine).toHaveBeenCalledWith("l-1", "e-2", expect.anything());
  });

  it("clic en la fila liga lo mismo que antes", async () => {
    pintar();
    fireEvent.click(screen.getByText("Asiento 1", { exact: false }));
    await waitFor(() => expect(matchLine).toHaveBeenCalledTimes(1));
    expect(matchLine).toHaveBeenCalledWith("l-1", "e-1", expect.anything());
  });

  it("un candidato ya conciliado no liga: ni el botón ni la fila", () => {
    const { container } = pintar();
    const boton = screen.getByRole("button", { name: "Ligar con A-2026-0003" }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    const fila = container.querySelector('[data-row-id="A-2026-0003"]') as HTMLElement;
    expect(fila.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(fila);
    expect(matchLine).not.toHaveBeenCalled();
  });
});

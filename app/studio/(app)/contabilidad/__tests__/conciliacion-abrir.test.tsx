/**
 * SDD-0603 · tramo 5b: el extracto de Conciliación se abre con un control
 * real, «Abrir», que es la única parada de teclado de la fila y dice qué abre.
 * El extracto abierto se marca con tinta (contorno y botón oscuro), no con vino.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BankStatement } from "@/lib/studio/accounting/bank-statement-types";

vi.mock("@/app/studio/(app)/contabilidad/reconcile-actions", () => ({
  setLineStatus: vi.fn(),
  matchLine: vi.fn(),
  createStatement: vi.fn(),
  addLines: vi.fn(),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn(), show: vi.fn() }),
}));

import { ConciliacionTab } from "../_components/ConciliacionTab";

function extracto(i: number): BankStatement {
  return {
    id: `st-${i}`, tenant_id: "t", account_id: "a", period_label: `2026-0${i}`,
    period_start: null, period_end: null, bank_name: "Banco de prueba", statement_ref: null,
    opening_balance: 0, closing_balance: 0, currency: "USD", status: "open", notes: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    account_code: "1.1.1.01", account_name: "Banco", lines: [],
  };
}

const EXTRACTOS = [extracto(1), extracto(2)];
const pintar = (activo: BankStatement | null = null) =>
  render(
    <ConciliacionTab
      statements={EXTRACTOS}
      activeStatement={activo}
      bankAccounts={[]}
      candidates={[]}
      showCreate={false}
      onCloseCreate={() => {}}
    />,
  );

afterEach(cleanup);

describe("ConciliacionTab · «Abrir» en el extracto (SDD-0603, tramo 5b)", () => {
  it("cada extracto trae «Abrir» como secundario de tabla, con nombre que dice qué abre", () => {
    pintar();
    const enlaces = screen.getAllByRole("link", { name: /^Abrir extracto / });
    expect(enlaces).toHaveLength(EXTRACTOS.length);
    for (const [i, a] of enlaces.entries()) {
      expect(a.getAttribute("aria-label")).toBe(`Abrir extracto ${EXTRACTOS[i].period_label} · 1.1.1.01`);
      expect(a.textContent).toBe("Abrir");
      expect(a.className.split(" ")).toEqual(
        expect.arrayContaining(["studio-btn", "studio-btn-ghost", "studio-btn-sm"]),
      );
      expect(a.getAttribute("href")).toBe(`/studio/contabilidad?tab=conciliacion&extracto=${EXTRACTOS[i].id}`);
      expect(a.tabIndex).toBe(0);
    }
  });

  it("la fila sigue abriendo con el ratón, pero sale del Tab: una sola parada por fila", () => {
    pintar();
    const fila = screen.getByText("2026-01").closest("a")!;
    expect(fila.tabIndex).toBe(-1);
    expect(fila.getAttribute("href")).toBe("/studio/contabilidad?tab=conciliacion&extracto=st-1");
  });

  it("el abierto se marca con tinta: botón oscuro, aria-current y contorno de control, sin vino", () => {
    pintar(EXTRACTOS[1]);
    const abierto = screen.getByRole("link", { name: "Abrir extracto 2026-02 · 1.1.1.01" });
    expect(abierto.className.split(" ")).toContain("studio-btn-dark");
    expect(abierto.getAttribute("aria-current")).toBe("true");
    const otro = screen.getByRole("link", { name: "Abrir extracto 2026-01 · 1.1.1.01" });
    expect(otro.className.split(" ")).toContain("studio-btn-ghost");
    expect(otro.hasAttribute("aria-current")).toBe(false);

    const fila = abierto.closest('[data-row-id="st-2"]') as HTMLElement;
    expect(fila.getAttribute("data-active")).toBe("true");
    expect(fila.style.border).toContain("var(--ctl-border)");
    expect(fila.style.background).toBe("var(--bg-surface)");
    expect(fila.outerHTML).not.toMatch(/--wine/);
    // La fila del abierto conserva su comportamiento: con el ratón lo cierra.
    expect(screen.getByText("2026-02").closest("a")!.getAttribute("href")).toBe("/studio/contabilidad?tab=conciliacion");
  });
});

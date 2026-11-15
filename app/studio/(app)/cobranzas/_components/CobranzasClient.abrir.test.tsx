/**
 * SDD-0603 · tramo 5c: la fila de la cola de Cobranzas se nota oprimible con un
 * control real, «Abrir», que es su única parada de teclado y dice qué abre.
 * Mismo patrón que Embarques (tramo 5a).
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeCollectionKpis, computeFundsSeparation, type Receivable } from "@/lib/studio/payment-queries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("./CobranzaDrawer", () => ({
  CobranzaDrawer: ({ receivable }: { receivable: Receivable }) => (
    <div role="dialog" aria-label={`Detalle ${receivable.invoice.invoice_code}`} />
  ),
}));
vi.mock("./IdentifyPaymentDrawer", () => ({ IdentifyPaymentDrawer: () => null }));
vi.mock("./UnidentifiedPaymentDrawer", () => ({ UnidentifiedPaymentDrawer: () => null }));
vi.mock("./RecordatoriosDrawer", () => ({ RecordatoriosDrawer: () => null }));
import { CobranzasClient } from "./CobranzasClient";

function cxc(i: number): Receivable {
  return {
    invoice: {
      id: `f-${i}`,
      invoice_code: `F-2026-000${i}`,
      client_name: "Cliente de prueba",
      client_markbox: "DTD-0001",
      due_date: "2026-10-01",
    } as Receivable["invoice"],
    balance: 100,
    balanceUsd: 100,
    daysOverdue: 3,
    stage: "vencido",
    lastActivity: null,
    promiseDate: null,
  };
}

const CXC = [cxc(1), cxc(2)];
const range = { from: "2026-06-01", to: "2026-06-30" };

function pintar() {
  return render(
    <CobranzasClient
      receivables={CXC}
      kpis={computeCollectionKpis([])}
      cashAccounts={[]}
      unidentified={[]}
      separation={computeFundsSeparation([], range)}
    />,
  );
}

afterEach(cleanup);

describe("CobranzasClient · «Abrir» en la fila (SDD-0603, tramo 5c)", () => {
  it("cada fila trae «Abrir» como secundario de tabla, con nombre que dice qué abre", () => {
    pintar();
    const botones = screen.getAllByRole("button", { name: /^Abrir factura / });
    expect(botones).toHaveLength(CXC.length);
    for (const [i, b] of botones.entries()) {
      expect(b.getAttribute("aria-label")).toBe(`Abrir factura ${CXC[i].invoice.invoice_code}`);
      expect(b.textContent).toBe("Abrir");
      expect(b.className.split(" ")).toEqual(
        expect.arrayContaining(["studio-btn", "studio-btn-ghost", "studio-btn-sm"]),
      );
      expect(b.tabIndex).toBe(0);
    }
  });

  it("la fila sale del Tab y deja de ser un botón: una sola parada por fila", () => {
    const { container } = pintar();
    const fila = container.querySelector('[data-row-id="F-2026-0001"]') as HTMLElement;
    expect(fila.tabIndex).toBe(-1);
    expect(fila.getAttribute("role")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /F-2026-0001/ })).toHaveLength(1);
  });

  it("«Abrir» abre el mismo detalle que la fila, también con teclado", async () => {
    const user = userEvent.setup();
    pintar();
    const abrir = screen.getByRole("button", { name: "Abrir factura F-2026-0002" });
    abrir.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Detalle F-2026-0002" })).toBeTruthy();
  });

  it("clic en la fila abre lo mismo que antes", async () => {
    const user = userEvent.setup();
    pintar();
    await user.click(screen.getByText("F-2026-0001"));
    expect(screen.getByRole("dialog", { name: "Detalle F-2026-0001" })).toBeTruthy();
  });

  it("el encabezado y las filas tienen las mismas columnas", () => {
    const { container } = pintar();
    const fila = container.querySelector('[data-row-id="F-2026-0001"]') as HTMLElement;
    const cabecera = screen.getByText("Factura").parentElement as HTMLElement;
    expect(fila.style.gridTemplateColumns).toBe(cabecera.style.gridTemplateColumns);
    expect(cabecera.style.gridTemplateColumns.endsWith(" 92px")).toBe(true);
    expect(cabecera.children).toHaveLength(fila.children.length);
  });
});

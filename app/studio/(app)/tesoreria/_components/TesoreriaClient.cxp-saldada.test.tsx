/**
 * SDD-0494 · desde el tab «Pagos» se llega a la CxP que la orden saldó.
 *
 * El botón «Anular» de una orden de pago vive SOLO dentro del drawer de su CxP,
 * y ese drawer solo se abría desde la cola — que descarta las CxP sin saldo. O
 * sea: una orden que saldaba su CxP no se podía revertir por ninguna pantalla.
 *
 * Acá se fija el camino nuevo y, sobre todo, LO QUE PASA DESPUÉS: al anular, el
 * drawer hace `router.refresh()`, la CxP recupera saldo y vuelve a la cola. Como
 * la consulta vive en estado del cliente, si el componente se quedara con ese
 * snapshot mostraría saldo 0 y «pagada» sobre una CxP que ya debe plata otra
 * vez. El último caso es justamente ese, y falla si la cola no manda.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TesoreriaClient } from "./TesoreriaClient";
import type { Payable } from "@/lib/studio/treasury/bill-queries";
import type { Supplier, SupplierPayment } from "@/lib/studio/treasury/types";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  getPayableForBill: vi.fn(),
  getBillHistory: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: (...a: unknown[]) => mocks.toastError(...a),
  }),
}));

vi.mock("../actions", () => ({
  getPayableForBill: (...a: unknown[]) => mocks.getPayableForBill(...a),
  getBillHistory: (...a: unknown[]) => mocks.getBillHistory(...a),
  createBill: vi.fn(),
  registerPayment: vi.fn(),
  voidBill: vi.fn(),
  voidPayment: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}));

function payable(over: {
  id: string;
  code: string;
  total: number;
  paid: number;
  status?: string;
}): Payable {
  const balance = over.total - over.paid;
  return {
    bill: {
      id: over.id,
      tenant_id: "t1",
      bill_code: over.code,
      supplier_id: "s1",
      supplier_name: "Proveedor Demo",
      concept: "Flete",
      expense_account_id: "e1",
      currency: "USD",
      fx_rate: null,
      total_amount: over.total,
      paid_amount: over.paid,
      status: over.status ?? (balance <= 0 ? "pagada" : "pendiente"),
      bill_kind: "full",
      issue_date: "2026-05-01",
      due_date: "2026-06-01",
      reference: null,
      shipment_id: null,
      journal_entry_id: null,
      notes: null,
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-01T00:00:00Z",
      deleted_at: null,
    },
    balance,
    balanceUsd: balance,
    daysOverdue: 24,
    stage: balance <= 0 ? "pagada" : "vencida",
  } as unknown as Payable;
}

/** La CxP que la orden saldó: 400 de 400, fuera de la cola. */
const CXP_SALDADA = payable({
  id: "b-saldada",
  code: "CXP-2026-0001",
  total: 400,
  paid: 400,
});

/** La misma CxP después de anular la orden: recuperó los 400. */
const CXP_TRAS_ANULAR = payable({
  id: "b-saldada",
  code: "CXP-2026-0001",
  total: 400,
  paid: 0,
});

/** Otra CxP, esta sí con saldo: la única que la cola trae al principio. */
const CXP_EN_COLA = payable({
  id: "b-en-cola",
  code: "CXP-2026-0002",
  total: 1000,
  paid: 0,
});

const ORDEN: SupplierPayment = {
  id: "p-viva",
  tenant_id: "t1",
  payment_code: "OP-2026-0001",
  bill_id: "b-saldada",
  supplier_id: "s1",
  supplier_name: "Proveedor Demo",
  amount: 400,
  currency: "USD",
  fx_rate: null,
  method: "transferencia",
  cash_account_id: "c1",
  reference: null,
  paid_at: "2026-06-05",
  journal_entry_id: null,
  notes: null,
  created_at: "2026-06-05T00:00:00Z",
  deleted_at: null,
} as unknown as SupplierPayment;

const PROVEEDOR = {
  id: "s1",
  tenant_id: "t1",
  supplier_code: "PRV-0001",
  name: "Proveedor Demo",
  type: "naviera",
} as unknown as Supplier;

function renderTesoreria(payables: Payable[]) {
  return render(
    <TesoreriaClient
      payables={payables}
      kpis={{
        porPagar: 1000,
        vencido: 1000,
        porPagarUsd: 1000,
        vencidoUsd: 1000,
        pagadoMes: 400,
        proveedoresActivos: 1,
      }}
      payments={[ORDEN]}
      suppliers={[PROVEEDOR]}
      expenseAccounts={[{ id: "e1", code: "5.1", name: "Flete" }]}
      cashAccounts={[{ id: "c1", code: "1.1.1", name: "Banco" }]}
    />,
  );
}

/** Va al tab «Pagos» y hace clic en la fila de la orden. */
async function abrirDesdePagos(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Pagos" }));
  await user.click(
    screen.getByRole("button", { name: /Abrir la CxP de la orden OP-2026-0001/ }),
  );
}

beforeEach(() => {
  // `mockResolvedValue` NO borra el historial de llamadas: sin esto, el caso
  // que afirma «no pide la consulta» heredaba las llamadas de los anteriores.
  vi.clearAllMocks();
  mocks.getBillHistory.mockResolvedValue({ payments: [ORDEN] });
  mocks.getPayableForBill.mockResolvedValue({ payable: CXP_SALDADA });
});

afterEach(cleanup);

describe("TesoreriaClient · la CxP saldada se abre desde «Pagos» (SDD-0494)", () => {
  it("la fila de la orden abre la CxP aunque NO esté en la cola", async () => {
    const user = userEvent.setup();
    renderTesoreria([CXP_EN_COLA]);

    await abrirDesdePagos(user);

    expect(mocks.getPayableForBill).toHaveBeenCalledWith("b-saldada");
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("CXP-2026-0001")).toBeTruthy();
  });

  it("ahí ofrece «Anular» sobre la orden, y NO «Registrar pago» ni «Anular CxP»", async () => {
    const user = userEvent.setup();
    renderTesoreria([CXP_EN_COLA]);

    await abrirDesdePagos(user);
    const drawer = await screen.findByRole("dialog");

    // Lo que faltaba y ahora existe.
    expect(within(drawer).getByRole("button", { name: "Anular" })).toBeTruthy();
    // Saldo 0 y pagado > 0: las otras dos acciones siguen correctamente ocultas.
    expect(
      within(drawer).queryByRole("button", { name: /Registrar pago/ }),
    ).toBeNull();
    expect(
      within(drawer).queryByRole("button", { name: /Anular CxP/ }),
    ).toBeNull();
  });

  /**
   * `payableForBill` re-lanza el error de PostgREST y la promesa del onClick no
   * la consume nadie: sin catch, un timeout se va como unhandled rejection y la
   * fila vuelve a «Ver CxP» sin decir nada. El usuario se queda sin camino para
   * anular la orden y sin saber por qué.
   */
  /**
   * La fila es un `div` con `role="button"`: el teclado NO le llega gratis como
   * a un `<button>`, hay que servirlo a mano. Y el guion de smokes le promete a
   * Sam que se puede llegar con el tabulador y dar Enter, así que va probado.
   */
  it("se abre con Enter, no solo con el clic", async () => {
    const user = userEvent.setup();
    renderTesoreria([CXP_EN_COLA]);

    await user.click(screen.getByRole("button", { name: "Pagos" }));
    const fila = screen.getByRole("button", {
      name: /Abrir la CxP de la orden OP-2026-0001/,
    });
    fila.focus();
    await user.keyboard("{Enter}");

    expect(mocks.getPayableForBill).toHaveBeenCalledWith("b-saldada");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("y con la barra espaciadora, sin hacer scroll de la página", async () => {
    const user = userEvent.setup();
    renderTesoreria([CXP_EN_COLA]);

    await user.click(screen.getByRole("button", { name: "Pagos" }));
    const fila = screen.getByRole("button", {
      name: /Abrir la CxP de la orden OP-2026-0001/,
    });
    fila.focus();
    await user.keyboard("[Space]");

    expect(mocks.getPayableForBill).toHaveBeenCalledWith("b-saldada");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  /**
   * El gate de vista del módulo: el layout protege la PÁGINA, no la action, que
   * es un endpoint invocable directo. Un rol sin Tesorería recibe el motivo y
   * NO el panel — y el motivo se muestra tal cual, no el genérico.
   */
  it("si el rol no puede ver Tesorería, muestra ese motivo y no abre el panel", async () => {
    const user = userEvent.setup();
    mocks.getPayableForBill.mockResolvedValue({
      payable: null,
      error: "No tienes permiso para ver esto.",
    });
    renderTesoreria([CXP_EN_COLA]);

    await abrirDesdePagos(user);

    expect(mocks.toastError).toHaveBeenCalledWith("No tienes permiso para ver esto.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("si la lectura FALLA, avisa en vez de quedarse muda", async () => {
    const user = userEvent.setup();
    mocks.getPayableForBill.mockRejectedValue(new Error("PostgREST 500"));
    renderTesoreria([CXP_EN_COLA]);

    await abrirDesdePagos(user);

    expect(mocks.toastError).toHaveBeenCalledWith(
      "No se pudo abrir la cuenta por pagar de esta orden.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    // Y la fila queda usable otra vez, no atascada en «Abriendo…».
    expect(screen.getByText("Ver CxP")).toBeTruthy();
  });

  it("si la CxP no existe o la RLS la oculta, también avisa", async () => {
    const user = userEvent.setup();
    mocks.getPayableForBill.mockResolvedValue({ payable: null });
    renderTesoreria([CXP_EN_COLA]);

    await abrirDesdePagos(user);

    expect(mocks.toastError).toHaveBeenCalledWith(
      "No se pudo abrir la cuenta por pagar de esta orden.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("si la CxP YA está en la cola, no pide la consulta al servidor", async () => {
    const user = userEvent.setup();
    renderTesoreria([CXP_EN_COLA, payable({ id: "b-saldada", code: "CXP-2026-0001", total: 400, paid: 100 })]);

    await abrirDesdePagos(user);

    expect(mocks.getPayableForBill).not.toHaveBeenCalled();
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("CXP-2026-0001")).toBeTruthy();
  });

  /**
   * El caso que importa: después de anular, `router.refresh()` devuelve la CxP
   * a la cola con su saldo recuperado. Si el componente se quedara con el
   * snapshot de la consulta, seguiría diciendo $0.00 sobre una CxP que debe 400.
   */
  it("tras volver a la cola con saldo, el drawer muestra el saldo FRESCO, no el consultado", async () => {
    const user = userEvent.setup();
    const { rerender } = renderTesoreria([CXP_EN_COLA]);

    await abrirDesdePagos(user);
    const drawerViejo = await screen.findByRole("dialog");
    // «Total / pagado» discrimina mejor que el saldo suelto: el snapshot
    // consultado dice 400 pagados; la fila fresca dirá 0.
    expect(within(drawerViejo).getByText("$400.00 / $400.00")).toBeTruthy();

    // Lo que hace router.refresh(): el server component vuelve con la CxP en la cola.
    rerender(
      <TesoreriaClient
        payables={[CXP_EN_COLA, CXP_TRAS_ANULAR]}
        kpis={{
          porPagar: 1400,
          vencido: 1400,
          porPagarUsd: 1400,
          vencidoUsd: 1400,
          pagadoMes: 0,
          proveedoresActivos: 1,
        }}
        payments={[]}
        suppliers={[PROVEEDOR]}
        expenseAccounts={[{ id: "e1", code: "5.1", name: "Flete" }]}
        cashAccounts={[{ id: "c1", code: "1.1.1", name: "Banco" }]}
      />,
    );

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("$400.00 / $0.00")).toBeTruthy();
    expect(within(drawer).queryByText("$400.00 / $400.00")).toBeNull();
    // Y con saldo otra vez, la CxP vuelve a admitir un pago.
    expect(
      within(drawer).getByRole("button", { name: /Registrar pago/ }),
    ).toBeTruthy();
  });
});

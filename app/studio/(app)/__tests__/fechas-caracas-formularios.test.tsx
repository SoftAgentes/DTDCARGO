import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/lib/studio/invoice-types";
import type { SupplierBill } from "@/lib/studio/treasury/types";
import type { Expense } from "@/lib/studio/expense-types";
import { validateUnidentifiedPaymentInput } from "@/lib/studio/payment-types";

const io = vi.hoisted(() => ({ unidentified: vi.fn(), history: vi.fn(), bills: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: io.refresh, push: vi.fn(), replace: vi.fn() }), usePathname: () => "/studio/gastos", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/studio/(app)/cobranzas/actions", () => ({ registerUnidentifiedPayment: io.unidentified, getReceivableHistory: io.history, getPendingPaymentReports: async () => ({ pending: { count: 0, amount: 0 } }), logActivity: vi.fn(), registerCollection: vi.fn(), voidReceipt: vi.fn() }));
vi.mock("@/app/studio/(app)/tesoreria/actions", () => ({ getBillHistory: io.bills, createBill: vi.fn(), registerPayment: vi.fn(), voidBill: vi.fn(), voidPayment: vi.fn() }));
vi.mock("@/app/studio/(app)/facturacion/actions", () => ({ duplicateInvoice: vi.fn(), emitInvoice: vi.fn(), registerPayment: vi.fn(), voidInvoice: vi.fn(), createInvoice: vi.fn(), updateInvoice: vi.fn() }));
vi.mock("@/app/studio/(app)/contabilidad/actions", () => ({ createJournalEntry: vi.fn() }));
vi.mock("@/app/studio/(app)/gastos/actions", () => ({ resolveExpenseAlertAction: vi.fn(), exportExpensesCsvAction: vi.fn(), createExpenseAction: vi.fn(), updateExpenseAction: vi.fn(), voidExpenseAction: vi.fn() }));

import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";
import { InvoiceDetailClient } from "../facturacion/_components/InvoiceDetailClient";
import { CobranzaDrawer } from "../cobranzas/_components/CobranzaDrawer";
import { UnidentifiedPaymentDrawer } from "../cobranzas/_components/UnidentifiedPaymentDrawer";
import { BillDrawer, NewBillDrawer } from "../tesoreria/_components/BillDrawer";
import { EntryDrawer } from "../contabilidad/_components/EntryDrawer";
import { GastosClient } from "../gastos/_components/GastosClient";

const cashAccounts = [{ id: "cash-c1", code: "1.1.1", name: "Caja sintética" }];
const invoice: Invoice = {
  id: "invoice-c1", tenant_id: "tenant-c1", invoice_code: "F-C1", client_markbox: "SINTETICO", client_name: "Cliente ficticio",
  client_rif: null, client_doc_kind: null, shipment_id: null, shipment_code: null, currency: "USD", fx_rate: null,
  iva_rate: 0, iva_mode: "sin_iva", base_amount: 10.25, iva_amount: 0, total_amount: 10.25, status: "emitida",
  issued_at: "2026-10-20", due_date: "2026-11-20", paid_amount: 0, last_payment_at: null, lines: [], notes: null,
  created_at: "2026-10-21T02:30:00Z", updated_at: "2026-10-21T02:30:00Z", deleted_at: null,
};
const receivable = { invoice, balance: 10.25, balanceUsd: 10.25, daysOverdue: 0, stage: "al-dia" as const, lastActivity: null, promiseDate: null };
const bill: SupplierBill = {
  id: "bill-c1", tenant_id: "tenant-c1", bill_code: "CXP-C1", supplier_id: "supplier-c1", supplier_name: "Proveedor ficticio",
  concept: null, expense_account_id: "cost", currency: "USD", fx_rate: null, total_amount: 10.25, paid_amount: 0,
  status: "pendiente", bill_kind: "full", issue_date: "2026-10-20", due_date: "2026-11-20", reference: null,
  shipment_id: null, journal_entry_id: null, notes: null, created_at: "2026-10-21T02:30:00Z", updated_at: "2026-10-21T02:30:00Z", deleted_at: null,
};
function mount(node: ReactNode) { return render(<ToastProvider>{node}</ToastProvider>); }
const close = () => undefined;
async function open(button: string) { await act(async () => { fireEvent.click(screen.getByRole("button", { name: button })); }); }
function date(id: string) { const field = document.getElementById(id); expect(field).toBeInstanceOf(HTMLInputElement); return field as HTMLInputElement; }

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-21T02:30:00Z"));
  io.history.mockResolvedValue({ receipts: [], activities: [] }); io.bills.mockResolvedValue({ payments: [] });
  io.unidentified.mockImplementation(async (input) => {
    const result = validateUnidentifiedPaymentInput(input);
    return result.fieldErrors ? { error: Object.values(result.fieldErrors).join(" ") } : { ok: true };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("C1 · formularios reales conservan día Caracas y edición", () => {
  it("cobro desde factura", async () => {
    mount(<InvoiceDetailClient invoice={invoice} ivaOn={false} cashAccounts={cashAccounts} />);
    await open("Registrar pago"); expect(date("pay-date")).toHaveValue("2026-10-20");
  });
  it("cobro desde Cobranzas", async () => {
    mount(<CobranzaDrawer receivable={receivable} cashAccounts={cashAccounts} onClose={close} />);
    await open("Registrar cobro"); expect(date("cob-date")).toHaveValue("2026-10-20");
  });
  it("promesa desde Cobranzas", async () => {
    mount(<CobranzaDrawer receivable={receivable} cashAccounts={cashAccounts} onClose={close} />);
    await open("Promesa de pago"); expect(date("promise-date")).toHaveValue("2026-10-20");
  });
  it("cobro sin identificar", () => {
    mount(<UnidentifiedPaymentDrawer cashAccounts={cashAccounts} onClose={close} onDone={close} />);
    expect(date("unid-date")).toHaveValue("2026-10-20");
  });
  it("pago a proveedor", async () => {
    mount(<BillDrawer payable={{ bill, balance: 10.25, balanceUsd: 10.25, daysOverdue: 0, stage: "por_vencer" }} supplier={null} cashAccounts={cashAccounts} onClose={close} />);
    await open("Registrar pago"); expect(date("tes-pay-date")).toHaveValue("2026-10-20");
  });
  it("alta CxP conserva explícita y vacío al rerender", () => {
    const view = mount(<NewBillDrawer suppliers={[]} expenseAccounts={[]} onClose={close} />);
    const field = date("nb-issue"); expect(field).toHaveValue("2026-10-20");
    fireEvent.change(field, { target: { value: "2024-02-29" } });
    vi.setSystemTime(new Date("2026-10-21T04:00:00Z"));
    view.rerender(<ToastProvider><NewBillDrawer suppliers={[]} expenseAccounts={[]} onClose={close} /></ToastProvider>);
    expect(field).toHaveValue("2024-02-29");
    fireEvent.change(field, { target: { value: "" } }); expect(field).toHaveValue("");
  });
  it("asiento manual conserva la fecha elegida", () => {
    mount(<EntryDrawer postableAccounts={[]} onClose={close} />);
    const field = date("entry-date"); expect(field).toHaveValue("2026-10-20");
    fireEvent.change(field, { target: { value: "2024-02-29" } }); expect(field).toHaveValue("2024-02-29");
  });
  it("vaciar fecha llega vacío al validador real y deja error persistente sin cerrar", async () => {
    const done = vi.fn();
    mount(<UnidentifiedPaymentDrawer cashAccounts={cashAccounts} onClose={close} onDone={done} />);
    fireEvent.change(screen.getByLabelText(/^monto/i), { target: { value: "10.25" } });
    fireEvent.change(date("unid-date"), { target: { value: "" } });
    await open("Registrar pago");
    await waitFor(() => expect(io.unidentified).toHaveBeenCalledWith(expect.objectContaining({ receivedAt: "", amount: 10.25 })));
    expect(await screen.findByRole("alert")).toHaveTextContent(/fecha/i);
    expect(date("unid-date")).toHaveValue(""); expect(done).not.toHaveBeenCalled();
  });
  it.each(["UTC", "Asia/Shanghai", "America/Los_Angeles"])("la fila de gasto presenta Caracas con navegador %s", async tz => {
    vi.stubEnv("TZ", tz);
    const expense: Expense = {
      id: "expense-c1", tenant_id: "tenant-c1", user_id: "actor-c1", expense_code: "G-C1", amount: 10.25, currency: "USD", amount_usd: 10.25, fx_rate: 1,
      category: "otro", scope: "external", method: "cash", shipment_id: null, note: "Sintético", location: null, billable: false,
      receipt_path: null, receipt_document_id: null, account_id: "cost", occurred_at: "2026-10-21T02:30:00Z", created_at: "2026-10-21T02:30:00Z", updated_at: "2026-10-21T02:30:00Z", deleted_at: null,
    };
    await act(async () => { mount(<GastosClient expenses={[expense]} shipments={[]} scope="external" fxPrefill={{}} activeAlerts={[]} attachmentsPilotEnabled={false} canVoidExpense={false} />); });
    const expected = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", year: "numeric", month: "short", day: "numeric" }).format(new Date(expense.occurred_at));
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

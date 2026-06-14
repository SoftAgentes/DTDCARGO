"use client";

/**
 * Drawer de la CxP (SDD-0044): datos de la cuenta por pagar + proveedor +
 * Registrar pago (orden OP-) + historial de pagos + anular CxP/orden.
 * Embarque vinculado (si shipment_id) como referencia read-only.
 *
 * NewBillDrawer: alta de CxP (proveedor + cuenta de gasto + monto + venc.).
 *
 * El pago y las anulaciones usan las server actions del módulo. El historial
 * se carga al abrir vía getBillHistory.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  billStatusLabel,
  billStatusTone,
  paymentMethodLabel,
  PAYMENT_METHOD_OPTIONS,
  supplierTypeLabel,
  type PaymentMethod,
  type Supplier,
  type SupplierPayment,
} from "@/lib/studio/treasury/types";
import {
  currencyLabel,
  INVOICE_CURRENCY_OPTIONS,
  type InvoiceCurrency,
} from "@/lib/studio/invoice-types";
import type { Payable } from "@/lib/studio/treasury/bill-queries";
import {
  createBill,
  getBillHistory,
  registerPayment,
  voidBill,
  voidPayment,
} from "../actions";

/** Cuenta (subset para los selects). */
export type AccountOption = { id: string; code: string; name: string };

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Drawer de la CxP ───────────────────────────────────────────

export function BillDrawer({
  payable,
  supplier,
  cashAccounts,
  onClose,
}: {
  payable: Payable;
  supplier: Supplier | null;
  cashAccounts: AccountOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const bill = payable.bill;

  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [history, setHistory] = useState<{ payments: SupplierPayment[] } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    getBillHistory(bill.id)
      .then((h) => {
        if (active) setHistory(h);
      })
      .catch(() => {
        if (active) setHistory({ payments: [] });
      });
    return () => {
      active = false;
    };
  }, [bill.id]);

  const refresh = () => router.refresh();
  const reloadHistory = () =>
    getBillHistory(bill.id).then(setHistory).catch(() => {});

  return (
    <DrawerShell
      title={bill.bill_code}
      subtitle={`${bill.supplier_name} · saldo $${fmt(payable.balance)}`}
      onClose={onClose}
      pending={false}
      width={640}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {error && (
          <p
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
              padding: "10px 12px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {error}
          </p>
        )}

        {/* Estado + saldo */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "var(--r-md)",
            background: `var(--${billStatusTone(bill.status)}-bg)`,
            borderLeft: `4px solid var(--${billStatusTone(bill.status)})`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Badge tone={billStatusTone(bill.status)} dot>
              {billStatusLabel(bill.status)}
            </Badge>
            <div
              style={{
                font: "600 12px/1.4 var(--f-sans)",
                color:
                  (payable.daysOverdue ?? 0) > 0
                    ? "var(--danger)"
                    : "var(--ink-soft)",
                marginTop: 8,
              }}
            >
              {payable.daysOverdue == null
                ? "Sin fecha de vencimiento"
                : payable.daysOverdue > 0
                  ? `Vencida hace ${payable.daysOverdue} días`
                  : payable.daysOverdue === 0
                    ? "Vence hoy"
                    : `Vence en ${Math.abs(payable.daysOverdue)} días`}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                font: "700 9.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Saldo a pagar
            </div>
            <div style={{ font: "900 24px/1 var(--f-display)", color: "var(--ink)" }}>
              ${fmt(payable.balance)}
            </div>
          </div>
        </div>

        {/* Registrar pago */}
        {!showPay ? (
          payable.balance > 0 &&
          bill.status !== "anulada" && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowPay(true)}
              style={{ alignSelf: "flex-start" }}
            >
              <span style={{ display: "inline-flex" }}>{Icon.invoice(14)}</span>
              Registrar pago
            </button>
          )
        ) : (
          <PayForm
            payable={payable}
            cashAccounts={cashAccounts}
            onCancel={() => setShowPay(false)}
            onError={setError}
            onDone={(paymentCode, fullyPaid) => {
              toast.success(
                `Pago ${fullyPaid ? "total" : "parcial"} registrado en ${bill.bill_code}${paymentCode ? ` · orden ${paymentCode}` : ""}`,
              );
              setShowPay(false);
              refresh();
              reloadHistory();
            }}
          />
        )}

        {/* Datos de la CxP + proveedor */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Proveedor" value={bill.supplier_name} />
          <Field
            label="Tipo"
            value={supplier ? supplierTypeLabel(supplier.type) : "—"}
          />
          <Field
            label="Concepto"
            value={bill.concept ?? "—"}
          />
          <Field
            label="Referencia"
            value={bill.reference ?? "—"}
            mono
          />
          <Field
            label="Emitida / vence"
            value={`${bill.issue_date} → ${bill.due_date}`}
            mono
          />
          <Field
            label="Total / pagado"
            value={`$${fmt(bill.total_amount)} / $${fmt(bill.paid_amount)}`}
            mono
          />
          <Field
            label="Moneda"
            value={
              bill.currency === "USD"
                ? "USD"
                : `${bill.currency}${bill.fx_rate ? ` @ ${bill.fx_rate}` : ""}`
            }
            mono
          />
          <Field
            label="Asiento causación"
            value={bill.journal_entry_id ? "Asentado" : "—"}
          />
        </div>

        {bill.shipment_id && (
          <div
            style={{
              font: "500 11.5px/1.4 var(--f-sans)",
              color: "var(--ink-mute)",
            }}
          >
            Embarque vinculado (para costing futuro).
          </div>
        )}

        {/* Historial de pagos */}
        <PaymentHistory
          history={history}
          onVoidPayment={async (paymentId, code) => {
            setError(null);
            const r = await voidPayment(paymentId);
            if (r.error) return { error: r.error };
            toast.info(`Orden ${code} anulada · se revirtió el saldo`);
            refresh();
            reloadHistory();
            return undefined;
          }}
        />

        {/* Anular CxP (solo sin pagos) */}
        {bill.status !== "anulada" && bill.paid_amount === 0 && (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 14,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <ActionButton
              variant="danger"
              size="sm"
              idleLabel="Anular CxP"
              loadingLabel="Anulando…"
              successLabel={null}
              onAction={async () => {
                setError(null);
                const r = await voidBill(bill.id);
                if (r.error) return { error: r.error };
                toast.info(`CxP ${bill.bill_code} anulada`);
                onClose();
                refresh();
                return undefined;
              }}
              onError={setError}
            />
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

function PayForm({
  payable,
  cashAccounts,
  onCancel,
  onError,
  onDone,
}: {
  payable: Payable;
  cashAccounts: AccountOption[];
  onCancel: () => void;
  onError: (m: string) => void;
  onDone: (paymentCode: string | undefined, fullyPaid: boolean) => void;
}) {
  const balance = payable.balance;
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState<string>(String(balance));
  const [cashAccountId, setCashAccountId] = useState<string>(
    cashAccounts[0]?.id ?? "",
  );
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [paidAt, setPaidAt] = useState<string>(today);
  const [reference, setReference] = useState<string>("");

  const amt = Number(amount) || 0;
  const noCashAccounts = cashAccounts.length === 0;
  const valid =
    amt > 0 && amt <= balance + 1e-6 && !!cashAccountId && !noCashAccounts;

  return (
    <div
      style={{
        padding: "16px 16px 14px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="studio-eyebrow">Registrar pago</div>

      <div>
        <label className="studio-label" htmlFor="tes-pay-amount">
          Monto a pagar ({payable.bill.currency})
        </label>
        <NumericInput
          id="tes-pay-amount"
          type="currency"
          currency="USD"
          min={0}
          max={balance}
          placeholder="0.00"
          value={amount === "" ? null : Number(amount)}
          onChange={(v) => setAmount(v != null ? String(v) : "")}
        />
        {amt > 0 && amt <= balance + 1e-6 && (
          <p
            style={{
              font: "500 11px/1.3 var(--f-sans)",
              color: amt >= balance - 1e-6 ? "var(--ink-mute)" : "var(--warning)",
              margin: "4px 0 0",
            }}
          >
            {amt >= balance - 1e-6
              ? "Pago total · salda la CxP."
              : `Abono parcial · quedan $${fmt(balance - amt)} pendientes.`}
          </p>
        )}
      </div>

      <div>
        <label className="studio-label" htmlFor="tes-pay-cash">
          Cuenta de caja / banco que paga
        </label>
        {noCashAccounts ? (
          <p
            style={{
              font: "500 11.5px/1.4 var(--f-sans)",
              color: "var(--warning)",
              margin: "4px 0 0",
            }}
          >
            No hay cuentas de caja/banco en el plan de cuentas. Sembrá el plan en
            Contabilidad para registrar pagos con asiento.
          </p>
        ) : (
          <select
            id="tes-pay-cash"
            className="studio-input"
            value={cashAccountId}
            onChange={(e) => setCashAccountId(e.target.value)}
          >
            {cashAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="studio-label" htmlFor="tes-pay-method">
            Método
          </label>
          <select
            id="tes-pay-method"
            className="studio-input"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="studio-label" htmlFor="tes-pay-date">
            Fecha
          </label>
          <input
            id="tes-pay-date"
            type="date"
            className="studio-input studio-input-mono"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="studio-label" htmlFor="tes-pay-ref">
          Referencia <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
        </label>
        <input
          id="tes-pay-ref"
          type="text"
          className="studio-input"
          placeholder="Nro de transferencia, hash USDT, captura…"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel="Confirmar pago"
          loadingLabel="Registrando…"
          successLabel="Pago registrado"
          idleIcon={Icon.check(13)}
          successIcon={Icon.check(13)}
          disabled={!valid}
          onAction={async () => {
            onError("");
            const r = await registerPayment(payable.bill.id, {
              amount: amt,
              cashAccountId,
              method,
              paidAt,
              reference: reference.trim() || null,
            });
            if (r.error) return { error: r.error };
            onDone(r.paymentCode, r.fullyPaid ?? amt >= balance - 1e-6);
            return undefined;
          }}
          onError={onError}
        />
      </div>
    </div>
  );
}

function PaymentHistory({
  history,
  onVoidPayment,
}: {
  history: { payments: SupplierPayment[] } | null;
  onVoidPayment: (
    paymentId: string,
    code: string,
  ) => Promise<{ error?: string } | undefined>;
}) {
  if (!history) {
    return (
      <p
        style={{
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: 0,
        }}
      >
        Cargando historial…
      </p>
    );
  }

  const { payments } = history;

  return (
    <div>
      <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
        Órdenes de pago · {payments.length}
      </div>
      {payments.length === 0 ? (
        <div
          style={{
            padding: 16,
            textAlign: "center",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--r-md)",
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
          }}
        >
          Sin pagos registrados todavía.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {payments.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ font: "700 12px/1.2 var(--f-mono)", color: "var(--ink)" }}
                >
                  {p.payment_code}
                </div>
                <div
                  style={{
                    font: "500 10.5px/1.3 var(--f-sans)",
                    color: "var(--ink-mute)",
                    marginTop: 2,
                  }}
                >
                  {paymentMethodLabel(p.method)} · {p.paid_at}
                  {p.reference ? ` · ${p.reference}` : ""}
                  {p.journal_entry_id ? " · asentado" : ""}
                </div>
              </div>
              <div style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)" }}>
                ${fmt(p.amount)}
              </div>
              <ActionButton
                variant="ghost"
                size="xs"
                idleLabel="Anular"
                loadingLabel="Anulando…"
                successLabel={null}
                onAction={async () => onVoidPayment(p.id, p.payment_code)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drawer de nueva CxP ────────────────────────────────────────

export function NewBillDrawer({
  suppliers,
  expenseAccounts,
  onClose,
}: {
  suppliers: Supplier[];
  expenseAccounts: AccountOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? "");
  const [concept, setConcept] = useState<string>("");
  const [expenseAccountId, setExpenseAccountId] = useState<string>(() => {
    // Estilo QBO: arranca con la cuenta por defecto del 1er proveedor, si la tiene.
    const def = suppliers[0]?.default_expense_account_id;
    if (def && expenseAccounts.some((a) => a.id === def)) return def;
    return expenseAccounts[0]?.id ?? "";
  });
  const [currency, setCurrency] = useState<InvoiceCurrency>(
    suppliers[0]?.default_currency ?? "USD",
  );
  const [fxRate, setFxRate] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(today);
  const [dueDate, setDueDate] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const total = Number(totalAmount) || 0;
  const needsFx = currency === "VES" || currency === "CNY";
  const canSubmit =
    !!supplierId &&
    !!expenseAccountId &&
    total > 0 &&
    !!dueDate &&
    expenseAccounts.length > 0;

  const onSupplierChange = (id: string) => {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    if (s) {
      setCurrency(s.default_currency);
      // Autollenar la cuenta de gasto por defecto del proveedor (estilo QBO).
      if (
        s.default_expense_account_id &&
        expenseAccounts.some((a) => a.id === s.default_expense_account_id)
      ) {
        setExpenseAccountId(s.default_expense_account_id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    setPending(true);
    const r = await createBill({
      supplierId,
      concept: concept.trim() || null,
      expenseAccountId,
      currency,
      fxRate: needsFx && fxRate.trim() ? Number(fxRate) : null,
      totalAmount: total,
      issueDate,
      dueDate,
      reference: reference.trim() || null,
      shipmentId: null,
      notes: null,
    });
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(`CxP ${r.billCode ?? ""} creada · asiento de causación`);
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title="Nueva cuenta por pagar"
      subtitle="Causa el costo/gasto y la obligación con el proveedor"
      onClose={onClose}
      pending={pending}
      width={620}
    >
      <form
        id="new-bill-form"
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {error && (
          <p
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
              padding: "10px 12px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {error}
          </p>
        )}

        <div>
          <label className="studio-label" htmlFor="nb-supplier">
            Proveedor
          </label>
          <select
            id="nb-supplier"
            className="studio-input"
            value={supplierId}
            onChange={(e) => onSupplierChange(e.target.value)}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.supplier_code} · {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="studio-label" htmlFor="nb-expense">
            Cuenta de costo / gasto a imputar
          </label>
          {expenseAccounts.length === 0 ? (
            <p
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--warning)",
                margin: "4px 0 0",
              }}
            >
              No hay cuentas de costo/gasto en el plan. Sembrá el plan en
              Contabilidad.
            </p>
          ) : (
            <select
              id="nb-expense"
              className="studio-input"
              value={expenseAccountId}
              onChange={(e) => setExpenseAccountId(e.target.value)}
            >
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="studio-label" htmlFor="nb-concept">
            Concepto <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
          </label>
          <input
            id="nb-concept"
            type="text"
            className="studio-input"
            placeholder="Flete contenedor MSKU-..., comisión agente, etc."
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="nb-total">
              Monto total
            </label>
            <NumericInput
              id="nb-total"
              type="currency"
              currency="USD"
              min={0}
              placeholder="0.00"
              value={totalAmount === "" ? null : Number(totalAmount)}
              onChange={(v) => setTotalAmount(v != null ? String(v) : "")}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="nb-currency">
              Moneda
            </label>
            <select
              id="nb-currency"
              className="studio-input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as InvoiceCurrency)}
            >
              {INVOICE_CURRENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {needsFx && (
          <div>
            <label className="studio-label" htmlFor="nb-fx">
              Tasa {currency}/USD{" "}
              <span style={{ color: "var(--ink-mute)" }}>
                (para el asiento en USD)
              </span>
            </label>
            <NumericInput
              id="nb-fx"
              type="decimal"
              min={0}
              placeholder="ej. 36.50"
              value={fxRate === "" ? null : Number(fxRate)}
              onChange={(v) => setFxRate(v != null ? String(v) : "")}
            />
            <p
              style={{
                font: "500 10.5px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: "4px 0 0",
              }}
            >
              {currencyLabel(currency)} · el asiento se hace en USD funcional
              (monto / tasa).
            </p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="nb-issue">
              Emisión
            </label>
            <input
              id="nb-issue"
              type="date"
              className="studio-input studio-input-mono"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="nb-due">
              Vencimiento
            </label>
            <input
              id="nb-due"
              type="date"
              className="studio-input studio-input-mono"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="nb-ref">
            Referencia del proveedor{" "}
            <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
          </label>
          <input
            id="nb-ref"
            type="text"
            className="studio-input"
            placeholder="Nº de proforma / factura del proveedor"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </form>

      <DrawerFooter
        formId="new-bill-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Crear CxP"
        pendingLabel="Creando…"
      />
    </DrawerShell>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mono
            ? "600 12.5px/1.3 var(--f-mono)"
            : "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

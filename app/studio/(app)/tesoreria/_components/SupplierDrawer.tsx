"use client";

/**
 * Drawer de alta/edición de proveedor-lite (SDD-0044).
 * Tipo, país, moneda default, canal de pago, contacto, RIF/registro.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  SUPPLIER_COUNTRY_OPTIONS,
  SUPPLIER_TYPE_OPTIONS,
  type Supplier,
  type SupplierType,
} from "@/lib/studio/treasury/types";
import {
  INVOICE_CURRENCY_OPTIONS,
  type InvoiceCurrency,
} from "@/lib/studio/invoice-types";
import { createSupplier, updateSupplier } from "../actions";
import type { AccountOption } from "./BillDrawer";

export function SupplierDrawer({
  supplier,
  expenseAccounts,
  onClose,
}: {
  supplier?: Supplier;
  expenseAccounts: AccountOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!supplier;

  const [name, setName] = useState(supplier?.name ?? "");
  const [nameCn, setNameCn] = useState(supplier?.name_cn ?? "");
  const [type, setType] = useState<SupplierType>(
    supplier?.type ?? "proveedor_cn",
  );
  const [country, setCountry] = useState(supplier?.country ?? "CN");
  const [defaultCurrency, setDefaultCurrency] = useState<InvoiceCurrency>(
    supplier?.default_currency ?? "USD",
  );
  const [paymentChannel, setPaymentChannel] = useState(
    supplier?.payment_channel ?? "",
  );
  const [contactName, setContactName] = useState(supplier?.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(supplier?.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(supplier?.contact_email ?? "");
  const [taxId, setTaxId] = useState(supplier?.tax_id ?? "");
  const [defaultExpenseAccountId, setDefaultExpenseAccountId] = useState(
    supplier?.default_expense_account_id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    setPending(true);
    const payload = {
      name: name.trim(),
      nameCn: nameCn.trim() || null,
      type,
      country,
      defaultCurrency,
      paymentChannel: paymentChannel.trim() || null,
      contactName: contactName.trim() || null,
      contactPhone: contactPhone.trim() || null,
      contactEmail: contactEmail.trim() || null,
      taxId: taxId.trim() || null,
      notes: null,
      defaultExpenseAccountId: defaultExpenseAccountId || null,
    };
    const r = editing
      ? await updateSupplier(supplier!.id, payload)
      : await createSupplier(payload);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(
      editing
        ? `Proveedor ${supplier!.supplier_code} actualizado`
        : `Proveedor ${(r as { supplierCode?: string }).supplierCode ?? ""} creado`,
    );
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={editing ? supplier!.supplier_code : "Nuevo proveedor"}
      subtitle={editing ? supplier!.name : "Naviera, agente, proveedor CN, servicio"}
      onClose={onClose}
      pending={pending}
      width={580}
    >
      <form
        id="supplier-form"
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="sd-name">
              Nombre
            </label>
            <input
              id="sd-name"
              type="text"
              className="studio-input"
              placeholder="Maersk, Shenzhen Trading Co…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="sd-name-cn">
              Nombre 中文{" "}
              <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
            </label>
            <input
              id="sd-name-cn"
              type="text"
              className="studio-input"
              value={nameCn}
              onChange={(e) => setNameCn(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="sd-type">
              Tipo
            </label>
            <select
              id="sd-type"
              className="studio-input"
              value={type}
              onChange={(e) => setType(e.target.value as SupplierType)}
            >
              {SUPPLIER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="sd-country">
              País
            </label>
            <select
              id="sd-country"
              className="studio-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {SUPPLIER_COUNTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="sd-currency">
              Moneda default
            </label>
            <select
              id="sd-currency"
              className="studio-input"
              value={defaultCurrency}
              onChange={(e) =>
                setDefaultCurrency(e.target.value as InvoiceCurrency)
              }
            >
              {INVOICE_CURRENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="sd-channel">
              Canal de pago
            </label>
            <input
              id="sd-channel"
              type="text"
              className="studio-input"
              placeholder="USDT, Alipay, transferencia BS…"
              value={paymentChannel}
              onChange={(e) => setPaymentChannel(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="sd-contact">
              Contacto{" "}
              <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
            </label>
            <input
              id="sd-contact"
              type="text"
              className="studio-input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="sd-phone">
              Teléfono{" "}
              <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
            </label>
            <input
              id="sd-phone"
              type="text"
              className="studio-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="studio-label" htmlFor="sd-email">
              Email{" "}
              <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
            </label>
            <input
              id="sd-email"
              type="email"
              className="studio-input"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="sd-tax">
              RIF / registro{" "}
              <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
            </label>
            <input
              id="sd-tax"
              type="text"
              className="studio-input"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="sd-expense-acct">
            Cuenta de gasto por defecto{" "}
            <span style={{ color: "var(--ink-mute)" }}>(opcional)</span>
          </label>
          <select
            id="sd-expense-acct"
            className="studio-input"
            value={defaultExpenseAccountId}
            onChange={(e) => setDefaultExpenseAccountId(e.target.value)}
          >
            <option value="">— Ninguna —</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
          <p
            style={{
              font: "400 11px/1.4 var(--f-sans)",
              color: "var(--ink-mute)",
              margin: "5px 0 0",
            }}
          >
            Se autollena al crear una cuenta por pagar de este proveedor.
          </p>
        </div>
      </form>

      <DrawerFooter
        formId="supplier-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear proveedor"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

"use client";

/**
 * BankAccountDrawer — crear/editar una cuenta bancaria de la empresa (SDD-0120).
 * Banco + tipo + moneda + número. Estas cuentas aparecen en las facturas.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { deleteBankAccountAction, saveBankAccountAction } from "../company-actions";
import {
  BANK_CURRENCIES,
  bankCurrencyLabel,
  type CompanyActionState,
  type CompanyBankAccount,
} from "@/lib/studio/company-types";

const FORM_ID = "bank-drawer-form";
const INITIAL: CompanyActionState = {};

export function BankAccountDrawer({
  mode,
  account,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  account: CompanyBankAccount | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [accountType, setAccountType] = useState(account?.accountType ?? "Cta. Corriente");
  const [currency, setCurrency] = useState<string>(account?.currency ?? "USD");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [state, formAction, isPending] = useActionState(saveBankAccountAction, INITIAL);
  const [delState, delAction, delPending] = useActionState(deleteBankAccountAction, INITIAL);

  const handledSave = useRef<CompanyActionState | null>(null);
  const handledDel = useRef<CompanyActionState | null>(null);

  useEffect(() => {
    if (state?.ok && handledSave.current !== state) {
      handledSave.current = state;
      onSaved(mode === "create" ? "Cuenta agregada" : "Cuenta actualizada");
      onClose();
    }
  }, [state, mode, onSaved, onClose]);

  useEffect(() => {
    if (delState?.ok && handledDel.current !== delState) {
      handledDel.current = delState;
      onSaved("Cuenta eliminada");
      onClose();
    }
  }, [delState, onSaved, onClose]);

  const fe = state?.fieldErrors ?? {};
  const canSubmit =
    bankName.trim().length > 0 &&
    accountType.trim().length > 0 &&
    !!currency &&
    accountNumber.trim().length > 0;
  const busy = isPending || delPending;

  return (
    <DrawerShell
      title={mode === "create" ? "Nueva cuenta bancaria" : `Editar ${account?.bankName ?? "cuenta"}`}
      subtitle="Aparece en las facturas de la empresa"
      onClose={onClose}
      pending={busy}
      width={560}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        {mode === "edit" && account && <input type="hidden" name="id" value={account.id} />}

        <div>
          <label className="studio-label" htmlFor="bk-bank">Banco</label>
          <input
            id="bk-bank"
            name="bank_name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="studio-input"
            placeholder="Banco Mercantil"
            style={{ marginTop: 6 }}
          />
          <FieldError msg={fe.bank_name} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="bk-type">Tipo de cuenta</label>
            <input
              id="bk-type"
              name="account_type"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="studio-input"
              placeholder="Cta. Corriente"
              style={{ marginTop: 6 }}
            />
            <FieldError msg={fe.account_type} />
          </div>
          <div>
            <label className="studio-label" htmlFor="bk-currency">Moneda</label>
            <select
              id="bk-currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="studio-input"
              style={{ marginTop: 6 }}
            >
              {BANK_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {bankCurrencyLabel(c)}
                </option>
              ))}
            </select>
            <FieldError msg={fe.currency} />
          </div>
        </div>

        <div>
          <label className="studio-label" htmlFor="bk-number">Número de cuenta</label>
          <input
            id="bk-number"
            name="account_number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="studio-input studio-input-mono"
            placeholder="0105-0000-00-0000000001"
            style={{ marginTop: 6 }}
          />
          <FieldError msg={fe.account_number} />
        </div>

        {state?.error && <FormError msg={state.error} />}
        {delState?.error && <FormError msg={delState.error} />}
      </form>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        {mode === "edit" && account ? (
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            disabled={busy}
            style={{ color: "var(--danger)" }}
            onClick={() => setConfirmDelete(true)}
          >
            Eliminar
          </button>
        ) : (
          <div />
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="studio-btn studio-btn-primary"
            disabled={busy || !canSubmit}
          >
            {isPending ? "Guardando…" : mode === "create" ? "Agregar cuenta" : "Guardar"}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmDelete && !!account}
        danger
        title="¿Eliminar cuenta?"
        message={`La cuenta de ${account?.bankName ?? "este banco"} dejará de aparecer en las facturas.`}
        confirmLabel="Eliminar"
        pending={delPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!account) return;
          setConfirmDelete(false);
          const fd = new FormData();
          fd.set("id", account.id);
          delAction(fd);
        }}
      />
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "6px 0 0" }}>{msg}</p>
  );
}

function FormError({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: 12,
        background: "var(--danger-bg)",
        color: "var(--danger)",
        borderRadius: "var(--r-md)",
        font: "600 13px/1.3 var(--f-sans)",
      }}
    >
      {msg}
    </div>
  );
}

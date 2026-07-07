"use client";

/**
 * CuotaPrestamoDrawer — registrar una cuota/abono contra un préstamo
 * (SDD-0103 · Slice C). Muestra el saldo vivo; si la cuota lo lleva a 0, la
 * action marca el préstamo 'pagado'. También permite cancelar el préstamo
 * (vía ActionButton). Form HTML5 (form="id" + submit en el footer).
 */

import { useActionState, useEffect, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import type { LoanWithBalance } from "@/lib/studio/nomina/loan-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import { registerLoanInstallmentAction, cancelLoanAction } from "../actions";
import { Field, ErrorBox } from "./form-bits";

const FORM_ID = "cuota-prestamo-form";
const initial: NominaActionState = {};

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function CuotaPrestamoDrawer({
  loan,
  onClose,
}: {
  loan: LoanWithBalance;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    registerLoanInstallmentAction.bind(null, loan.id),
    initial,
  );
  const [cancelError, setCancelError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const suggested = Math.min(loan.installment_usd, loan.balance_usd);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title="Registrar cuota"
      subtitle={`${loan.employee_name} · ${loan.employee_code}`}
      onClose={onClose}
      pending={isPending}
      width={520}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        {/* Resumen del préstamo */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[
            { label: "Préstamo", value: fmtUsd(loan.principal_usd) },
            { label: "Abonado", value: fmtUsd(loan.paid_usd) },
            { label: "Saldo", value: fmtUsd(loan.balance_usd) },
          ].map((r) => (
            <div
              key={r.label}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}
            >
              <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                {r.label}
              </span>
              <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)" }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <Field label="Fecha de la cuota" error={state.fieldErrors?.paid_on}>
          <input name="paid_on" type="date" className="studio-input" defaultValue={today} />
        </Field>

        <Field label="Monto de la cuota (USD)" error={state.fieldErrors?.amount_usd} required>
          <input
            name="amount_usd"
            type="number"
            step="0.01"
            min="0"
            className="studio-input studio-input-mono"
            defaultValue={suggested > 0 ? String(suggested) : ""}
            required
          />
        </Field>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
        {cancelError && <ErrorBox>{cancelError}</ErrorBox>}

        {loan.status === "activo" && (
          <div style={{ marginTop: "var(--s-2)", paddingTop: "var(--s-4)", borderTop: "1px solid var(--border)" }}>
            <ActionButton
              variant="danger"
              size="sm"
              idleLabel="Cancelar préstamo"
              loadingLabel="Cancelando…"
              successLabel="Cancelado"
              idleIcon={Icon.trash(13)}
              onAction={() => {
                setCancelError(null);
                return cancelLoanAction(loan.id);
              }}
              onError={setCancelError}
              onSuccess={onClose}
            />
            <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
              Cancelar marca el préstamo como saldado sin más cuotas (no se descuenta más).
            </p>
          </div>
        )}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Registrar cuota"
      />
    </DrawerShell>
  );
}

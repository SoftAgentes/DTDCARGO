"use client";

import { useId, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  paymentStatusLabel,
  paymentStatusTone,
  paymentMethodLabel,
  type PaymentReport,
} from "@/lib/portal/payment-report-types";
import { resolvePaymentReport, type ResolveReportResult } from "../payment-report-actions";

/** Un reporte + la URL firmada de su comprobante (generada server-side). */
export type ReportWithProof = {
  report: PaymentReport;
  proofUrl: string | null;
  /**
   * SDD-0630: código del recibo de cobro que creó la confirmación, si lo hay.
   * null si no tiene, o si la base todavía no tiene la migración 0537.
   */
  receiptCode?: string | null;
};

/** Cuenta de caja o banco postable del tenant (la misma lista de Cobranzas). */
export type CashAccountOption = { id: string; code: string; name: string };

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Sección "Reportes de pago del cliente" del detalle de factura del Studio
 * (SDD-0134 · Slice B). Lista los reportes con su comprobante y permite
 * confirmar (suma al saldo) o rechazar (con motivo) los que siguen en `reportado`.
 */
export function StudioInvoicePaymentReports({
  items,
  cashAccounts = [],
}: {
  items: ReportWithProof[] | null;
  cashAccounts?: CashAccountOption[];
}) {
  if (items === null) return <Aviso tono="error">No pudimos consultar los reportes de pago. Actualiza la factura antes de resolver un reporte.</Aviso>;
  if (items.length === 0) return null;

  return (
    <section
      style={{
        marginTop: 20,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
        Reportes de pago del cliente · {items.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it, i) => (
          <ReportRow key={it.report.id} item={it} first={i === 0} cashAccounts={cashAccounts} />
        ))}
      </div>
    </section>
  );
}

function ReportRow({ item, first, cashAccounts }: {
  item: ReportWithProof; first: boolean; cashAccounts: CashAccountOption[];
}) {
  const { report, proofUrl } = item;
  const cashSelectId = useId();
  // SDD-0630: la cuenta donde entró el dinero. Con una sola cuenta, va elegida.
  const [cashAccountId, setCashAccountId] = useState(cashAccounts.length === 1 ? cashAccounts[0].id : "");
  const [receiptCode, setReceiptCode] = useState<string | null>(item.receiptCode ?? null);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ResolveReportResult>({});
  const [selection, setSelection] = useState<"confirmado" | "rechazado" | null>(null);
  const [attempt, setAttempt] = useState<{
    requestId: string; action: "confirmado" | "rechazado"; reason: string; cashAccountId?: string;
  } | null>(null);
  const [resolved, setResolved] = useState<"confirmado" | "rechazado" | null>(null);
  const [resolutionReason, setResolutionReason] = useState<string | null>(null);
  const busy = useRef(false);
  const status = resolved ?? report.status;
  const isPending = status === "reportado" && !report.cancelledAt;
  const unknown = "No pudimos confirmar el resultado. Conserva este intento y reintenta sin cambiar sus datos. Código: PAGO-RESULTADO-INCIERTO.";

  const cashAccount = cashAccounts.find((a) => a.id === (attempt?.cashAccountId ?? cashAccountId)) ?? null;

  function begin(action: "confirmado" | "rechazado") {
    if (busy.current) return;
    if (state.uncertain && attempt) { setSelection(attempt.action); return; }
    if (action === "confirmado" && !cashAccounts.some((a) => a.id === cashAccountId)) {
      setState({ error: "Elige la cuenta de caja o banco donde entró el dinero antes de confirmar." });
      return;
    }
    setSelection(action); setAttempt(null); setState({});
  }

  function run(value: string) {
    if (busy.current || !selection) return;
    const reason = state.uncertain && attempt ? attempt.reason : value.replace(/\s+/g, " ").trim();
    if (reason.length < 4 || reason.length > 500) {
      setState({ error: "Escribe un motivo de 4 a 500 caracteres." }); return;
    }
    const current = state.uncertain && attempt ? attempt : {
      requestId: attempt?.requestId ?? crypto.randomUUID(), action: selection, reason,
      cashAccountId: selection === "confirmado" ? cashAccountId : undefined,
    };
    setAttempt(current);
    busy.current = true;
    setState((previous) => ({ uncertain: previous.uncertain }));
    startTransition(async () => {
      try {
        const result = await resolvePaymentReport(report.id, current.action, current.reason, current.requestId,
          current.cashAccountId);
        if (result?.ok === true && !result.error && result.receipt?.requestId === current.requestId
          && result.receipt.reportId === report.id && result.receipt.status === current.action
          && result.receipt.cancelled === false) {
          setResolved(current.action); setResolutionReason(current.reason); setSelection(null); setState({});
          setReceiptCode(result.receipt.collection?.code ?? null);
        } else {
          setState((previous) => ({ error: result?.error ?? unknown,
            uncertain: previous.uncertain || result?.uncertain === true || !result?.error || result.ok === true }));
        }
      } catch { setState({ error: unknown, uncertain: true }); }
      finally { busy.current = false; }
    });
  }

  return (
    <div
      style={{
        padding: "var(--s-3) 0",
        borderTop: first ? 0 : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ font: "800 14px/1 var(--f-mono)", color: "var(--ink)" }}>
          {report.currency} ${fmt(report.amount)}
        </span>
        <Badge tone={report.cancelledAt ? "neutral" : paymentStatusTone(status)} size="sm">
          {report.cancelledAt ? "Cancelado" : paymentStatusLabel(status)}
        </Badge>
        <span
          style={{
            font: "500 11.5px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            flex: 1,
            minWidth: 160,
          }}
        >
          {paymentMethodLabel(report.method)} · {report.paidAt}
        </span>
        {proofUrl ? (
          <a
            href={proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="studio-btn studio-btn-ghost studio-btn-xs"
          >
            Ver comprobante
          </a>
        ) : (
          <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
            {report.proofPath ? "Comprobante no disponible" : "Sin comprobante"}
          </span>
        )}
      </div>

      {report.note ? (
        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            overflowWrap: "anywhere",
            margin: 0,
          }}
        >
          {"Nota del cliente: "}
          {report.note}
        </p>
      ) : null}

      {resolutionReason || report.resolutionReason ? (
        <p style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", overflowWrap: "anywhere", margin: 0 }}>
          Motivo: {resolutionReason ?? report.resolutionReason}
        </p>
      ) : null}
      {resolved ? <p role="status" style={{ color: "var(--ink)" }}>{paymentStatusLabel(resolved)}</p> : null}
      {status === "confirmado" && receiptCode ? (
        <p style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          {"Recibo de cobro "}<span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}>{receiptCode}</span>
          {" · ya está registrado en Cobranzas; no lo registres otra vez."}
        </p>
      ) : null}

      {isPending ? (
        <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label htmlFor={cashSelectId} style={{ display: "flex", flexDirection: "column", gap: 4,
            font: "600 11.5px/1.2 var(--f-sans)", color: "var(--ink-soft)", minWidth: 200 }}>
            Cuenta donde entró el dinero
            <select id={cashSelectId} className="studio-input" value={attempt?.cashAccountId ?? cashAccountId}
              disabled={pending || Boolean(state.uncertain && attempt)}
              onChange={(e) => { setCashAccountId(e.target.value); if (!state.uncertain) setState({}); }}>
              <option value="">{cashAccounts.length === 0 ? "No hay cuentas de caja o banco" : "Elige la cuenta"}</option>
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={pending || Boolean(state.uncertain && attempt?.action !== "confirmado")}
            onClick={() => begin("confirmado")} className="studio-btn studio-btn-primary studio-btn-sm">
            Confirmar pago
          </button>
          <button type="button" disabled={pending || Boolean(state.uncertain && attempt?.action !== "rechazado")}
            onClick={() => begin("rechazado")} className="studio-btn studio-btn-ghost studio-btn-sm">
            Rechazar
          </button>
        </div>
      ) : null}
      {!selection && state.error ? <Aviso tono="error" compacto>{state.error}</Aviso> : null}
      <ConfirmDialog open={selection !== null}
        title={selection === "confirmado" ? "Confirmar pago" : "Rechazar reporte de pago"}
        message={"Factura " + report.invoiceCode + " · " + report.currency + " " + fmt(report.amount) + ". "
          + (selection === "confirmado"
            ? "Se creará el recibo de cobro en " + (cashAccount ? cashAccount.code + " · " + cashAccount.name : "la cuenta elegida")
              + " y el monto se agregará al pago de la factura. No lo registres también en Cobranzas. El comprobante y el motivo quedarán en el historial."
            : "El reporte se conservará como rechazado, sin modificar el saldo. La nota del cliente y el comprobante permanecerán.")
          + (state.uncertain && attempt ? " Motivo conservado: " + attempt.reason : "")}
        danger={selection === "rechazado"} initialFocus="safe"
        reason={!state.uncertain} reasonRequired reasonLabel="Motivo (obligatorio, de 4 a 500 caracteres)"
        confirmLabel={state.uncertain ? "Reintentar la misma operación" : selection === "confirmado" ? "Confirmar pago" : "Rechazar reporte"}
        pending={pending} error={state.error}
        onCancel={() => { if (!busy.current) setSelection(null); }} onConfirm={run} />
    </div>
  );
}

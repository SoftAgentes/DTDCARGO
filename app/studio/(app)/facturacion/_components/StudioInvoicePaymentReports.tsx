"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  paymentStatusLabel,
  paymentStatusTone,
  paymentMethodLabel,
  type PaymentReport,
} from "@/lib/portal/payment-report-types";
import { resolvePaymentReport } from "../payment-report-actions";

/** Un reporte + la URL firmada de su comprobante (generada server-side). */
export type ReportWithProof = {
  report: PaymentReport;
  proofUrl: string | null;
};

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
}: {
  items: ReportWithProof[];
}) {
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
          <ReportRow key={it.report.id} item={it} first={i === 0} />
        ))}
      </div>
    </section>
  );
}

function ReportRow({ item, first }: { item: ReportWithProof; first: boolean }) {
  const { report, proofUrl } = item;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  // Estado local para reflejar la resolución sin esperar el refresh del RSC.
  const [resolved, setResolved] = useState<null | "confirmado" | "rechazado">(null);

  const status = resolved ?? report.status;
  const isPending = status === "reportado";

  function run(action: "confirmado" | "rechazado", motivo?: string) {
    setError(null);
    startTransition(async () => {
      const res = await resolvePaymentReport(report.id, action, motivo);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResolved(action);
      setRejecting(false);
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
        <Badge tone={paymentStatusTone(status)} size="sm" dot>
          {paymentStatusLabel(status)}
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
            Sin comprobante
          </span>
        )}
      </div>

      {report.note ? (
        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {status === "rechazado" ? "Motivo: " : "Nota del cliente: "}
          {report.note}
        </p>
      ) : null}

      {isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rejecting ? (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Motivo del rechazo (opcional, lo ve el cliente)"
                disabled={pending}
                style={{
                  width: "100%",
                  font: "500 12.5px/1.4 var(--f-sans)",
                  color: "var(--ink)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "8px 10px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run("rechazado", note)}
                  className="studio-btn studio-btn-danger studio-btn-xs"
                >
                  {pending ? "Rechazando…" : "Confirmar rechazo"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setRejecting(false);
                    setNote("");
                  }}
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={pending}
                onClick={() => run("confirmado")}
                className="studio-btn studio-btn-primary studio-btn-xs"
              >
                {pending ? "Confirmando…" : "Confirmar pago"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setRejecting(true)}
                className="studio-btn studio-btn-ghost studio-btn-xs"
              >
                Rechazar
              </button>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--wine)", margin: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

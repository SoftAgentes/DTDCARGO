/**
 * Detalle de factura — card total navy + desglose IVA + datos + acciones +
 * recibos de cobranza con link al imprimible (SDD-0068).
 *
 * SDD-0021. Server component lee la factura por code. Las acciones (emitir,
 * registrar pago, anular, editar) se delegan al InvoiceDetailClient.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getInvoiceByCode } from "@/lib/studio/invoice-queries";
import { getFiscalSettingsSafe } from "@/lib/studio/fiscal/queries";
import { listCashAccounts, listReceipts } from "@/lib/studio/payment-queries";
import {
  computeBalance,
  currencyLabel,
  displayStatus,
  isOverdue,
  statusBadgeTone,
  statusLabel,
} from "@/lib/studio/invoice-types";
import {
  applicationStatusLabel,
  applicationStatusTone,
  fundClassLabel,
  fundClassTone,
  paymentMethodLabel,
} from "@/lib/studio/payment-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { InvoiceDetailClient } from "../_components/InvoiceDetailClient";

export const metadata = { title: "Detalle factura" };

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const [invoice, ivaRow, cashAccounts, fiscal] = await Promise.all([
    getInvoiceByCode(supabase, code),
    supabase.from("tenants").select("iva_enabled").maybeSingle(),
    listCashAccounts(supabase),
    getFiscalSettingsSafe(supabase),
  ]);
  if (!invoice) notFound();

  // Recibos de cobranza de la factura (SDD-0068) — con link al imprimible.
  const receipts = await listReceipts(supabase, { invoiceId: invoice.id });

  const ivaOn = (ivaRow.data as { iva_enabled?: boolean } | null)?.iva_enabled ?? false;
  const ds = displayStatus(invoice);
  const overdue = isOverdue(invoice);
  const balance = computeBalance(invoice);
  const hasIvaBreakdown = Number(invoice.iva_rate) > 0;

  return (
    <div style={{ maxWidth: 1100 }}>
      <Link
        href="/studio/facturacion"
        style={{
          font: "500 12px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 14 }}>←</span> Volver al listado
      </Link>

      <InvoiceDetailClient
        invoice={invoice}
        ivaOn={ivaOn}
        fiscalModuleEnabled={fiscal.fiscal_module_enabled}
        defaultIvaMode={fiscal.default_invoice_iva_mode}
        ivaRateGeneral={fiscal.iva_rate_general}
        cashAccounts={cashAccounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <span
          style={{
            font: "800 18px/1 var(--f-mono)",
            color: "var(--ink)",
            letterSpacing: "0.02em",
            padding: "8px 14px",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--border)",
          }}
        >
          {invoice.invoice_code}
        </span>
        <h1
          className="studio-display"
          style={{
            fontSize: 24,
            margin: 0,
            color: "var(--ink)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {invoice.client_name}
        </h1>
        <Badge tone={statusBadgeTone(ds)} size="md" dot>
          {statusLabel(ds)}
        </Badge>
      </div>

      {/* Total card navy (hero) */}
      <section
        style={{
          background: "var(--ink)",
          color: "var(--ink-inv)",
          borderRadius: "var(--r-lg)",
          padding: "24px 26px",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                font: "600 10.5px/1 var(--f-sans)",
                color: "var(--ink-inv-mute)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Total facturado
            </div>
            <div
              style={{
                font: "900 42px/1 var(--f-display)",
                color: "var(--ink-inv)",
                letterSpacing: "-0.02em",
                marginTop: 8,
              }}
            >
              ${fmt(invoice.total_amount)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                font: "600 10.5px/1 var(--f-sans)",
                color: "var(--ink-inv-mute)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Saldo
            </div>
            <div
              style={{
                font: "900 42px/1 var(--f-display)",
                color: balance > 0 ? "var(--wine-soft)" : "var(--success)",
                letterSpacing: "-0.02em",
                marginTop: 8,
              }}
            >
              ${fmt(balance)}
            </div>
          </div>
        </div>

        {hasIvaBreakdown && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--ink-inv-mute)",
              display: "flex",
              gap: 28,
              flexWrap: "wrap",
              font: "500 12.5px/1.4 var(--f-sans)",
              color: "var(--ink-inv-soft)",
            }}
          >
            <span>
              Base imponible:{" "}
              <strong style={{ font: "700 12.5px/1 var(--f-mono)" }}>
                ${fmt(invoice.base_amount)}
              </strong>
            </span>
            <span>
              IVA {Number(invoice.iva_rate).toFixed(0)}%:{" "}
              <strong style={{ font: "700 12.5px/1 var(--f-mono)" }}>
                ${fmt(invoice.iva_amount)}
              </strong>
            </span>
          </div>
        )}

        <div
          style={{
            marginTop: hasIvaBreakdown ? 12 : 16,
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-inv-soft)",
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <span>
            Pagado:{" "}
            <strong style={{ font: "700 12px/1 var(--f-mono)" }}>
              ${fmt(invoice.paid_amount)}
            </strong>
          </span>
          {invoice.due_date && (
            <span>
              Vence:{" "}
              <strong
                style={{
                  font: "700 12px/1 var(--f-mono)",
                  color: overdue ? "var(--wine-soft)" : "var(--ink-inv)",
                }}
              >
                {invoice.due_date}
              </strong>
            </span>
          )}
        </div>
      </section>

      {/* Grid de datos */}
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 24,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <FieldLink
          label="Cliente"
          value={invoice.client_name}
          href={`/studio/clientes/${invoice.client_markbox}`}
        />
        <FieldLink
          label="Shipping Mark"
          value={invoice.client_markbox}
          href={`/studio/clientes/${invoice.client_markbox}`}
          mono
        />
        {invoice.shipment_id ? (
          <FieldLink
            label="Embarque"
            value={invoice.shipment_code ?? "Ver embarque"}
            href={`/studio/tracking/${invoice.shipment_id}`}
            mono
          />
        ) : (
          <Field label="Embarque" value={invoice.shipment_code ?? "—"} mono />
        )}
        <Field label="Moneda" value={currencyLabel(invoice.currency)} />
        {invoice.fx_rate != null && (
          <Field
            label="Tasa FX (BCV)"
            value={Number(invoice.fx_rate).toFixed(4)}
            mono
          />
        )}
        <Field label="Emitida" value={invoice.issued_at ?? "—"} mono />
        <Field label="Vence" value={invoice.due_date ?? "—"} mono />
        <Field label={`Saldo (${invoice.currency})`} value={`$${fmt(balance)}`} mono />
      </section>

      {/* Tabla de líneas */}
      {invoice.lines.length > 0 && (
        <section
          style={{
            marginTop: 20,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 120px 120px",
              gap: 12,
              padding: "12px 20px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Descripción</span>
            <span style={{ textAlign: "right" }}>Cant.</span>
            <span style={{ textAlign: "right" }}>Precio</span>
            <span style={{ textAlign: "right" }}>Subtotal</span>
          </div>
          {invoice.lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 120px 120px",
                gap: 12,
                padding: "12px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
              }}
            >
              <span
                style={{ font: "500 13px/1.3 var(--f-sans)", color: "var(--ink)" }}
              >
                {l.desc}
              </span>
              <span
                style={{
                  font: "600 12px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                }}
              >
                {l.qty}
              </span>
              <span
                style={{
                  font: "600 12px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                }}
              >
                ${fmt(l.unitPrice)}
              </span>
              <span
                style={{
                  font: "700 12.5px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                ${fmt(l.qty * l.unitPrice)}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Recibos de cobranza (SDD-0068) */}
      {receipts.length > 0 && (
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
            Recibos de cobranza · {receipts.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {receipts.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 0",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  {r.receipt_code}
                </span>
                <Badge tone={applicationStatusTone(r.application_status)} size="sm">
                  {applicationStatusLabel(r.application_status)}
                </Badge>
                <Badge tone={fundClassTone(r.fund_class)} size="sm">
                  {fundClassLabel(r.fund_class)}
                </Badge>
                <span
                  style={{
                    font: "500 11px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    flex: 1,
                    minWidth: 140,
                  }}
                >
                  {paymentMethodLabel(r.method)} · {r.received_at}
                  {r.payer_kind === "tercero" && r.payer_name
                    ? ` · pagó ${r.payer_name} (tercero)`
                    : ""}
                </span>
                <span
                  style={{
                    font: "800 12.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  ${fmt(r.amount)}
                </span>
                <Link
                  href={`/studio/cobranzas/recibo/${encodeURIComponent(r.receipt_code)}`}
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                >
                  Ver recibo
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {invoice.notes && (
        <section
          style={{
            marginTop: 20,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: 20,
          }}
        >
          <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
            Notas
          </div>
          <p
            style={{
              font: "500 13px/1.5 var(--f-sans)",
              color: "var(--ink)",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {invoice.notes}
          </p>
        </section>
      )}
    </div>
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
            ? "600 13px/1.3 var(--f-mono)"
            : "500 13px/1.4 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FieldLink({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string;
  href: string;
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
      <Link
        href={href}
        style={{
          font: mono
            ? "600 13px/1.3 var(--f-mono)"
            : "500 13px/1.4 var(--f-sans)",
          color: "var(--wine)",
          textDecoration: "none",
        }}
      >
        {value}
      </Link>
    </div>
  );
}

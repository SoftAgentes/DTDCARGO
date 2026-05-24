/**
 * Detalle de cotización — card total + datos + acciones + link a shipment.
 *
 * SDD-0011. Server component lee la quote por code. Las acciones se delegan
 * al QuoteDetailClient.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getQuoteByCode } from "@/lib/studio/quote-queries";
import {
  isExpired,
  packagingLabel,
  statusBadgeTone,
  statusLabel,
} from "@/lib/studio/quote-types";
import { SERVICE_LABELS } from "@/lib/studio/shipment-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { QuoteDetailClient } from "../_components/QuoteDetailClient";

export const metadata = { title: "Detalle cotización" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const quote = await getQuoteByCode(supabase, code);
  if (!quote) notFound();

  const expired = isExpired(quote);
  const displayStatus = expired ? "expired" : quote.status;

  return (
    <div style={{ maxWidth: 1100 }}>
      <Link
        href="/studio/cotizador"
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

      <QuoteDetailClient quote={quote} />

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
          {quote.quote_code}
        </span>
        <h1
          className="studio-display"
          style={{ fontSize: 24, margin: 0, color: "var(--ink)", flex: 1, minWidth: 0 }}
        >
          {quote.client_name}
        </h1>
        <Badge tone={statusBadgeTone(displayStatus)} size="md" dot>
          {statusLabel(displayStatus)}
        </Badge>
      </div>

      {/* Link al shipment si se convirtió */}
      {quote.converted_to_shipment_id && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            background: "var(--success-bg)",
            border: "1px solid var(--success)",
            borderRadius: "var(--r-sm)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              font: "500 13px/1.4 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            ✓ Esta cotización ya fue convertida a un embarque.
          </span>
          <Link
            href={`/studio/tracking/${quote.converted_to_shipment_id}`}
            className="studio-btn studio-btn-dark studio-btn-sm"
          >
            Ver embarque →
          </Link>
        </div>
      )}

      {/* Total card navy */}
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
            font: "600 10.5px/1 var(--f-sans)",
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Total cotizado
        </div>
        <div
          style={{
            font: "900 42px/1 var(--f-display)",
            color: "#fff",
            letterSpacing: "-0.02em",
            marginTop: 8,
          }}
        >
          $
          {Number(quote.total_usd).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div
          style={{
            marginTop: 10,
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "rgba(255,255,255,0.65)",
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <span>
            Subtotal:{" "}
            <strong style={{ font: "700 12.5px/1 var(--f-mono)", color: "#fff" }}>
              ${Number(quote.subtotal_usd).toFixed(2)}
            </strong>
          </span>
          {Number(quote.packaging_cost) > 0 && (
            <span>
              Embalaje:{" "}
              <strong style={{ font: "700 12.5px/1 var(--f-mono)", color: "#fff" }}>
                +${Number(quote.packaging_cost).toFixed(2)}
              </strong>
            </span>
          )}
          <span>
            Vigencia:{" "}
            <strong style={{ color: "var(--wine-soft)", fontWeight: 700 }}>
              {quote.valid_until}
            </strong>
          </span>
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
        <Field label="Cliente" value={quote.client_name} />
        <Field label="MARKBOX" value={quote.client_markbox} mono />
        <Field label="Servicio" value={SERVICE_LABELS[quote.service].primary} />
        <Field
          label="Tarifa"
          value={
            quote.rate_per_cbm != null
              ? `$${Number(quote.rate_per_cbm).toFixed(2)}/CBM`
              : quote.flat_rate != null
                ? `$${Number(quote.flat_rate).toLocaleString("en-US")} flat`
                : "—"
          }
          mono
        />
        <Field label="Origen" value={quote.origin} />
        <Field label="Destino" value={quote.destination} />
        <Field
          label="Volumen"
          value={quote.cbm != null ? `${Number(quote.cbm).toFixed(3)} m³` : "—"}
          mono
        />
        <Field
          label="Peso"
          value={
            quote.weight_kg != null ? `${Number(quote.weight_kg).toFixed(2)} kg` : "—"
          }
          mono
        />
        <Field
          label="Cajas"
          value={quote.boxes != null ? String(quote.boxes) : "—"}
          mono
        />
        <Field label="Embalaje" value={packagingLabel(quote.packaging)} />
        <Field
          label="Creada"
          value={formatDate(quote.created_at)}
          mono
        />
        <Field
          label="Enviada"
          value={quote.sent_at ? formatDate(quote.sent_at) : "—"}
          mono
        />
      </section>

      {quote.notes && (
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
            {quote.notes}
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

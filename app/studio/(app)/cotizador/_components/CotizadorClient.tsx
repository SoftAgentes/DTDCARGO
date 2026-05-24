"use client";

/**
 * Orquestador client del módulo Cotizador (SDD-0011).
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  QUOTE_STATUS_OPTIONS,
  isExpired,
  statusBadgeTone,
  statusLabel,
  type Quote,
} from "@/lib/studio/quote-types";
import { SERVICE_LABELS } from "@/lib/studio/shipment-types";
import type { QuoteFilters } from "@/lib/studio/quote-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { QuoteDrawer } from "./QuoteDrawer";

export function CotizadorClient({
  quotes,
  filters,
}: {
  quotes: Quote[];
  filters: QuoteFilters;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setStatus(params.get("status") ?? "");
  }, [params]);

  useEffect(() => {
    const currentQ = params.get("q") ?? "";
    if (q === currentQ) return;
    const t = setTimeout(() => pushFilters({ q, status }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pushFilters = (next: { q?: string; status?: string }) => {
    const s = new URLSearchParams();
    if (next.q && next.q.trim()) s.set("q", next.q.trim());
    if (next.status) s.set("status", next.status);
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/cotizador?${qs}` : "/studio/cotizador");
    });
  };

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación comercial</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Cotizador.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            Total en vivo con tarifa del catálogo. Aceptada → convierte
            automáticamente a embarque del Tracking.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            disabled
            title="Próximamente"
          >
            Exportar
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowCreate(true)}
          >
            + NUEVA COTIZACIÓN
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.12s",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="quote-q">
            Buscar
          </label>
          <input
            id="quote-q"
            type="search"
            className="studio-input"
            placeholder="Código, cliente, MARKBOX, ruta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 200px" }}>
          <label className="studio-label" htmlFor="quote-status">
            Estado
          </label>
          <select
            id="quote-status"
            className="studio-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              pushFilters({ q, status: e.target.value });
            }}
          >
            <option value="">Todos</option>
            {QUOTE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {(q || status) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={() => {
              setQ("");
              setStatus("");
              pushFilters({});
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          eyebrow={filters.q || filters.status !== "all" ? "Sin resultados" : "Catálogo vacío"}
          title={
            filters.q || filters.status !== "all"
              ? "Ninguna cotización coincide con estos filtros."
              : "Aún no hay cotizaciones."
          }
          description={
            filters.q || filters.status !== "all"
              ? "Probá ajustar los filtros o limpiá la búsqueda."
              : "Creá tu primera cotización. El total se calcula en vivo con la tarifa del catálogo."
          }
          action={
            !filters.q && filters.status === "all" ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setShowCreate(true)}
              >
                + NUEVA COTIZACIÓN
              </button>
            ) : null
          }
        />
      ) : (
        <QuotesTable quotes={quotes} />
      )}

      {showCreate && (
        <QuoteDrawer mode="create" onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function QuotesTable({ quotes }: { quotes: Quote[] }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "130px 1.4fr 140px 1.2fr 80px 110px 110px 110px",
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
        <span>Código</span>
        <span>Cliente</span>
        <span>Servicio</span>
        <span>Ruta</span>
        <span style={{ textAlign: "right" }}>CBM</span>
        <span style={{ textAlign: "right" }}>Total</span>
        <span>Estado</span>
        <span>Vigencia</span>
      </div>

      {quotes.map((quote, i) => {
        const expired = isExpired(quote);
        const displayStatus = expired ? "expired" : quote.status;
        return (
          <Link
            key={quote.id}
            href={`/studio/cotizador/${quote.quote_code}`}
            className="studio-tracking-row"
            style={{
              display: "grid",
              gridTemplateColumns: "130px 1.4fr 140px 1.2fr 80px 110px 110px 110px",
              gap: 12,
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                font: "700 12px/1 var(--f-mono)",
                color: "var(--ink)",
                letterSpacing: "0.02em",
              }}
            >
              {quote.quote_code}
            </span>
            <div
              style={{
                font: "500 12px/1.3 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
              }}
            >
              <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {quote.client_name}
              </div>
              <div
                style={{
                  font: "600 11px/1 var(--f-mono)",
                  color: "var(--wine)",
                  marginTop: 3,
                }}
              >
                {quote.client_markbox}
              </div>
            </div>
            <span
              style={{
                font: "600 11.5px/1 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              {SERVICE_LABELS[quote.service].primary}
            </span>
            <span
              style={{
                font: "500 12px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {quote.origin} → {quote.destination}
            </span>
            <span
              style={{
                font: "600 12px/1 var(--f-mono)",
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              {quote.cbm != null ? quote.cbm.toFixed(2) : "—"}
            </span>
            <span
              style={{
                font: "800 13px/1 var(--f-mono)",
                color: "var(--wine)",
                textAlign: "right",
              }}
            >
              ${Number(quote.total_usd).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span>
              <Badge
                tone={statusBadgeTone(displayStatus as Quote["status"])}
                size="sm"
                dot
              >
                {statusLabel(displayStatus as Quote["status"])}
              </Badge>
            </span>
            <span
              style={{
                font: "500 11px/1 var(--f-mono)",
                color: "var(--ink-soft)",
              }}
            >
              {quote.valid_until}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

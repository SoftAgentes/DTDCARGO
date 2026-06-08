"use client";

/**
 * AlmacenVeClient — orquestador client del módulo Almacén VE (SDD-0017).
 *
 * Vista derivada de shipments en estados VE-relevant.
 * - Toolbar con search + port substring + status filter (URL-state)
 * - Tabla 9 columnas
 * - Row actions menú con 4-5 acciones según status
 * - Empty state si no hay shipments en estados VE
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { VeFilters } from "@/lib/studio/warehouse-ve-queries";
import type { VeReceiptRow } from "@/lib/studio/warehouse-ve-types";
import { VE_STATUS_OPTIONS } from "@/lib/studio/warehouse-ve-types";
import { VeStatusBadge } from "./VeStatusBadge";
import { VeRowActions } from "./VeRowActions";

interface Props {
  rows: VeReceiptRow[];
  filters: VeFilters;
}

export function AlmacenVeClient({ rows, filters: _filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [port, setPort] = useState(params.get("port") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setPort(params.get("port") ?? "");
    setStatus(params.get("status") ?? "");
  }, [params]);

  // Debounce search → URL
  useEffect(() => {
    const currentQ = params.get("q") ?? "";
    if (q === currentQ) return;
    const t = setTimeout(() => pushFilters({ q, port, status }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Debounce port input similar a q
  useEffect(() => {
    const currentPort = params.get("port") ?? "";
    if (port === currentPort) return;
    const t = setTimeout(() => pushFilters({ q, port, status }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port]);

  const pushFilters = (next: {
    q?: string;
    port?: string;
    status?: string;
  }) => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("q");
    sp.delete("port");
    sp.delete("status");
    if (next.q?.trim()) sp.set("q", next.q.trim());
    if (next.port?.trim()) sp.set("port", next.port.trim());
    if (next.status) sp.set("status", next.status);
    const qs = sp.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const hasActiveFilters = Boolean(q || port || status);

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 260px", minWidth: 220 }}>
          <label className="studio-label" htmlFor="ve-q">
            Buscar
          </label>
          <input
            id="ve-q"
            type="search"
            className="studio-input"
            placeholder="Code, cliente, Shipping Mark, dirección…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 200px" }}>
          <label className="studio-label" htmlFor="ve-port">
            Puerto / destino
          </label>
          <input
            id="ve-port"
            type="text"
            className="studio-input"
            placeholder="La Guaira, Valencia…"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 220px" }}>
          <label className="studio-label" htmlFor="ve-status">
            Estado
          </label>
          <select
            id="ve-status"
            className="studio-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              pushFilters({ q, port, status: e.target.value });
            }}
          >
            <option value="">Todos los estados</option>
            {VE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={() => {
              setQ("");
              setPort("");
              setStatus("");
              pushFilters({});
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla o empty */}
      {rows.length === 0 ? (
        <EmptyState
          eyebrow={hasActiveFilters ? "Sin resultados" : "Sin operación VE activa"}
          title={
            hasActiveFilters
              ? "Ningún shipment coincide con esos filtros."
              : "No hay shipments en estados VE-relevant."
          }
          description={
            hasActiveFilters
              ? "Probá ajustar los filtros o limpiá la búsqueda."
              : "Cuando un container arribe al puerto VE, aparece acá hasta su entrega final con POD."
          }
        />
      ) : (
        <VeReceiptsTable rows={rows} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabla
// ─────────────────────────────────────────────────────────────

function VeReceiptsTable({ rows }: { rows: VeReceiptRow[] }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "130px minmax(160px, 1.4fr) 130px minmax(180px, 1.6fr) 70px 90px 100px 160px 60px",
          gap: 12,
          padding: "12px 18px",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          alignItems: "center",
        }}
      >
        <span>Embarque</span>
        <span>Cliente</span>
        <span>Puerto</span>
        <span>Dirección final</span>
        <span style={{ textAlign: "right" }}>Peso (kg)</span>
        <span style={{ textAlign: "right" }}>CBM</span>
        <span>Entregado</span>
        <span>Estado</span>
        <span style={{ textAlign: "right" }}>·</span>
      </div>

      {rows.map((r, i) => (
        <VeRow key={r.id} row={r} hasBorderTop={i > 0} />
      ))}
    </div>
  );
}

function VeRow({
  row,
  hasBorderTop,
}: {
  row: VeReceiptRow;
  hasBorderTop: boolean;
}) {
  const cbmDisplay =
    row.volume_m3 != null
      ? Number(row.volume_m3).toLocaleString("es-VE", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        })
      : "—";

  const deliveredDisplay = row.delivered_at
    ? formatDate(row.delivered_at)
    : "—";

  return (
    <div
      className="studio-tracking-row"
      style={{
        display: "grid",
        gridTemplateColumns:
          "130px minmax(160px, 1.4fr) 130px minmax(180px, 1.6fr) 70px 90px 100px 160px 60px",
        gap: 12,
        padding: "14px 18px",
        borderTop: hasBorderTop ? "1px solid var(--border)" : 0,
        alignItems: "center",
      }}
    >
      {/* Embarque code */}
      <code
        style={{
          font: "800 11.5px/1 var(--f-mono)",
          color: "var(--wine)",
          letterSpacing: "0.02em",
        }}
      >
        {row.code}
      </code>

      {/* Cliente */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "600 12.5px/1.2 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.client_name ?? "—"}
        </div>
        {row.client_markbox && (
          <code
            style={{
              font: "700 11px/1 var(--f-mono)",
              color: "var(--wine)",
            }}
          >
            {row.client_markbox}
          </code>
        )}
      </div>

      {/* Puerto destino (es el destination del shipment) */}
      <span
        style={{
          font: "600 12px/1.3 var(--f-sans)",
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={row.destination ?? undefined}
      >
        {row.destination ?? "—"}
      </span>

      {/* Dirección final */}
      <span
        style={{
          font: "500 12px/1.3 var(--f-sans)",
          color: row.delivery_address ? "var(--ink-soft)" : "var(--ink-mute)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={row.delivery_address ?? undefined}
      >
        {row.delivery_address ?? "—"}
      </span>

      {/* Peso en kg (shipments no tiene boxes count individual) */}
      <span
        className="mono"
        style={{
          font: "700 12px/1 var(--f-mono)",
          color: row.weight_kg != null ? "var(--ink)" : "var(--ink-mute)",
          textAlign: "right",
        }}
      >
        {row.weight_kg != null ? Math.round(Number(row.weight_kg)) : "—"}
      </span>

      {/* CBM */}
      <span
        className="mono"
        style={{
          font: "700 12.5px/1 var(--f-mono)",
          color: row.volume_m3 != null ? "var(--wine)" : "var(--ink-mute)",
          textAlign: "right",
        }}
      >
        {cbmDisplay}
      </span>

      {/* Entregado fecha */}
      <span
        className="mono"
        style={{
          font: "500 11.5px/1 var(--f-mono)",
          color: row.delivered_at ? "var(--success)" : "var(--ink-mute)",
        }}
      >
        {deliveredDisplay}
      </span>

      {/* Status */}
      <span>
        <VeStatusBadge status={row.status} />
      </span>

      {/* Actions menu */}
      <span style={{ textAlign: "right" }}>
        <VeRowActions
          shipmentId={row.id}
          status={row.status}
          currentDeliveryAddress={row.delivery_address}
        />
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

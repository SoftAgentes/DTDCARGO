"use client";

/**
 * AlmacenCnClient — orquestador client del módulo Almacén CN (SDD-0016).
 *
 * - Toolbar con filtros (search debounced + hub + status) sincronizada con URL
 * - Tabla de recepciones con LangToggle aplicado al render
 * - Drawer "Nueva recepción" abierto vía estado local + ?view=create
 * - Empty state cuando no hay rows
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  HUB_GROUPS,
  RECEIPT_STATUS_OPTIONS,
  isChinese,
  parseLangFromParam,
  pickBilingual,
  type LangDisplay,
  type WarehouseCN,
  type WarehouseReceiptRow,
  type WarehouseReceiptStatus,
} from "@/lib/studio/warehouse-cn-types";
import type { Client } from "@/lib/studio/client-types";
import type { DispatchCity } from "@/lib/studio/dispatch-routes-types";
import type { ReceiptFilters } from "@/lib/studio/warehouse-cn-queries";
import { ReceiptStatusBadge } from "./ReceiptStatusBadge";
import { ReceiptRowActions } from "./ReceiptRowActions";
import { NewReceiptDrawer } from "./NewReceiptDrawer";

interface Props {
  receipts: WarehouseReceiptRow[];
  warehouses: WarehouseCN[];
  clients: Client[];
  cities: DispatchCity[];
  filters: ReceiptFilters;
}

export function AlmacenCnClient({
  receipts,
  warehouses,
  clients,
  cities,
  filters,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const lang: LangDisplay = parseLangFromParam(params.get("lang"));
  const [drawerOpen, setDrawerOpen] = useState(params.get("view") === "create");

  // Filtros locales sincronizados con URL
  const [q, setQ] = useState(params.get("q") ?? "");
  const [hub, setHub] = useState(params.get("hub") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");

  // Re-sincronizar si la URL cambia desde afuera
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setHub(params.get("hub") ?? "");
    setStatus(params.get("status") ?? "");
    setDrawerOpen(params.get("view") === "create");
  }, [params]);

  // Debounce search → URL
  useEffect(() => {
    const currentQ = params.get("q") ?? "";
    if (q === currentQ) return;
    const t = setTimeout(() => pushFilters({ q, hub, status }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pushFilters = (next: {
    q?: string;
    hub?: string;
    status?: string;
  }) => {
    // Clonar para preservar params no relacionados (lang, view, futuros).
    const sp = new URLSearchParams(params.toString());
    sp.delete("q");
    sp.delete("hub");
    sp.delete("status");
    if (next.q?.trim()) sp.set("q", next.q.trim());
    if (next.hub) sp.set("hub", next.hub);
    if (next.status) sp.set("status", next.status);
    const qs = sp.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const openDrawer = () => {
    setDrawerOpen(true);
    const sp = new URLSearchParams(params.toString());
    sp.set("view", "create");
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    const sp = new URLSearchParams(params.toString());
    sp.delete("view");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    router.refresh();
  };

  const hasActiveFilters = Boolean(q || hub || status);

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
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.12s",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="cn-q">
            Buscar
          </label>
          <input
            id="cn-q"
            type="search"
            className="studio-input"
            placeholder="Recibo, cliente, MARKBOX, supplier…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 180px" }}>
          <label className="studio-label" htmlFor="cn-hub">
            Hub
          </label>
          <select
            id="cn-hub"
            className="studio-input"
            value={hub}
            onChange={(e) => {
              setHub(e.target.value);
              pushFilters({ q, hub: e.target.value, status });
            }}
          >
            <option value="">Todos los hubs</option>
            {HUB_GROUPS.map((g) => (
              <option key={g.code} value={g.code}>
                {g.nameEs} · {g.nameCn}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 220px" }}>
          <label className="studio-label" htmlFor="cn-status">
            Estado
          </label>
          <select
            id="cn-status"
            className="studio-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              pushFilters({ q, hub, status: e.target.value });
            }}
          >
            <option value="">Todos los estados</option>
            {RECEIPT_STATUS_OPTIONS.map((opt) => (
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
              setHub("");
              setStatus("");
              pushFilters({});
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla o empty */}
      {receipts.length === 0 ? (
        <EmptyState
          eyebrow={hasActiveFilters ? "Sin resultados" : "Sin recepciones"}
          title={
            hasActiveFilters
              ? "Ninguna recepción coincide con esos filtros."
              : "Todavía no se registró ninguna recepción CN."
          }
          description={
            hasActiveFilters
              ? "Probá ajustar la búsqueda o limpiá los filtros."
              : "Cuando llegue la primera caja del supplier a un hub, registrala acá."
          }
          action={
            !hasActiveFilters ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={openDrawer}
              >
                + Nueva recepción
              </button>
            ) : null
          }
        />
      ) : (
        <ReceiptsTable
          rows={receipts}
          lang={lang}
          cities={cities}
          onCreateClick={openDrawer}
        />
      )}

      {drawerOpen && (
        <NewReceiptDrawer
          warehouses={warehouses}
          clients={clients}
          onClose={closeDrawer}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabla de recepciones
// ─────────────────────────────────────────────────────────────

function ReceiptsTable({
  rows,
  lang,
  cities,
  onCreateClick: _onCreateClick,
}: {
  rows: WarehouseReceiptRow[];
  lang: LangDisplay;
  cities: DispatchCity[];
  onCreateClick: () => void;
}) {
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
            "150px minmax(160px, 1.4fr) minmax(140px, 1.4fr) 90px 78px 90px 80px 72px 120px 60px",
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
        <span>Recepción</span>
        <span>Cliente</span>
        <span>Proveedor CN</span>
        <span>Hub</span>
        <span style={{ textAlign: "right" }}>Cajas</span>
        <span style={{ textAlign: "right" }}>CBM</span>
        <span style={{ textAlign: "right" }}>Peso</span>
        <span style={{ textAlign: "right" }}>Items</span>
        <span>Estado</span>
        <span style={{ textAlign: "right" }}>·</span>
      </div>

      {rows.map((r, i) => (
        <ReceiptRow
          key={r.id}
          row={r}
          lang={lang}
          cities={cities}
          hasBorderTop={i > 0}
        />
      ))}
    </div>
  );
}

function ReceiptRow({
  row,
  lang,
  cities,
  hasBorderTop,
}: {
  row: WarehouseReceiptRow;
  lang: LangDisplay;
  cities: DispatchCity[];
  hasBorderTop: boolean;
}) {
  // Supplier bilingual display
  const sup = pickBilingual(
    row.supplier_name,
    row.supplier_name_translated,
    lang,
  );

  // Hub label según lang
  const hubLabel =
    lang === "cn"
      ? row.warehouse.hub_name_cn
      : lang === "es"
        ? row.warehouse.hub_name_es
        : row.warehouse.code;

  const hubSub =
    lang === "cn"
      ? row.warehouse.code
      : lang === "es"
        ? row.warehouse.code
        : `${row.warehouse.hub_name_es} · ${row.warehouse.hub_name_cn}`;

  const cbmDisplay =
    row.total_cbm != null
      ? Number(row.total_cbm).toLocaleString("es-VE", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        })
      : "—";

  const weightDisplay =
    row.total_weight_kg != null
      ? `${Number(row.total_weight_kg).toLocaleString("es-VE", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} kg`
      : "—";

  const receivedDisplay = formatReceivedDate(row.received_at);

  return (
    <div
      className="studio-tracking-row"
      style={{
        display: "grid",
        gridTemplateColumns:
          "150px minmax(160px, 1.4fr) minmax(140px, 1.4fr) 90px 70px 90px 80px 60px 160px 60px",
        gap: 12,
        padding: "14px 18px",
        borderTop: hasBorderTop ? "1px solid var(--border)" : 0,
        alignItems: "center",
      }}
    >
      {/* Recepción code */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <code
          style={{
            font: "800 11.5px/1 var(--f-mono)",
            color: row.is_orphan ? "var(--warning)" : "var(--ink)",
            letterSpacing: "0.02em",
          }}
        >
          {row.receipt_code}
        </code>
        <span
          style={{
            font: "500 10.5px/1 var(--f-mono)",
            color: "var(--ink-mute)",
          }}
        >
          {receivedDisplay}
        </span>
      </div>

      {/* Cliente o huérfana */}
      <div style={{ minWidth: 0 }}>
        {row.is_orphan ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Badge tone="warning" size="sm">
              {Icon.box(10)} Huérfana
            </Badge>
            {row.orphan_marks && (
              <span
                style={{
                  font: "500 11px/1.2 var(--f-sans)",
                  color: "var(--ink-soft)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={row.orphan_marks}
              >
                {row.orphan_marks}
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span
              style={{
                font: "600 12.5px/1.2 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.client_name ?? "—"}
            </span>
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
        )}
      </div>

      {/* Supplier bilingüe */}
      <div style={{ minWidth: 0 }}>
        {sup.primary ? (
          <>
            <div
              style={{
                font: `500 12.5px/1.3 ${isChinese(sup.primary) ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"}`,
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={sup.primary}
            >
              {sup.primary}
            </div>
            {sup.secondary && lang !== "original" && (
              <div
                style={{
                  font: `500 10.5px/1.3 ${isChinese(sup.secondary) ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"}`,
                  color: "var(--ink-mute)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={sup.secondary}
              >
                {sup.secondary}
              </div>
            )}
          </>
        ) : (
          <span style={{ color: "var(--ink-mute)" }}>—</span>
        )}
      </div>

      {/* Hub */}
      <div style={{ minWidth: 0 }}>
        <Badge tone="info" size="sm">
          <span
            style={{
              fontFamily:
                lang === "cn"
                  ? '"Noto Sans SC", var(--f-sans)'
                  : "var(--f-sans)",
            }}
          >
            {hubLabel}
          </span>
        </Badge>
        <div
          style={{
            font: `500 9.5px/1.3 ${lang === "original" ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"}`,
            color: "var(--ink-mute)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={hubSub}
        >
          {hubSub}
        </div>
      </div>

      {/* Cajas */}
      <span
        className="mono"
        style={{
          font: "700 12.5px/1 var(--f-mono)",
          color: "var(--ink)",
          textAlign: "right",
        }}
      >
        {row.boxes}
      </span>

      {/* CBM */}
      <span
        className="mono"
        style={{
          font: "700 12.5px/1 var(--f-mono)",
          color: row.total_cbm != null ? "var(--wine)" : "var(--ink-mute)",
          textAlign: "right",
        }}
      >
        {cbmDisplay}
      </span>

      {/* Peso */}
      <span
        className="mono"
        style={{
          font: "500 11.5px/1 var(--f-mono)",
          color:
            row.total_weight_kg != null ? "var(--ink-soft)" : "var(--ink-mute)",
          textAlign: "right",
        }}
      >
        {weightDisplay}
      </span>

      {/* Items count */}
      <span
        style={{
          font: "600 11.5px/1 var(--f-mono)",
          color: "var(--ink-soft)",
          textAlign: "right",
        }}
      >
        {row.items_count}
      </span>

      {/* Status */}
      <span>
        <ReceiptStatusBadge status={row.status} />
      </span>

      {/* Actions */}
      <span style={{ textAlign: "right" }}>
        <ReceiptRowActions
          receiptId={row.id}
          currentStatus={row.status as WarehouseReceiptStatus}
          cities={cities}
          currentDestinationCity={row.destination_city ?? null}
          currentPaymentStatus={row.payment_status}
        />
      </span>
    </div>
  );
}

function formatReceivedDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, (m ?? 1) - 1, d ?? 1);
    return date.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

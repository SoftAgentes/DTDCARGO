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
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  HUB_GROUPS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  RECEIPT_STATUS_OPTIONS,
  RECEIPT_STATUS_LABEL_KEYS,
  isChinese,
  parseLangFromParam,
  pickBilingual,
  type LangDisplay,
  type WarehouseCN,
  type WarehouseReceiptItemSummary,
  type WarehouseReceiptRow,
  type WarehouseReceiptStatus,
} from "@/lib/studio/warehouse-cn-types";
import {
  useT,
  useLocale,
  formatNumber,
  resolveErrorMessage,
  type I18nKey,
} from "@/lib/i18n";
import type { Client } from "@/lib/studio/client-types";
import type { DispatchCity } from "@/lib/studio/dispatch-routes-types";
import type { ReceiptFilters } from "@/lib/studio/warehouse-cn-queries";
import { ReceiptStatusBadge } from "./ReceiptStatusBadge";
import { ReceiptRowActions } from "./ReceiptRowActions";
import { NewReceiptDrawer } from "./NewReceiptDrawer";
import {
  bulkChangeReceiptPaymentStatusAction,
  bulkChangeReceiptStatusAction,
} from "../actions";

interface Props {
  receipts: WarehouseReceiptRow[];
  warehouses: WarehouseCN[];
  clients: Client[];
  cities: DispatchCity[];
  filters: ReceiptFilters;
  /** shipment_ids con alerta de gastos activa → chip en la row consolidada. */
  alertShipmentIds?: string[];
  /** Si false (user region=cn no-admin), se oculta el toggle "Mostrar nombres"
   *  y el server ya redactó client_name. Default true (compat). */
  canSeeClientNames?: boolean;
}

export function AlmacenCnClient({
  receipts,
  warehouses,
  clients,
  cities,
  filters,
  alertShipmentIds = [],
  canSeeClientNames = true,
}: Props) {
  const alertSet = new Set(alertShipmentIds);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useT();
  const locale = useLocale();

  const lang: LangDisplay = parseLangFromParam(params.get("lang"));
  const [drawerOpen, setDrawerOpen] = useState(params.get("view") === "create");

  // Privacidad: nombre del cliente oculto por defecto (operadores CN no deberían
  // ver el nombre real del importador VE — sólo el MARKBOX).
  // TODO: cuando user_tenants tenga `region`, gatear este toggle para que sólo
  // VE pueda activarlo y el server redacte client_name para region='cn'.
  const [showClientNames, setShowClientNames] = useState(false);

  // Filtros locales sincronizados con URL
  const [q, setQ] = useState(params.get("q") ?? "");
  const [hub, setHub] = useState(params.get("hub") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");

  // Bulk selection (set de receipt IDs)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = (allIds: string[]) =>
    setSelected((prev) => {
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  const clearSelection = () => setSelected(new Set());
  // Limpiar selección cuando cambian los filtros (rows visibles cambiaron)
  useEffect(() => {
    setSelected(new Set());
  }, [params]);

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
          marginBottom: "var(--s-4)",
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity var(--dur-fast) var(--ease)",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="cn-q">
            {t("warehouse_cn.filter.search_label")}
          </label>
          <input
            id="cn-q"
            type="search"
            className="studio-input"
            placeholder={t("warehouse_cn.filter.search_placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 180px" }}>
          <label className="studio-label" htmlFor="cn-hub">
            {t("warehouse_cn.filter.hub_label")}
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
            <option value="">{t("warehouse_cn.filter.hub_all")}</option>
            {HUB_GROUPS.map((g) => (
              <option key={g.code} value={g.code}>
                {g.nameEs} · {g.nameCn}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 220px" }}>
          <label className="studio-label" htmlFor="cn-status">
            {t("warehouse_cn.filter.status_label")}
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
            <option value="">{t("warehouse_cn.filter.status_all")}</option>
            {RECEIPT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(RECEIPT_STATUS_LABEL_KEYS[opt.value])}
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
            {t("warehouse_cn.filter.clear")}
          </button>
        )}
        {/* Toggle "Mostrar nombres" · oculto para region=cn no-admin
            (el server ya redactó client_name — privacidad SDD-0039 B.9). */}
        {canSeeClientNames && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{
              height: 38,
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...(showClientNames && {
                background: "var(--wine-tint)",
                color: "var(--wine-text)",
                borderColor: "var(--wine)",
              }),
            }}
            onClick={() => setShowClientNames((v) => !v)}
            aria-pressed={showClientNames}
            title={
              showClientNames
                ? t("warehouse_cn.filter.hide_names")
                : t("warehouse_cn.filter.show_names")
            }
          >
            {showClientNames ? Icon.eyeOff(13) : Icon.eye(13)}
            <span>
              {showClientNames
                ? t("warehouse_cn.filter.hide_names")
                : t("warehouse_cn.filter.show_names")}
            </span>
          </button>
        )}
      </div>

      {/* Tabla o empty */}
      {receipts.length === 0 ? (
        <EmptyState
          eyebrow={
            hasActiveFilters
              ? t("chrome.empty.no_results")
              : t("warehouse_cn.empty.title")
          }
          title={
            hasActiveFilters
              ? t("warehouse_cn.empty.filtered_title")
              : t("warehouse_cn.empty.title")
          }
          description={
            hasActiveFilters
              ? t("warehouse_cn.empty.filtered_description")
              : t("warehouse_cn.empty.description")
          }
          action={
            !hasActiveFilters ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={openDrawer}
              >
                {t("warehouse_cn.header.new_receipt")}
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
          selected={selected}
          onToggleOne={toggleOne}
          onToggleAll={() => toggleAll(receipts.map((r) => r.id))}
          showClientNames={showClientNames}
          alertSet={alertSet}
        />
      )}

      {drawerOpen && (
        <NewReceiptDrawer
          warehouses={warehouses}
          clients={clients}
          onClose={closeDrawer}
        />
      )}

      {selected.size > 0 && (
        <>
          {/* Colchón: la BulkBar es `position: fixed`, así que flota sobre la
              tabla y tapaba la última fila. Este espacio da recorrido para
              desplazarla por encima de la barra. Solo existe mientras hay
              selección, así que no deja hueco muerto al final de la página. */}
          <div aria-hidden style={{ height: 96 }} />
          <BulkBar
            count={selected.size}
            ids={Array.from(selected)}
            onClear={clearSelection}
            onAfter={() => {
              clearSelection();
              router.refresh();
            }}
          />
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabla de recepciones
// ─────────────────────────────────────────────────────────────

// Grid template compartido por header + rows (con checkbox 32px al inicio).
// La columna "Items" se ensancha (min 200px) porque ahora muestra descripciones.
const RECEIPT_GRID_COLS =
  "32px 130px minmax(150px, 1.2fr) minmax(140px, 1.2fr) 88px 64px 78px 78px minmax(200px, 1.6fr) 150px 50px";

function ReceiptsTable({
  rows,
  lang,
  cities,
  onCreateClick: _onCreateClick,
  selected,
  onToggleOne,
  onToggleAll,
  showClientNames,
  alertSet,
}: {
  rows: WarehouseReceiptRow[];
  lang: LangDisplay;
  cities: DispatchCity[];
  onCreateClick: () => void;
  selected: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: () => void;
  showClientNames: boolean;
  alertSet: Set<string>;
}) {
  const t = useT();
  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someVisibleSelected =
    rows.some((r) => selected.has(r.id)) && !allVisibleSelected;

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
          gridTemplateColumns: RECEIPT_GRID_COLS,
          gap: "var(--s-3)",
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
        <span style={{ display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            aria-label={t("warehouse_cn.bulk.clear_selection")}
            checked={allVisibleSelected}
            ref={(el) => {
              if (el) el.indeterminate = someVisibleSelected;
            }}
            onChange={onToggleAll}
            style={{
              accentColor: "var(--wine)",
              cursor: "pointer",
              width: 16,
              height: 16,
            }}
          />
        </span>
        <span>{t("warehouse_cn.table.col_receipt")}</span>
        <span>{t("warehouse_cn.table.col_client")}</span>
        <span>{t("warehouse_cn.table.col_supplier")}</span>
        <span>{t("warehouse_cn.table.col_hub")}</span>
        <span style={{ textAlign: "right" }}>{t("warehouse_cn.table.col_boxes")}</span>
        <span style={{ textAlign: "right" }}>{t("warehouse_cn.table.col_cbm")}</span>
        <span style={{ textAlign: "right" }}>{t("warehouse_cn.table.col_weight")}</span>
        <span>{t("warehouse_cn.table.col_products")}</span>
        <span>{t("warehouse_cn.table.col_status")}</span>
        <span style={{ textAlign: "right" }}>·</span>
      </div>

      {rows.map((r, i) => (
        <ReceiptRow
          key={r.id}
          row={r}
          lang={lang}
          cities={cities}
          hasBorderTop={i > 0}
          selected={selected.has(r.id)}
          onToggle={() => onToggleOne(r.id)}
          showClientNames={showClientNames}
          hasAlert={r.shipment_id ? alertSet.has(r.shipment_id) : false}
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
  selected,
  onToggle,
  showClientNames,
  hasAlert,
}: {
  row: WarehouseReceiptRow;
  lang: LangDisplay;
  cities: DispatchCity[];
  hasBorderTop: boolean;
  selected: boolean;
  onToggle: () => void;
  showClientNames: boolean;
  hasAlert: boolean;
}) {
  const tRow = useT();
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
        gridTemplateColumns: RECEIPT_GRID_COLS,
        gap: "var(--s-3)",
        padding: "14px 18px",
        borderTop: hasBorderTop ? "1px solid var(--border)" : 0,
        alignItems: "center",
        background: selected ? "var(--wine-tint)" : "transparent",
        transition: "background var(--dur-fast) var(--ease)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>
        <input
          type="checkbox"
          aria-label={`Seleccionar ${row.receipt_code}`}
          checked={selected}
          onChange={onToggle}
          style={{
            accentColor: "var(--wine)",
            cursor: "pointer",
            width: 16,
            height: 16,
          }}
        />
      </span>
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
            color: "var(--ink-soft)",
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
                color: showClientNames ? "var(--ink)" : "var(--ink-mute)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: showClientNames ? "normal" : "0.18em",
              }}
              title={
                showClientNames
                  ? row.client_name ?? undefined
                  : "Nombre oculto · activa el ojo en la toolbar para verlo"
              }
            >
              {showClientNames ? row.client_name ?? "—" : "••••••"}
            </span>
            {row.client_markbox && (
              <code
                style={{
                  font: "800 11px/1 var(--f-mono)",
                  // En selected row el bg pasa a wine-tint → wine sobre wine-tint
                  // pierde contraste AA. Usamos --ink en ese caso.
                  color: selected ? "var(--ink)" : "var(--wine)",
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
                  color: "var(--ink-soft)",
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
            color: "var(--ink-soft)",
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

      {/* Items · descripciones (packing list) */}
      <ItemsCell items={row.items} totalCount={row.items_count} lang={lang} />

      {/* Status + payment + destino · stacked */}
      <span style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", alignItems: "flex-start" }}>
        <ReceiptStatusBadge status={row.status} />
        <Badge tone={PAYMENT_STATUS_TONES[row.payment_status]} size="sm">
          {PAYMENT_STATUS_LABELS[row.payment_status]}
        </Badge>
        {row.destination_city && (
          <span
            style={{
              font: "600 10.5px/1.2 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.02em",
            }}
            title={`Ciudad destino: ${row.destination_city}`}
          >
            → {row.destination_city}
          </span>
        )}
        {hasAlert && row.shipment_id && (
          <Link
            href={`/studio/gastos?scope=shipment&new_expense=${encodeURIComponent(row.shipment_id)}`}
            title={tRow("expenses.alert.load_btn")}
            style={{ textDecoration: "none" }}
          >
            <Badge tone="warning" size="sm">
              {Icon.bell(9)} {tRow("expenses.alert.chip")}
            </Badge>
          </Link>
        )}
      </span>

      {/* Actions */}
      <span style={{ textAlign: "right" }}>
        <ReceiptRowActions
          receiptId={row.id}
          currentStatus={row.status as WarehouseReceiptStatus}
          cities={cities}
          currentDestinationCity={row.destination_city ?? null}
          currentPaymentStatus={row.payment_status}
          invoiceVerifiedAt={row.invoice_verified_at ?? null}
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

// ─────────────────────────────────────────────────────────────
// ItemsCell · descripciones de productos al estilo packing list
// ─────────────────────────────────────────────────────────────

/**
 * Muestra el primer item + "+N más" para que la tabla refleje qué hay
 * dentro de la caja sin abrir el detalle. Tooltip con la lista completa.
 * Bilingüe: si lang preferido es CN/ES, intenta usar description_translated.
 */
function ItemsCell({
  items,
  totalCount,
  lang,
}: {
  items: WarehouseReceiptItemSummary[];
  totalCount: number;
  lang: LangDisplay;
}) {
  if (items.length === 0) {
    return (
      <span
        style={{
          font: "500 11.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
        }}
      >
        {totalCount > 0 ? `${totalCount} item${totalCount === 1 ? "" : "s"}` : "—"}
      </span>
    );
  }

  const renderText = (it: WarehouseReceiptItemSummary): string => {
    const picked = pickBilingual(it.description, it.description_translated, lang);
    return picked.primary ?? it.description;
  };

  const first = items[0];
  const remaining = items.length - 1;
  const firstText = renderText(first);
  const firstIsCn = isChinese(firstText);

  // Tooltip = lista completa "1. Producto x 5 · 8517.12.10\n2. ..."
  const tooltip = items
    .map((it, i) => {
      const text = renderText(it);
      const qty = it.quantity != null ? ` × ${it.quantity}` : "";
      const hs = it.hs_code ? ` · ${it.hs_code}` : "";
      return `${i + 1}. ${text}${qty}${hs}`;
    })
    .join("\n");

  return (
    <div style={{ minWidth: 0 }} title={tooltip}>
      <div
        style={{
          font: `600 12px/1.3 ${firstIsCn ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"}`,
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
        >
          {firstText}
        </span>
        {first.quantity != null && (
          <span
            style={{
              font: "700 10.5px/1 var(--f-mono)",
              color: "var(--ink-soft)",
              flexShrink: 0,
            }}
          >
            ×{first.quantity}
          </span>
        )}
      </div>
      {remaining > 0 && (
        <span
          style={{
            font: "600 10.5px/1.3 var(--f-sans)",
            // ink-soft (no wine) para no leer como CTA — el tooltip nativo
            // hace de revelación, no es clickeable.
            color: "var(--ink-soft)",
            cursor: "help",
            marginTop: 2,
            display: "inline-block",
          }}
        >
          +{remaining} más
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BulkBar · barra inferior con acciones masivas
// ─────────────────────────────────────────────────────────────

type BulkAction =
  | "pay_paid"
  | "pay_partial"
  | "pay_pending"
  | "status_pending"
  | "status_incident";

const BULK_LABEL_KEYS: Record<BulkAction, I18nKey> = {
  pay_paid: "warehouse_cn.bulk.pay_paid",
  pay_partial: "warehouse_cn.bulk.pay_partial",
  pay_pending: "warehouse_cn.bulk.pay_pending",
  status_pending: "warehouse_cn.bulk.status_pending",
  status_incident: "warehouse_cn.bulk.status_incident",
};

const BULK_CONFIRM_THRESHOLD = 5;

function BulkBar({
  count,
  ids,
  onClear,
  onAfter,
}: {
  count: number;
  ids: string[];
  onClear: () => void;
  onAfter: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [feedback, setFeedback] = useState<
    | { kind: "ok"; msg: string }
    | { kind: "err"; msg: string }
    | null
  >(null);

  const runAction = (action: BulkAction) => {
    setFeedback(null);
    startTransition(async () => {
      let result: { ok?: boolean; updated?: number; error?: string };
      switch (action) {
        case "pay_paid":
          result = await bulkChangeReceiptPaymentStatusAction(ids, "pagado");
          break;
        case "pay_partial":
          result = await bulkChangeReceiptPaymentStatusAction(ids, "parcial");
          break;
        case "pay_pending":
          result = await bulkChangeReceiptPaymentStatusAction(ids, "pendiente");
          break;
        case "status_pending":
          result = await bulkChangeReceiptStatusAction(
            ids,
            "pendiente_consolidacion",
          );
          break;
        case "status_incident":
          result = await bulkChangeReceiptStatusAction(ids, "incidencia");
          break;
      }
      if (result.ok) {
        setFeedback({
          kind: "ok",
          msg: t("warehouse_cn.bulk.feedback_ok", { count: result.updated ?? 0 }),
        });
        setConfirmAction(null);
        setTimeout(onAfter, 700);
      } else {
        const msg = resolveErrorMessage(t, result);
        setFeedback({
          kind: "err",
          msg: msg ?? t("warehouse_cn.bulk.feedback_error_generic"),
        });
      }
    });
  };

  const handleClick = (action: BulkAction) => {
    if (count >= BULK_CONFIRM_THRESHOLD) {
      setConfirmAction(action);
    } else {
      runAction(action);
    }
  };

  return (
    <div
      role="region"
      aria-label={t("warehouse_cn.bulk.aria_region", { count })}
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 70,
        maxWidth: "calc(100vw - 32px)",
        // Panel glass (BD-029→035). NO usar `--ink` de fondo: es el token del
        // TEXTO — en tema oscuro vale crema y la barra salía blanca sobre navy.
        // Los `--glass-*` ya traen su variante por tema, así que no se invierte.
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        color: "var(--glass-ink)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--glass-shadow), var(--glass-hi)",
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            font: "700 12.5px/1 var(--f-sans)",
            color: "var(--glass-ink)",
            whiteSpace: "nowrap",
          }}
        >
          {t(
            count === 1
              ? "warehouse_cn.bulk.selected_count_singular"
              : "warehouse_cn.bulk.selected_count",
            { count },
          )}
        </div>
        <div
          style={{
            width: 1,
            height: 20,
            background: "var(--glass-border)",
          }}
        />
        {(
          ["pay_paid", "pay_partial", "pay_pending", "status_pending", "status_incident"] as BulkAction[]
        ).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => handleClick(a)}
            disabled={pending}
            style={{
              padding: "6px 10px",
              background: "transparent",
              color: "var(--glass-ink)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--r-sm)",
              font: "600 11.5px/1 var(--f-sans)",
              cursor: pending ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t(BULK_LABEL_KEYS[a])}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          style={{
            padding: "6px 10px",
            background: "transparent",
            color: "var(--glass-ink)",
            opacity: 0.75,
            border: 0,
            font: "600 11.5px/1 var(--f-sans)",
            cursor: pending ? "wait" : "pointer",
          }}
        >
          {t("warehouse_cn.bulk.cancel_btn")}
        </button>
      </div>

      {confirmAction && (
        <div
          style={{
            background: "var(--warning-bg)",
            color: "var(--ink)",
            padding: "8px 10px",
            borderRadius: "var(--r-sm)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            font: "600 11.5px/1.3 var(--f-sans)",
          }}
        >
          <span>
            {t("warehouse_cn.bulk.confirm_question", {
              action: t(BULK_LABEL_KEYS[confirmAction]),
              count,
            })}
          </span>
          <button
            type="button"
            onClick={() => runAction(confirmAction)}
            disabled={pending}
            className="studio-btn studio-btn-primary studio-btn-xs"
          >
            {pending
              ? t("warehouse_cn.bulk.applying")
              : t("warehouse_cn.bulk.confirm_yes")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction(null)}
            disabled={pending}
            className="studio-btn studio-btn-ghost studio-btn-xs"
          >
            {t("warehouse_cn.bulk.confirm_no")}
          </button>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          style={{
            padding: "6px 10px",
            background:
              feedback.kind === "ok"
                ? "var(--success-bg)"
                : "var(--danger-bg)",
            color: feedback.kind === "ok" ? "var(--success)" : "var(--danger)",
            borderRadius: "var(--r-sm)",
            font: "600 11.5px/1.3 var(--f-sans)",
          }}
        >
          {feedback.msg}
        </div>
      )}
    </div>
  );
}

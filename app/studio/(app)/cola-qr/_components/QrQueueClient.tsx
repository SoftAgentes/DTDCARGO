"use client";

/**
 * QrQueueClient — orquestador de la cola QR (SDD-0033).
 *
 * Tabs cola / historial · filtros warehouse + priority · selección
 * múltiple · botón "Asignar impresora" → drawer · marca impresa/entregada
 * inline · cancelar con drawer.
 *
 * Auto-refresh cada 30s via router.refresh() (polling V1; Realtime V2).
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { QrQueueKpis } from "./QrQueueKpis";
import { QrQueueTable } from "./QrQueueTable";
import { BatchPrintDrawer } from "./BatchPrintDrawer";
import type { QrOrder, QrQueueFilters } from "@/lib/studio/qr-queue-types";
import type { QrQueueKpis as KpisData } from "@/lib/studio/qr-queue-queries";

const POLL_INTERVAL_MS = 30_000;

interface Props {
  orders: QrOrder[];
  kpis: KpisData;
  filters: QrQueueFilters;
  warehouses: Array<{ id: string; code: string; city: string }>;
}

export function QrQueueClient({ orders, kpis, filters, warehouses }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Auto-refresh polling
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  const changeTab = (tab: "cola" | "historial") => {
    const sp = new URLSearchParams(params.toString());
    if (tab === "cola") sp.delete("tab");
    else sp.set("tab", tab);
    setSelectedIds(new Set());
    startTransition(() => {
      router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  const changeFilter = (key: "warehouse" | "priority", value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "all") sp.delete(key);
    else sp.set(key, value);
    startTransition(() => {
      router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableIds = orders
    .filter((o) => o.status === "pendiente")
    .map((o) => o.id);

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableIds.length && selectableIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const onAfterAction = () => {
    setSelectedIds(new Set());
    router.refresh();
    setLastRefresh(new Date());
  };

  const tabsConfig: { value: "cola" | "historial"; label: string }[] = [
    { value: "cola", label: "Cola activa" },
    { value: "historial", label: "Historial" },
  ];

  return (
    <>
      <QrQueueKpis kpis={kpis} />

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 2,
          marginTop: "var(--s-5)",
          marginBottom: 14,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {tabsConfig.map((t) => {
          const active = filters.tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              onClick={() => changeTab(t.value)}
              style={{
                padding: "12px 18px",
                background: "transparent",
                border: 0,
                borderBottom: active
                  ? "2px solid var(--wine)"
                  : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: `${active ? "700" : "500"} 13px/1 var(--f-sans)`,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          padding: "var(--s-3)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <select
          className="studio-input"
          value={filters.warehouse ?? ""}
          onChange={(e) => changeFilter("warehouse", e.target.value)}
          style={{ width: 200, height: 36 }}
        >
          <option value="">Todos los almacenes</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} · {w.city}
            </option>
          ))}
        </select>

        {filters.tab === "cola" && (
          <select
            className="studio-input"
            value={filters.priority ?? "all"}
            onChange={(e) => changeFilter("priority", e.target.value)}
            style={{ width: 200, height: 36 }}
          >
            <option value="all">Todas las prioridades</option>
            <option value="urgent">Solo urgentes</option>
            <option value="normal">Solo normales</option>
          </select>
        )}

        <div style={{ flex: 1 }} />

        <span
          style={{
            font: "500 11px/1 var(--f-mono)",
            color: "var(--ink-soft)",
          }}
        >
          Refrescado {formatTime(lastRefresh)}
        </span>
        <button
          type="button"
          onClick={() => {
            router.refresh();
            setLastRefresh(new Date());
          }}
          className="studio-btn studio-btn-ghost studio-btn-sm"
        >
          Refrescar
        </button>
      </div>

      {/* Bulk actions bar (solo cola activa) */}
      {filters.tab === "cola" && selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3)",
            padding: "var(--s-3)",
            background: "var(--wine-tint)",
            border: "1px solid var(--wine)",
            borderRadius: "var(--r-md)",
            marginBottom: 14,
          }}
        >
          <Badge tone="wine" size="md">
            {selectedIds.size} seleccionada{selectedIds.size === 1 ? "" : "s"}
          </Badge>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={clearSelection}
            className="studio-btn studio-btn-ghost studio-btn-sm"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="studio-btn studio-btn-primary studio-btn-sm"
          >
            Asignar impresora
          </button>
        </div>
      )}

      {/* Tabla */}
      <QrQueueTable
        orders={orders}
        tab={filters.tab}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        selectableIds={selectableIds}
        onAfterAction={onAfterAction}
      />

      {/* Drawer asignar impresora */}
      {drawerOpen && (
        <BatchPrintDrawer
          ids={Array.from(selectedIds)}
          onClose={() => setDrawerOpen(false)}
          onSuccess={onAfterAction}
        />
      )}
    </>
  );
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

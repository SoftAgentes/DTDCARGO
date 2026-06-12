"use client";

/**
 * DispatchClient — orquestador de la Vista 1 (SDD-0029).
 *
 * Layout: KPIs row · filtros + tabla cola · panel lateral ODs activas.
 * Drawers via ?view=create-od|cancel-od|detail&od=<id>.
 * Selección de packages via state local (Set<id>).
 */

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DispatchKpis } from "./DispatchKpis";
import { DispatchQueueTable } from "./DispatchQueueTable";
import { ActiveOdsPanel } from "./ActiveOdsPanel";
import { CreateOdDrawer } from "./CreateOdDrawer";
import { CancelOdDrawer } from "./CancelOdDrawer";
import { RealtimeIndicator } from "@/app/studio/_components/ui/RealtimeIndicator";
import { useRealtimeRefresh } from "@/lib/studio/hooks/use-realtime-refresh";
import type {
  DispatchFilters,
  DispatchHub,
  DispatchOrderRow,
  EligiblePackage,
} from "@/lib/studio/dispatch-types";
import { DISPATCH_HUB_OPTIONS } from "@/lib/studio/dispatch-types";
import type { DispatchRoute } from "@/lib/studio/dispatch-routes-types";
import type { DispatchRules } from "@/lib/studio/dispatch-rules-types";
import type { DispatchKpis as KpisData } from "@/lib/studio/dispatch-queries";
import type { TmsDriver, TmsTruck } from "@/lib/studio/tms-types";

interface Props {
  queue: EligiblePackage[];
  activeOds: DispatchOrderRow[];
  rules: DispatchRules;
  kpis: KpisData;
  routes: DispatchRoute[];
  availableTrucks: TmsTruck[];
  availableDrivers: TmsDriver[];
  filters: DispatchFilters;
  tenantId: string | null;
}

export function DispatchClient({
  queue,
  activeOds,
  rules,
  kpis,
  routes,
  availableTrucks,
  availableDrivers,
  filters,
  tenantId,
}: Props) {
  // Realtime: refresh server data ante cualquier change en dispatch_orders
  // o warehouse_receipts_cn del tenant. Server recomputa joins + scoring.
  const odsRealtime = useRealtimeRefresh({
    table: "dispatch_orders",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    disabled: !tenantId,
  });
  const inboxRealtime = useRealtimeRefresh({
    table: "warehouse_receipts_cn",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    disabled: !tenantId,
  });
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const view = params.get("view");
  const odId = params.get("od");

  // Selection state: packages elegidos para una OD nueva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Carga fraccionada: cuántas cajas por package (default = boxes_total)
  const [shippedMap, setShippedMap] = useState<Map<string, number>>(new Map());

  const toggleSelect = (pkg: EligiblePackage) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pkg.id)) {
        next.delete(pkg.id);
        setShippedMap((m) => {
          const nm = new Map(m);
          nm.delete(pkg.id);
          return nm;
        });
      } else {
        next.add(pkg.id);
        setShippedMap((m) => new Map(m).set(pkg.id, pkg.boxes_total));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShippedMap(new Map());
  };

  const openCreate = () => {
    if (selectedIds.size === 0) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("view", "create-od");
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  };

  const openCancel = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("view", "cancel-od");
    sp.set("od", id);
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  };

  const closeDrawer = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("view");
    sp.delete("od");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    router.refresh();
  };

  const changeHub = (hub: DispatchHub | "all") => {
    const sp = new URLSearchParams(params.toString());
    if (hub === "all") sp.delete("hub");
    else sp.set("hub", hub);
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  };

  const selectedPackages = queue.filter((p) => selectedIds.has(p.id));
  const odToCancel = activeOds.find((o) => o.id === odId);

  // Worst status entre los 2 channels (si uno está error, mostrar error)
  const worstStatus =
    odsRealtime.status === "error" || inboxRealtime.status === "error"
      ? "error"
      : odsRealtime.status === "connected" && inboxRealtime.status === "connected"
        ? "connected"
        : odsRealtime.status === "connecting" || inboxRealtime.status === "connecting"
          ? "connecting"
          : odsRealtime.status;

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <RealtimeIndicator status={worstStatus} />
      </div>
      <DispatchKpis kpis={kpis} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, marginTop: 24 }}>
        {/* Main column: queue */}
        <div>
          {/* Filters bar */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: 12,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              marginBottom: 14,
            }}
          >
            <label
              className="studio-label"
              style={{ marginRight: 4, font: "700 10.5px/1 var(--f-sans)" }}
            >
              Hub
            </label>
            <select
              className="studio-input"
              value={filters.hub ?? "all"}
              onChange={(e) => changeHub(e.target.value as DispatchHub | "all")}
              style={{ width: 180, height: 36 }}
            >
              <option value="all">Todos los hubs</option>
              {DISPATCH_HUB_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>

            <div style={{ flex: 1 }} />

            {selectedIds.size > 0 ? (
              <>
                <span style={{ font: "600 12px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {selectedIds.size} {selectedIds.size === 1 ? "paquete" : "paquetes"} seleccionados
                </span>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={clearSelection}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-primary studio-btn-sm"
                  onClick={openCreate}
                >
                  Crear OD
                </button>
              </>
            ) : (
              <span style={{ font: "500 12px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
                Selecciona paquetes para armar una OD
              </span>
            )}
          </div>

          {/* Queue table */}
          <DispatchQueueTable
            queue={queue}
            rules={rules}
            selectedIds={selectedIds}
            shippedMap={shippedMap}
            onToggle={toggleSelect}
            onChangeShipped={(id, n) =>
              setShippedMap((m) => new Map(m).set(id, Math.max(1, n)))
            }
          />
        </div>

        {/* Right column: active ODs */}
        <ActiveOdsPanel ods={activeOds} onCancel={openCancel} />
      </div>

      {/* Drawers */}
      {view === "create-od" && (
        <CreateOdDrawer
          selectedPackages={selectedPackages}
          shippedMap={shippedMap}
          routes={routes}
          availableTrucks={availableTrucks}
          availableDrivers={availableDrivers}
          onClose={closeDrawer}
          onSuccess={() => {
            clearSelection();
            closeDrawer();
          }}
        />
      )}

      {view === "cancel-od" && odToCancel && (
        <CancelOdDrawer od={odToCancel} onClose={closeDrawer} />
      )}
    </>
  );
}

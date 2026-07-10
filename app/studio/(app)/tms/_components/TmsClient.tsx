"use client";

/**
 * TmsClient — orquestador del módulo TMS (SDD-0019).
 *
 * 5 tabs URL-state (?tab=): overview / fleet / drivers / routes / incidents.
 * Drawers via ?view=: truck / driver / route / incident (último diferido).
 * Pre-seleccionable shipment via ?shipment=<id> (refactor VE).
 */

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { parseTmsTab, type TmsTab } from "@/lib/studio/tms-queries";
import type {
  TmsDriver,
  TmsIncidentRow,
  TmsRouteRow,
  TmsTruck,
  TmsTruckRow,
} from "@/lib/studio/tms-types";
import type {
  EligibleShipmentForRoute,
  IncidentsKpis,
} from "@/lib/studio/tms-queries";
import { GpsLiveTab } from "./GpsLiveTab";
import { FleetTab } from "./FleetTab";
import { DriversTab } from "./DriversTab";
import { RoutesTab } from "./RoutesTab";
import { IncidentsTab } from "./IncidentsTab";
import { TruckDrawer } from "./TruckDrawer";
import { DriverDrawer } from "./DriverDrawer";
import { RouteDrawer } from "./RouteDrawer";

interface Props {
  trucks: TmsTruckRow[];
  drivers: TmsDriver[];
  routes: TmsRouteRow[];
  activeRoutes: TmsRouteRow[];
  incidents: TmsIncidentRow[];
  incidentsKpis: IncidentsKpis;
  eligibleShipments: EligibleShipmentForRoute[];
  availableTrucks: TmsTruck[];
  availableDrivers: TmsDriver[];
  counts: {
    fleet: number;
    drivers: number;
    routes: number;
  };
}

export function TmsClient({
  trucks,
  drivers,
  routes,
  activeRoutes,
  incidents,
  incidentsKpis,
  eligibleShipments,
  availableTrucks,
  availableDrivers,
  counts,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const tab = parseTmsTab(params.get("tab"));
  const view = params.get("view");
  const preselectShipmentId = params.get("shipment") ?? undefined;

  const changeTab = (newTab: TmsTab) => {
    const sp = new URLSearchParams(params.toString());
    if (newTab === "overview") sp.delete("tab");
    else sp.set("tab", newTab);
    sp.delete("view");
    sp.delete("shipment");
    const qs = sp.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const closeDrawer = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("view");
    sp.delete("shipment");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    router.refresh();
  };

  const tabs: { value: TmsTab; label: string; count?: number }[] = [
    { value: "overview", label: "GPS Live" },
    { value: "fleet", label: "Flota", count: counts.fleet },
    { value: "drivers", label: "Choferes", count: counts.drivers },
    { value: "routes", label: "Rutas", count: counts.routes },
    { value: "incidents", label: "Incidencias & costos" },
  ];

  return (
    <>
      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => changeTab(t.value)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${active ? "var(--wine)" : "transparent"}`,
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: `${active ? "700" : "500"} 12.5px/1 var(--f-sans)`,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--s-2)",
                marginBottom: -1,
                transition:
                  "color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
              }}
            >
              {t.label}
              {t.count != null && (
                <span
                  style={{
                    font: "700 11px/1 var(--f-mono)",
                    color: active ? "var(--wine)" : "var(--ink-mute)",
                    padding: "2px 7px",
                    background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                    borderRadius: "var(--r-sm)",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <GpsLiveTab activeRoutes={activeRoutes} trucks={trucks} />
      )}
      {tab === "fleet" && <FleetTab rows={trucks} />}
      {tab === "drivers" && <DriversTab drivers={drivers} />}
      {tab === "routes" && <RoutesTab rows={routes} />}
      {tab === "incidents" && (
        <IncidentsTab rows={incidents} kpis={incidentsKpis} />
      )}

      {/* Drawers */}
      {view === "truck" && <TruckDrawer onClose={closeDrawer} />}
      {view === "driver" && <DriverDrawer onClose={closeDrawer} />}
      {view === "route" && (
        <RouteDrawer
          eligibleShipments={eligibleShipments}
          availableTrucks={availableTrucks}
          availableDrivers={availableDrivers}
          preselectShipmentId={preselectShipmentId}
          onClose={closeDrawer}
        />
      )}
      {/* incident drawer diferido — V1 sin form V2 lo agrega */}
    </>
  );
}

/**
 * /studio/tms — Transporte interno VE (SDD-0019).
 *
 * Cierra Sprint 3. 5 tabs (GPS Live / Flota / Choferes / Rutas / Incidencias).
 * Pre-seleccionable shipment via ?shipment=<id> (refactor del VE assign_delivery).
 */

import { createClient } from "@/lib/db/server";
import {
  computeIncidentsKpis,
  computeTmsKpis,
  listActiveRoutes,
  listAvailableDrivers,
  listAvailableTrucks,
  listDrivers,
  listEligibleShipmentsForRoute,
  listIncidents,
  listRoutes,
  listTrucks,
} from "@/lib/studio/tms-queries";
import { TmsClient } from "./_components/TmsClient";
import { TmsHeaderActions } from "./_components/TmsHeaderActions";
import { TmsKpis } from "./_components/TmsKpis";

export const metadata = { title: "TMS · Transporte" };

export default async function TmsPage() {
  const supabase = await createClient();

  const [
    trucks,
    drivers,
    routes,
    activeRoutes,
    incidents,
    incidentsKpis,
    eligibleShipments,
    availableTrucks,
    availableDrivers,
    kpis,
  ] = await Promise.all([
    listTrucks(supabase),
    listDrivers(supabase),
    listRoutes(supabase),
    listActiveRoutes(supabase),
    listIncidents(supabase, { recentDays: 30 }),
    computeIncidentsKpis(supabase),
    listEligibleShipmentsForRoute(supabase),
    listAvailableTrucks(supabase),
    listAvailableDrivers(supabase),
    computeTmsKpis(supabase),
  ]);

  const counts = {
    fleet: trucks.length,
    drivers: drivers.length,
    routes: routes.length,
  };

  return (
    <div style={{ maxWidth: 1480 }}>
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
          <span className="studio-eyebrow">Operación · Transporte</span>
          <h1
            className="studio-display"
            style={{
              fontSize: 30,
              margin: "8px 0 8px",
              color: "var(--ink)",
            }}
          >
            TMS · Transporte interno VE
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Gestión de la última milla. Flota, choferes, rutas optimizadas y
            estado en vivo para entregas DDP.{" "}
            <span style={{ color: "var(--ink-mute)" }}>
              Las rutas se crean desde shipments ya liberados de aduana —
              cambian status a &quot;En reparto&quot; al asignar.
            </span>
          </p>
        </div>
        <TmsHeaderActions />
      </div>

      <TmsKpis kpis={kpis} />

      <TmsClient
        trucks={trucks}
        drivers={drivers}
        routes={routes}
        activeRoutes={activeRoutes}
        incidents={incidents}
        incidentsKpis={incidentsKpis}
        eligibleShipments={eligibleShipments}
        availableTrucks={availableTrucks}
        availableDrivers={availableDrivers}
        counts={counts}
      />
    </div>
  );
}

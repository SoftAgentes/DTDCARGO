"use client";

/**
 * CreateOdDrawer — drawer para crear una OD (SDD-0029 Vista 1).
 *
 * Selección ruta + camión + chofer (cascade hub).
 * Capacity bar en vivo (kg + cbm).
 * Summary de packages seleccionados con motivo para P2 si hay parciales.
 * Submit con HTML5 form id + DrawerFooter.
 */

import { useActionState, useState } from "react";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { createDispatchOrderAction } from "../actions";
import {
  DISPATCH_HUB_OPTIONS,
  DISPATCH_SPLIT_REASON_LABELS,
  computeCapacity,
  type DispatchActionState,
  type DispatchHub,
  type DispatchSplitReason,
  type EligiblePackage,
} from "@/lib/studio/dispatch-types";
import type { DispatchRoute } from "@/lib/studio/dispatch-routes-types";
import type { TmsDriver, TmsTruck } from "@/lib/studio/tms-types";

const FORM_ID = "create-od-form";
const INITIAL_STATE: DispatchActionState = {};

interface Props {
  selectedPackages: EligiblePackage[];
  shippedMap: Map<string, number>;
  routes: DispatchRoute[];
  availableTrucks: TmsTruck[];
  availableDrivers: TmsDriver[];
  onClose: () => void;
  onSuccess: () => void;
}

const SPLIT_OPTIONS: { value: DispatchSplitReason; label: string }[] = (
  Object.keys(DISPATCH_SPLIT_REASON_LABELS) as DispatchSplitReason[]
).map((v) => ({ value: v, label: DISPATCH_SPLIT_REASON_LABELS[v] }));

export function CreateOdDrawer({
  selectedPackages,
  shippedMap,
  routes,
  availableTrucks,
  availableDrivers,
  onClose,
  onSuccess,
}: Props) {
  const [hub, setHub] = useState<DispatchHub>("valencia");
  const [routeId, setRouteId] = useState<string>("");
  const [truckId, setTruckId] = useState<string>("");
  const [driverId, setDriverId] = useState<string>("");
  const [splitReasons, setSplitReasons] = useState<Map<string, DispatchSplitReason>>(
    new Map(),
  );

  const [state, formAction, isPending] = useActionState(
    createDispatchOrderAction,
    INITIAL_STATE,
  );

  // Si ya terminó OK, cerrar
  if (state?.ok) {
    setTimeout(onSuccess, 100);
  }

  const truckFilteredByHub = availableTrucks.filter(
    (t) => !t.hub_code || matchHubCode(t.hub_code, hub),
  );
  const driverFilteredByHub = availableDrivers.filter(
    (d) => !d.hub_code || matchHubCode(d.hub_code, hub),
  );
  const routeFilteredByHub = routes.filter((r) => r.hub === hub);
  const selectedTruck = availableTrucks.find((t) => t.id === truckId);

  const packagesForCalc = selectedPackages.map((p) => ({
    weight_kg: p.weight_kg,
    cbm: p.cbm,
    boxes_total: p.boxes_total,
    boxes_shipped: shippedMap.get(p.id) ?? p.boxes_total,
  }));

  const capacity = selectedTruck
    ? {
        capacity_kg: Number(selectedTruck.capacity_kg ?? 0),
        capacity_cbm: Number(selectedTruck.capacity_cbm ?? 0),
      }
    : null;

  const usage = capacity ? computeCapacity(packagesForCalc, capacity) : null;

  // Detectar parciales que faltan motivo
  const partials = selectedPackages.filter(
    (p) => (shippedMap.get(p.id) ?? p.boxes_total) < p.boxes_total,
  );
  const partialsMissingReason = partials.filter((p) => !splitReasons.has(p.id));

  const canSubmit =
    routeId &&
    truckId &&
    driverId &&
    selectedPackages.length > 0 &&
    !usage?.overflow &&
    partialsMissingReason.length === 0;

  // Payload de packages para el server action
  const packagesPayload = selectedPackages.map((p) => ({
    package_kind: p.package_kind,
    package_id: p.id,
    boxes_shipped: shippedMap.get(p.id) ?? p.boxes_total,
    split_reason: splitReasons.get(p.id) ?? null,
    split_reason_text: null,
  }));

  return (
    <DrawerShell
      title="Crear orden de despacho"
      subtitle={`${selectedPackages.length} paquete${selectedPackages.length === 1 ? "" : "s"} seleccionados`}
      onClose={onClose}
      pending={isPending}
      width={720}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <input type="hidden" name="hub" value={hub} />
        <input type="hidden" name="route_id" value={routeId} />
        <input type="hidden" name="truck_id" value={truckId} />
        <input type="hidden" name="driver_id" value={driverId} />
        <input
          type="hidden"
          name="packages"
          value={JSON.stringify(packagesPayload)}
        />

        {/* Hub selector */}
        <div>
          <label className="studio-label" htmlFor="hub-select">
            Hub de salida
          </label>
          <select
            id="hub-select"
            className="studio-input"
            value={hub}
            onChange={(e) => {
              setHub(e.target.value as DispatchHub);
              setRouteId("");
              setTruckId("");
              setDriverId("");
            }}
            style={{ marginTop: 6 }}
          >
            {DISPATCH_HUB_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>

        {/* Route */}
        <div>
          <label className="studio-label" htmlFor="route-select">
            Ruta
          </label>
          <select
            id="route-select"
            className="studio-input"
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            style={{ marginTop: 6 }}
          >
            <option value="">— Elige ruta —</option>
            {routeFilteredByHub.map((r) => (
              <option key={r.id} value={r.id}>
                {r.route_code} · {r.name} ({r.origin_city} → {r.destination_city})
              </option>
            ))}
          </select>
          {routeFilteredByHub.length === 0 && (
            <p
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--warning)",
                marginTop: 6,
              }}
            >
              No hay rutas activas en {hub}. Crea una en{" "}
              <a href="/studio/admin/rutas" style={{ color: "var(--wine-text)" }}>
                Rutas y ciudades
              </a>
              .
            </p>
          )}
        </div>

        {/* Truck */}
        <div>
          <label className="studio-label" htmlFor="truck-select">
            Camión
          </label>
          <select
            id="truck-select"
            className="studio-input"
            value={truckId}
            onChange={(e) => setTruckId(e.target.value)}
            style={{ marginTop: 6 }}
          >
            <option value="">— Elige camión —</option>
            {truckFilteredByHub.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} · {t.brand ?? "—"} · cap {t.capacity_kg ?? "—"} kg / {t.capacity_cbm ?? "—"} cbm
              </option>
            ))}
          </select>
        </div>

        {/* Driver */}
        <div>
          <label className="studio-label" htmlFor="driver-select">
            Chofer
          </label>
          <select
            id="driver-select"
            className="studio-input"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            style={{ marginTop: 6 }}
          >
            <option value="">— Elige chofer —</option>
            {driverFilteredByHub.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.rating != null ? `· ★ ${d.rating}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Capacity bar */}
        {usage && capacity && (
          <div
            style={{
              padding: 14,
              background: "var(--bg-sidebar)",
              color: "var(--ink-side-strong)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 10,
              }}
            >
              <span
                className="studio-eyebrow"
                style={{ color: "var(--wine-soft)" }}
              >
                Ocupación del camión
              </span>
              <span
                style={{
                  font: "800 14px/1 var(--f-mono)",
                  color: usage.overflow ? "var(--danger)" : "var(--ink-side-strong)",
                }}
              >
                {usage.kg_pct.toFixed(0)}% kg · {usage.cbm_pct.toFixed(0)}% cbm
              </span>
            </div>
            <CapBar pct={usage.kg_pct} label="Peso" used={`${usage.kg_used.toFixed(0)} kg`} total={`${capacity.capacity_kg} kg`} />
            <div style={{ height: 8 }} />
            <CapBar pct={usage.cbm_pct} label="Volumen" used={`${usage.cbm_used.toFixed(1)} cbm`} total={`${capacity.capacity_cbm} cbm`} />
            {usage.overflow && (
              <div
                style={{
                  marginTop: 10,
                  font: "700 12px/1.3 var(--f-sans)",
                  color: "var(--danger)",
                }}
              >
                Excede capacidad. Quita paquetes o carga menos cajas (parcial P2).
              </div>
            )}
          </div>
        )}

        {/* Partials warning + reason picker */}
        {partials.length > 0 && (
          <div
            style={{
              padding: 14,
              background: "var(--warning-bg)",
              border: "1px solid var(--warning)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              style={{
                font: "700 12px/1.2 var(--f-sans)",
                color: "var(--warning)",
                marginBottom: 6,
                letterSpacing: "0.02em",
              }}
            >
              Hay {partials.length} {partials.length === 1 ? "paquete" : "paquetes"} con carga fraccionada
            </div>
            <p
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink)",
                margin: "0 0 12px",
              }}
            >
              Cada paquete parcial requiere un motivo. La porción que queda en bodega
              se genera como OD nueva en estado <code>creada</code>.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {partials.map((p) => {
                const shipped = shippedMap.get(p.id) ?? p.boxes_total;
                const reason = splitReasons.get(p.id);
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <code style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--wine-text)" }}>
                        {p.markbox}
                      </code>
                      <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink)", marginLeft: 8 }}>
                        {p.client_name}: {shipped}/{p.boxes_total} cajas
                      </span>
                    </div>
                    <select
                      value={reason ?? ""}
                      onChange={(e) => {
                        const v = e.target.value as DispatchSplitReason;
                        setSplitReasons((m) => {
                          const next = new Map(m);
                          if (v) next.set(p.id, v);
                          else next.delete(p.id);
                          return next;
                        });
                      }}
                      className="studio-input"
                      style={{ width: 240, height: 32 }}
                    >
                      <option value="">— Motivo —</option>
                      {SPLIT_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Server feedback */}
        {state?.error && (
          <div
            style={{
              padding: 12,
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-md)",
              font: "600 13px/1.3 var(--f-sans)",
            }}
          >
            {state.error}
          </div>
        )}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit={!!canSubmit}
        submitLabel="Crear OD"
      />
    </DrawerShell>
  );
}

function CapBar({
  pct,
  label,
  used,
  total,
}: {
  pct: number;
  label: string;
  used: string;
  total: string;
}) {
  const display = Math.min(100, pct);
  const color = pct > 100 ? "var(--danger)" : pct > 90 ? "var(--warning)" : "var(--wine-soft)";
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          font: "600 10.5px/1 var(--f-mono)",
          color: "var(--ink-side)",
        }}
      >
        <span>{label}</span>
        <span>
          {used} / {total}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--ink-side-soft)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${display}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

/** Compara hub_code del truck/driver (PBL/LGU/MAR/PFI) con DispatchHub. */
function matchHubCode(hubCode: string, hub: DispatchHub): boolean {
  const map: Record<DispatchHub, string[]> = {
    valencia: ["VAL", "PBL"], // Pto Cabello operacionalmente es Valencia
    la_guaira: ["LGU"],
    punto_fijo: ["PFI"],
    maracaibo: ["MAR"],
  };
  return map[hub]?.includes(hubCode.toUpperCase()) ?? false;
}

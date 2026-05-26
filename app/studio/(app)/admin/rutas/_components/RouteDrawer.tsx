"use client";

/**
 * RouteDrawer — crear/editar ruta (SDD-0029).
 * Selección hub + origen + destino + ciudades intermedias (lista dinámica).
 */

import { useActionState, useState } from "react";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { createRouteAction, softDeleteRouteAction, updateRouteAction } from "../actions";
import {
  DISPATCH_HUB_OPTIONS,
  type DispatchHub,
} from "@/lib/studio/dispatch-types";
import type {
  DispatchCity,
  DispatchRoute,
  DispatchRouteType,
  IntermediateCity,
  RoutesActionState,
} from "@/lib/studio/dispatch-routes-types";

const FORM_ID = "route-drawer-form";
const INITIAL_STATE: RoutesActionState = {};

export function RouteDrawer({
  mode,
  route,
  cities,
  onClose,
}: {
  mode: "create" | "edit";
  route: DispatchRoute | null;
  cities: DispatchCity[];
  onClose: () => void;
}) {
  const [name, setName] = useState(route?.name ?? "");
  const [routeType, setRouteType] = useState<DispatchRouteType>(route?.route_type ?? "directa");
  const [hub, setHub] = useState<DispatchHub>(route?.hub ?? "valencia");
  const [originCity, setOriginCity] = useState(route?.origin_city ?? "");
  const [destinationCity, setDestinationCity] = useState(route?.destination_city ?? "");
  const [intermediates, setIntermediates] = useState<IntermediateCity[]>(
    route?.intermediate_cities ?? [],
  );
  const [slaHours, setSlaHours] = useState<number>(route?.sla_hours ?? 24);
  const [active, setActive] = useState(route?.active ?? true);
  const [notes, setNotes] = useState(route?.notes ?? "");

  const action = mode === "create" ? createRouteAction : updateRouteAction;
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [deleteState, deleteAction, deletePending] = useActionState(
    softDeleteRouteAction,
    INITIAL_STATE,
  );

  if (state?.ok || deleteState?.ok) {
    setTimeout(onClose, 100);
  }

  const addIntermediate = () => {
    setIntermediates([
      ...intermediates,
      { city: "", radius_km: 5, order: intermediates.length + 1 },
    ]);
  };

  const updateIntermediate = (idx: number, patch: Partial<IntermediateCity>) => {
    setIntermediates(intermediates.map((ic, i) => (i === idx ? { ...ic, ...patch } : ic)));
  };

  const removeIntermediate = (idx: number) => {
    setIntermediates(intermediates.filter((_, i) => i !== idx));
  };

  const canSubmit = name.trim() && originCity.trim() && destinationCity.trim() && slaHours > 0;

  const allCityNames = cities.map((c) => c.city);
  const cityListId = "rt-city-suggest";

  return (
    <DrawerShell
      title={mode === "create" ? "Nueva ruta" : `Editar ${route?.route_code ?? ""}`}
      subtitle={mode === "create" ? "Definí origen, destino y SLA" : route?.name ?? undefined}
      onClose={onClose}
      pending={isPending || deletePending}
      width={680}
    >
      <datalist id={cityListId}>
        {allCityNames.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <form
        id={FORM_ID}
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {mode === "edit" && <input type="hidden" name="id" value={route!.id} />}
        <input type="hidden" name="route_type" value={routeType} />
        <input type="hidden" name="hub" value={hub} />
        <input type="hidden" name="active" value={active ? "true" : "false"} />
        <input
          type="hidden"
          name="intermediate_cities"
          value={JSON.stringify(intermediates.filter((ic) => ic.city.trim()))}
        />

        <div>
          <label className="studio-label" htmlFor="rt-name">
            Nombre
          </label>
          <input
            id="rt-name"
            name="name"
            className="studio-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Valencia → Caracas express"
            style={{ marginTop: 6 }}
          />
          {state?.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="rt-hub">
              Hub
            </label>
            <select
              id="rt-hub"
              className="studio-input"
              value={hub}
              onChange={(e) => setHub(e.target.value as DispatchHub)}
              style={{ marginTop: 6 }}
            >
              {DISPATCH_HUB_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="rt-type">
              Tipo
            </label>
            <select
              id="rt-type"
              className="studio-input"
              value={routeType}
              onChange={(e) => setRouteType(e.target.value as DispatchRouteType)}
              style={{ marginTop: 6 }}
            >
              <option value="directa">Directa (origen → destino)</option>
              <option value="intermedias">Intermedias (con paradas)</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="rt-origin">
              Ciudad origen
            </label>
            <input
              id="rt-origin"
              name="origin_city"
              className="studio-input"
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
              list={cityListId}
              placeholder="Valencia"
              style={{ marginTop: 6 }}
            />
            {state?.fieldErrors?.origin_city && <FieldError msg={state.fieldErrors.origin_city} />}
          </div>
          <div>
            <label className="studio-label" htmlFor="rt-destination">
              Ciudad destino
            </label>
            <input
              id="rt-destination"
              name="destination_city"
              className="studio-input"
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
              list={cityListId}
              placeholder="Caracas"
              style={{ marginTop: 6 }}
            />
            {state?.fieldErrors?.destination_city && <FieldError msg={state.fieldErrors.destination_city} />}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="rt-sla">
              SLA en horas
            </label>
            <input
              id="rt-sla"
              name="sla_hours"
              type="number"
              className="studio-input"
              value={slaHours}
              onChange={(e) => setSlaHours(Number(e.target.value))}
              min={1}
              max={720}
              style={{ marginTop: 6 }}
            />
            {state?.fieldErrors?.sla_hours && <FieldError msg={state.fieldErrors.sla_hours} />}
          </div>
          <div>
            <label className="studio-label" htmlFor="rt-active">
              Estado
            </label>
            <label
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
                height: 38,
              }}
            >
              <input
                id="rt-active"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                style={{ accentColor: "var(--wine)" }}
              />
              <span style={{ font: "600 12.5px/1 var(--f-sans)", color: "var(--ink)" }}>
                {active ? "Activa" : "Inactiva"}
              </span>
            </label>
          </div>
        </div>

        {/* Intermediate cities (solo si route_type = intermedias) */}
        {routeType === "intermedias" && (
          <div
            style={{
              padding: 14,
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="studio-eyebrow" style={{ color: "var(--wine)" }}>
                Ciudades intermedias · {intermediates.length}
              </div>
              <button type="button" onClick={addIntermediate} className="studio-btn studio-btn-ghost studio-btn-xs">
                + Agregar
              </button>
            </div>
            {intermediates.length === 0 ? (
              <p style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: 0 }}>
                Sin paradas. Agregá al menos una para una ruta con intermedias.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {intermediates.map((ic, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ font: "800 13px/1 var(--f-mono)", color: "var(--ink-mute)", width: 20 }}>
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      list={cityListId}
                      className="studio-input"
                      value={ic.city}
                      onChange={(e) => updateIntermediate(idx, { city: e.target.value })}
                      placeholder="Ciudad"
                      style={{ flex: 1, height: 34 }}
                    />
                    <input
                      type="number"
                      className="studio-input"
                      value={ic.radius_km}
                      onChange={(e) =>
                        updateIntermediate(idx, { radius_km: Number(e.target.value) })
                      }
                      placeholder="Radio km"
                      min={1}
                      max={100}
                      style={{ width: 90, height: 34 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeIntermediate(idx)}
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      style={{ color: "var(--danger)" }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="studio-label" htmlFor="rt-notes">
            Notas (opcional)
          </label>
          <textarea
            id="rt-notes"
            name="notes"
            className="studio-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Mejores horarios, peajes, contactos…"
            style={{ marginTop: 6, resize: "vertical" }}
          />
        </div>

        {state?.error && <ErrorBanner msg={state.error} />}
        {deleteState?.error && <ErrorBanner msg={deleteState.error} />}
      </form>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        {mode === "edit" && route ? (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={route.id} />
            <button
              type="submit"
              className="studio-btn studio-btn-ghost"
              disabled={isPending || deletePending}
              style={{ color: "var(--danger)" }}
              onClick={(e) => {
                if (!confirm("¿Desactivar esta ruta? Queda como soft-deleted y deja de aparecer en la lista.")) {
                  e.preventDefault();
                }
              }}
            >
              Desactivar
            </button>
          </form>
        ) : (
          <div />
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
            disabled={isPending || deletePending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="studio-btn studio-btn-primary"
            disabled={isPending || deletePending || !canSubmit}
          >
            {isPending ? "Guardando…" : mode === "create" ? "Crear ruta" : "Guardar cambios"}
          </button>
        </div>
      </footer>
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "600 11.5px/1.3 var(--f-sans)",
        color: "var(--danger)",
        marginTop: 6,
      }}
    >
      {msg}
    </p>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: 12,
        background: "var(--danger-bg)",
        color: "var(--danger)",
        borderRadius: "var(--r-md)",
        font: "600 13px/1.3 var(--f-sans)",
      }}
    >
      {msg}
    </div>
  );
}

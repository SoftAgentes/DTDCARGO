"use client";

/**
 * CityDrawer — crear/editar ciudad del catálogo tenant (SDD-0029).
 *
 * Cascade Estado → Municipio → Ciudad → CP usando ve_locality_catalog
 * como autocomplete + auto-fill. Permite agregar ciudades custom no en el catálogo.
 */

import { useActionState, useState, useMemo } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  createCityAction,
  softDeleteCityAction,
  updateCityAction,
} from "../actions";
import type { DispatchCity, RoutesActionState } from "@/lib/studio/dispatch-routes-types";
import type { VeLocalityEntry } from "@/lib/studio/ve-catalog-types";

const FORM_ID = "city-drawer-form";
const INITIAL_STATE: RoutesActionState = {};

export function CityDrawer({
  mode,
  city,
  veCatalog,
  onClose,
}: {
  mode: "create" | "edit";
  city: DispatchCity | null;
  veCatalog: VeLocalityEntry[];
  onClose: () => void;
}) {
  const [stateCode, setStateCode] = useState(city?.state_code ?? "");
  const [stateName, setStateName] = useState(city?.state_name ?? "");
  const [municipio, setMunicipio] = useState(city?.municipio ?? "");
  const [cityName, setCityName] = useState(city?.city ?? "");
  const [postalCode, setPostalCode] = useState(city?.postal_code ?? "");
  const [defaultRadiusKm, setDefaultRadiusKm] = useState<number>(city?.default_radius_km ?? 5);
  const [isHq, setIsHq] = useState(city?.is_hq ?? false);
  const [active, setActive] = useState(city?.active ?? true);

  const action = mode === "create" ? createCityAction : updateCityAction;
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [deleteState, deleteAction, deletePending] = useActionState(
    softDeleteCityAction,
    INITIAL_STATE,
  );

  if (state?.ok || deleteState?.ok) {
    setTimeout(onClose, 100);
  }

  const stateOptions = useMemo(() => {
    const seen = new Map<string, { code: string; name: string }>();
    for (const e of veCatalog) {
      if (!seen.has(e.state_code)) {
        seen.set(e.state_code, { code: e.state_code, name: e.state_name });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [veCatalog]);

  const municipiosForState = useMemo(() => {
    if (!stateCode) return [];
    const set = new Set<string>();
    for (const e of veCatalog) {
      if (e.state_code === stateCode) set.add(e.municipio);
    }
    return Array.from(set).sort();
  }, [veCatalog, stateCode]);

  const citiesForMunicipio = useMemo(() => {
    if (!stateCode || !municipio) return [];
    return veCatalog
      .filter((e) => e.state_code === stateCode && e.municipio === municipio)
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [veCatalog, stateCode, municipio]);

  const handleStateChange = (code: string) => {
    setStateCode(code);
    const found = stateOptions.find((s) => s.code === code);
    setStateName(found?.name ?? "");
    setMunicipio("");
    setCityName("");
    setPostalCode("");
  };

  const handleCitySelect = (entry: VeLocalityEntry) => {
    setCityName(entry.city);
    setPostalCode(entry.postal_code);
  };

  const canSubmit =
    stateCode.trim() && stateName.trim() && municipio.trim() && cityName.trim() && defaultRadiusKm > 0;

  return (
    <DrawerShell
      title={mode === "create" ? "Nueva ciudad" : `Editar ${city?.city ?? ""}`}
      subtitle={mode === "create" ? "Cascade desde catálogo VE o ciudad custom" : `${city?.state_name} · ${city?.municipio}`}
      onClose={onClose}
      pending={isPending || deletePending}
      width={600}
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
          gap: 14,
        }}
      >
        {mode === "edit" && <input type="hidden" name="id" value={city!.id} />}
        <input type="hidden" name="state_code" value={stateCode} />
        <input type="hidden" name="state_name" value={stateName} />
        <input type="hidden" name="is_hq" value={isHq ? "true" : "false"} />
        <input type="hidden" name="active" value={active ? "true" : "false"} />

        {/* Estado */}
        <div>
          <label className="studio-label" htmlFor="ct-state">
            Estado
          </label>
          <select
            id="ct-state"
            value={stateCode}
            onChange={(e) => handleStateChange(e.target.value)}
            className="studio-input"
            style={{ marginTop: 6 }}
            disabled={mode === "edit"}
          >
            <option value="">— Elige estado —</option>
            {stateOptions.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          {mode === "edit" && (
            <p style={{ font: "500 10.5px/1.4 var(--f-sans)", color: "var(--ink-mute)", marginTop: 6 }}>
              El estado no se puede cambiar después de crear. Si necesitas mover una ciudad,
              crea una nueva y desactiva la vieja.
            </p>
          )}
        </div>

        {/* Municipio */}
        <div>
          <label className="studio-label" htmlFor="ct-municipio">
            Municipio
          </label>
          <input
            id="ct-municipio"
            name="municipio"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="studio-input"
            list="ct-municipio-list"
            placeholder={stateCode ? "Escribe o elige del catálogo" : "Elige estado primero"}
            disabled={!stateCode}
            style={{ marginTop: 6 }}
          />
          <datalist id="ct-municipio-list">
            {municipiosForState.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        {/* Ciudad */}
        <div>
          <label className="studio-label" htmlFor="ct-city">
            Ciudad
          </label>
          <input
            id="ct-city"
            name="city"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            className="studio-input"
            list="ct-city-list"
            placeholder={municipio ? "Escribe o elige del catálogo" : "Elige municipio primero"}
            disabled={!stateCode}
            style={{ marginTop: 6 }}
          />
          <datalist id="ct-city-list">
            {citiesForMunicipio.map((entry) => (
              <option
                key={entry.city}
                value={entry.city}
                onClick={() => handleCitySelect(entry)}
              />
            ))}
          </datalist>

          {/* Suggestions from catalog */}
          {citiesForMunicipio.length > 0 && !cityName && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {citiesForMunicipio.map((entry) => (
                <button
                  key={entry.city}
                  type="button"
                  onClick={() => handleCitySelect(entry)}
                  style={{
                    padding: "5px 10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-pill)",
                    font: "600 11px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    cursor: "pointer",
                  }}
                >
                  {entry.city} · {entry.postal_code}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="ct-cp">
              Código postal
            </label>
            <input
              id="ct-cp"
              name="postal_code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="studio-input studio-input-mono"
              placeholder="2001"
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="ct-radius">
              Radio km
            </label>
            <input
              id="ct-radius"
              name="default_radius_km"
              type="number"
              value={defaultRadiusKm}
              onChange={(e) => setDefaultRadiusKm(Number(e.target.value))}
              className="studio-input"
              min={1}
              max={100}
              style={{ marginTop: 6 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <label style={toggleStyle}>
            <input
              type="checkbox"
              checked={isHq}
              onChange={(e) => setIsHq(e.target.checked)}
              style={{ accentColor: "var(--wine)" }}
            />
            <span>HQ del tenant</span>
          </label>
          <label style={toggleStyle}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ accentColor: "var(--wine)" }}
            />
            <span>Activa</span>
          </label>
        </div>

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
        {mode === "edit" && city ? (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={city.id} />
            <button
              type="submit"
              className="studio-btn studio-btn-ghost"
              disabled={isPending || deletePending}
              style={{ color: "var(--danger)" }}
              onClick={(e) => {
                if (!confirm("¿Desactivar esta ciudad? Sigue en DB pero deja de aparecer en filtros.")) {
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
            {isPending ? "Guardando…" : mode === "create" ? "Crear ciudad" : "Guardar"}
          </button>
        </div>
      </footer>
    </DrawerShell>
  );
}

const toggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-md)",
  cursor: "pointer",
  font: "600 12.5px/1 var(--f-sans)",
  color: "var(--ink)",
};

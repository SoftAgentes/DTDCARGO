"use client";

/**
 * CityPicker — dropdown buscable con opción "+ Agregar nueva ciudad" inline.
 *
 * Alineado a Claude Design v1.7 (admin-routes.jsx líneas 793-1029).
 *
 * Reemplaza el datalist HTML5 nativo que tenía RouteDrawer original. Permite:
 *  - Búsqueda incremental por nombre o estado
 *  - Selección por click
 *  - "+ Agregar nueva ciudad al catálogo" → modo inline con mini-form que
 *    invoca createCityAction · si OK selecciona y cierra
 *
 * Requiere veCatalog para lookup automático de state_code desde state_name
 * (el usuario no debería escribir el code 'CAR' etc, lo inferimos del nombre).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Icon } from "@/app/studio/_components/icons";
import { createCityAction } from "../actions";
import type { DispatchCity } from "@/lib/studio/dispatch-routes-types";
import type { VeLocalityEntry } from "@/lib/studio/ve-catalog-types";

interface CityPickerProps {
  label: string;
  value: string;
  onChange: (city: string) => void;
  cities: DispatchCity[];
  veCatalog: VeLocalityEntry[];
  placeholder?: string;
  /** Mostrar el radio default en la lista (para intermedias). */
  showDefaultRadius?: boolean;
  disabled?: boolean;
}

type Mode = "list" | "add";

export function CityPicker({
  label,
  value,
  onChange,
  cities,
  veCatalog,
  placeholder = "— Elegir —",
  showDefaultRadius = false,
  disabled = false,
}: CityPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [q, setQ] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    city: "",
    state_name: "",
    municipio: "",
    postal_code: "",
    default_radius_km: 20,
  });
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setMode("list");
    setQ("");
    setAddError(null);
    setDraft({
      city: "",
      state_name: "",
      municipio: "",
      postal_code: "",
      default_radius_km: 20,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const pick = (city: string) => {
    onChange(city);
    close();
  };

  const filtered = useMemo(() => {
    if (!q) return cities;
    const target = q.toLowerCase();
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(target) ||
        c.state_name.toLowerCase().includes(target),
    );
  }, [cities, q]);

  // Lookup state_code desde state_name via catálogo VE
  const inferStateCode = (stateName: string): string | null => {
    const target = stateName.trim().toLowerCase();
    if (!target) return null;
    const match = veCatalog.find(
      (e) => e.state_name.toLowerCase() === target,
    );
    return match?.state_code ?? null;
  };

  const handleAdd = () => {
    setAddError(null);
    const name = draft.city.trim();
    const stateName = draft.state_name.trim();
    const municipio = draft.municipio.trim();
    if (!name) {
      setAddError("Ingresá el nombre de la ciudad.");
      return;
    }
    if (!stateName) {
      setAddError("Ingresá el estado.");
      return;
    }
    if (!municipio) {
      setAddError("Ingresá el municipio.");
      return;
    }
    const stateCode = inferStateCode(stateName);
    if (!stateCode) {
      setAddError(
        `No reconozco "${stateName}" como estado venezolano. Revisá la ortografía o usá el botón "Agregar ciudad" del tab principal para casos custom.`,
      );
      return;
    }

    const fd = new FormData();
    fd.set("state_code", stateCode);
    fd.set("state_name", stateName);
    fd.set("municipio", municipio);
    fd.set("city", name);
    fd.set("postal_code", draft.postal_code.trim());
    fd.set("default_radius_km", String(draft.default_radius_km));
    fd.set("is_hq", "false");
    fd.set("active", "true");

    startTransition(async () => {
      const result = await createCityAction({}, fd);
      if (result.error) {
        setAddError(result.error);
        return;
      }
      if (result.fieldErrors) {
        const firstErr = Object.values(result.fieldErrors)[0];
        setAddError(firstErr ?? "Datos inválidos.");
        return;
      }
      // OK · seleccionar y cerrar (router.refresh del drawer cargará la lista nueva)
      pick(name);
    });
  };

  const selectedLabel = (() => {
    if (!value) return placeholder;
    const c = cities.find((x) => x.city === value);
    return c ? `${c.city}${c.state_name ? `, ${c.state_name}` : ""}` : value;
  })();

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {label && <label className="studio-label">{label}</label>}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        style={{
          height: 38,
          padding: "0 12px",
          background: "var(--bg-surface)",
          border: `1px solid ${open ? "var(--wine)" : "var(--border)"}`,
          borderRadius: "var(--r-md)",
          font: "500 13.5px/1 var(--f-sans)",
          color: value ? "var(--ink)" : "var(--ink-mute)",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          boxShadow: open ? "0 0 0 3px var(--wine-tint)" : "none",
          transition: "all 160ms ease",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLabel}
        </span>
        <span
          style={{
            color: "var(--ink-mute)",
            transform: `rotate(${open ? 180 : 0}deg)`,
            transition: "transform 160ms ease",
            display: "inline-flex",
          }}
        >
          {Icon.chevD(14)}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 200,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-pop, 0 12px 28px rgba(0,0,0,0.18))",
            overflow: "hidden",
            maxHeight: 380,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {mode === "list" ? (
            <>
              {/* Search */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                }}
              >
                <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
                  {Icon.search(13)}
                </span>
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar ciudad…"
                  style={{
                    flex: 1,
                    height: 24,
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    font: "500 13px/1 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              {/* List */}
              <div style={{ flex: 1, overflowY: "auto", minHeight: 60 }}>
                {filtered.length === 0 && (
                  <div
                    style={{
                      padding: "14px",
                      font: "500 12px/1.4 var(--f-sans)",
                      color: "var(--ink-mute)",
                      textAlign: "center",
                    }}
                  >
                    Ninguna ciudad coincide con &ldquo;{q}&rdquo;. Agregala con el
                    botón de abajo.
                  </div>
                )}
                {filtered.map((c) => {
                  const sel = c.city === value;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick(c.city)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        textAlign: "left",
                        background: sel ? "var(--wine-tint)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        font: `${sel ? "700" : "500"} 13px/1.2 var(--f-sans)`,
                        color: sel ? "var(--wine)" : "var(--ink)",
                        borderBottom: "1px solid var(--border)",
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.city}
                        </div>
                        {c.state_name && (
                          <div
                            style={{
                              font: "500 10.5px/1 var(--f-sans)",
                              color: "var(--ink-mute)",
                              marginTop: 3,
                            }}
                          >
                            {c.state_name}
                          </div>
                        )}
                      </div>
                      {showDefaultRadius && (
                        <code
                          style={{
                            font: "700 11px/1 var(--f-mono)",
                            color: "var(--ink-soft)",
                            flexShrink: 0,
                          }}
                        >
                          {c.default_radius_km}km
                        </code>
                      )}
                      {sel && (
                        <span style={{ color: "var(--wine)", display: "inline-flex" }}>
                          {Icon.check(13)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Add new */}
              <button
                type="button"
                onClick={() => {
                  setMode("add");
                  setDraft((d) => ({ ...d, city: q }));
                }}
                style={{
                  padding: "11px 12px",
                  background: "var(--bg-elevated)",
                  color: "var(--wine)",
                  borderTop: "1px solid var(--border)",
                  border: 0,
                  borderTopWidth: 1,
                  borderTopStyle: "solid",
                  borderTopColor: "var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  font: "700 12.5px/1 var(--f-sans)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {Icon.plus(13)} Agregar nueva ciudad al catálogo
              </button>
            </>
          ) : (
            <div
              style={{
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    font: "800 13px/1.1 var(--f-display)",
                    color: "var(--ink)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Nueva ciudad al catálogo
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setAddError(null);
                  }}
                  style={{
                    color: "var(--ink-soft)",
                    font: "600 12px/1 var(--f-sans)",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  ← Volver
                </button>
              </div>

              <MiniField
                label="Ciudad"
                value={draft.city}
                onChange={(v) => setDraft({ ...draft, city: v })}
                placeholder="ej: Acarigua"
                autoFocus
              />
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
              >
                <MiniField
                  label="Estado"
                  value={draft.state_name}
                  onChange={(v) => setDraft({ ...draft, state_name: v })}
                  placeholder="ej: Portuguesa"
                  list="cp-state-list"
                />
                <MiniField
                  label="Código postal"
                  value={draft.postal_code}
                  onChange={(v) => setDraft({ ...draft, postal_code: v })}
                  placeholder="4 dígitos"
                  mono
                />
              </div>
              <datalist id="cp-state-list">
                {Array.from(
                  new Set(veCatalog.map((e) => e.state_name)),
                ).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <MiniField
                label="Municipio"
                value={draft.municipio}
                onChange={(v) => setDraft({ ...draft, municipio: v })}
                placeholder="ej: Araure"
              />
              <MiniField
                label="Radio default (km)"
                value={String(draft.default_radius_km)}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    default_radius_km: Math.max(
                      1,
                      Math.min(200, parseInt(v || "20", 10) || 20),
                    ),
                  })
                }
                placeholder="20"
                type="number"
                mono
                hint="Se precarga cuando uses esta ciudad como parada. Editable después en cada ruta."
              />

              {addError && (
                <div
                  style={{
                    padding: 8,
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                    borderRadius: "var(--r-sm)",
                    font: "600 11.5px/1.3 var(--f-sans)",
                  }}
                >
                  {addError}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 4,
                }}
              >
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => {
                    setMode("list");
                    setAddError(null);
                  }}
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-primary studio-btn-sm"
                  onClick={handleAdd}
                  disabled={isPending}
                >
                  {isPending ? "Agregando…" : "Agregar y seleccionar"}
                </button>
              </div>

              <div
                style={{
                  marginTop: 4,
                  padding: "8px 10px",
                  background: "var(--info-bg)",
                  color: "var(--info)",
                  borderRadius: "var(--r-sm)",
                  font: "500 10.5px/1.4 var(--f-sans)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                }}
              >
                <span style={{ marginTop: 1, flexShrink: 0, display: "inline-flex" }}>
                  {Icon.info(11)}
                </span>
                <span>
                  Quedará agregada al{" "}
                  <b>Catálogo per-tenant</b>. Podrás editar el estado HQ y
                  desactivarla desde la pestaña Configurable por ciudad.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  list,
  type,
  mono,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  list?: string;
  type?: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          font: "600 11px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        list={list}
        className={mono ? "studio-input studio-input-mono" : "studio-input"}
        style={{ width: "100%", height: 34 }}
      />
      {hint && (
        <p
          style={{
            font: "500 10.5px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
            margin: "4px 0 0",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

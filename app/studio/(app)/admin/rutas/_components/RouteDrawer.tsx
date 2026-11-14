"use client";

/**
 * RouteDrawer — crear/editar ruta (SDD-0029).
 *
 * Alineado a Claude Design v1.7 (admin-routes.jsx líneas 365-585):
 *   - Eyebrow sections agrupando bloques
 *   - Tipo como segmented cards grandes con icon + descripción
 *   - CityPicker custom (origen + destino + intermedias)
 *   - Lista numerada de intermedias con avatar circle + override flag
 *   - DrawerSwitch pill custom para active
 *   - Info banner multi-hub
 *   - Auto-generate del nombre si está vacío
 */

import { useActionState, useMemo, useState, useTransition } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { Icon } from "@/app/studio/_components/icons";
import {
  createRouteAction,
  softDeleteRouteAction,
  updateRouteAction,
} from "../actions";
import {
  DISPATCH_HUB_LABELS,
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
import type { VeLocalityEntry } from "@/lib/studio/ve-catalog-types";
import { CityPicker } from "./CityPicker";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const FORM_ID = "route-drawer-form";
const INITIAL_STATE: RoutesActionState = {};

interface Props {
  mode: "create" | "edit";
  route: DispatchRoute | null;
  cities: DispatchCity[];
  veCatalog: VeLocalityEntry[];
  onClose: () => void;
}

export function RouteDrawer({ mode, route, cities, veCatalog, onClose }: Props) {
  const [name, setName] = useState(route?.name ?? "");
  const [routeType, setRouteType] = useState<DispatchRouteType>(
    route?.route_type ?? "directa",
  );
  const [hub, setHub] = useState<DispatchHub>(route?.hub ?? "valencia");
  const [originCity, setOriginCity] = useState(route?.origin_city ?? "");
  const [destinationCity, setDestinationCity] = useState(
    route?.destination_city ?? "",
  );
  const [intermediates, setIntermediates] = useState<IntermediateCity[]>(
    route?.intermediate_cities ?? [],
  );
  const [slaHours, setSlaHours] = useState<number>(route?.sla_hours ?? 24);
  const [active, setActive] = useState(route?.active ?? true);
  const [notes, setNotes] = useState(route?.notes ?? "");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [, startDeleteTransition] = useTransition();

  const action = mode === "create" ? createRouteAction : updateRouteAction;
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [deleteState, deleteAction, deletePending] = useActionState(
    softDeleteRouteAction,
    INITIAL_STATE,
  );

  if (state?.ok || deleteState?.ok) {
    setTimeout(onClose, 100);
  }

  // Auto-generate del nombre cuando está vacío + tenemos destino
  const autoName = useMemo(() => {
    if (!destinationCity) return "";
    const origin = originCity || DISPATCH_HUB_LABELS[hub];
    const base = `${origin} → ${destinationCity}`;
    if (routeType === "intermedias" && intermediates.length > 0) {
      const n = intermediates.length;
      return `${base} + ${n} ciudad${n === 1 ? "" : "es"}`;
    }
    return base;
  }, [originCity, destinationCity, hub, routeType, intermediates.length]);

  const submittedName = name.trim() || autoName;

  // Switch route type: si vuelvo a directa, limpio intermedias
  const setType = (next: DispatchRouteType) => {
    setRouteType(next);
    if (next === "directa") setIntermediates([]);
  };

  // Intermediate handlers
  const addIntermediate = (city: string) => {
    if (!city) return;
    const inCatalog = cities.find((c) => c.city === city);
    setIntermediates([
      ...intermediates,
      {
        city,
        radius_km: inCatalog?.default_radius_km ?? 20,
        order: intermediates.length + 1,
      },
    ]);
  };

  const updateIntermediateRadius = (idx: number, value: number) => {
    setIntermediates(
      intermediates.map((ic, i) =>
        i === idx ? { ...ic, radius_km: value } : ic,
      ),
    );
  };

  const removeIntermediate = (idx: number) => {
    setIntermediates(intermediates.filter((_, i) => i !== idx));
  };

  // CityPicker pools
  const activeCities = useMemo(() => cities.filter((c) => c.active), [cities]);

  const intermediateCandidates = useMemo(() => {
    const used = new Set([
      ...intermediates.map((ic) => ic.city),
      destinationCity,
      originCity,
    ]);
    return activeCities.filter((c) => !used.has(c.city));
  }, [activeCities, intermediates, destinationCity, originCity]);

  const canSubmit =
    submittedName.length > 0 &&
    originCity.trim() &&
    destinationCity.trim() &&
    slaHours > 0 &&
    (routeType === "directa" || intermediates.length > 0);

  return (
    <DrawerShell
      title={mode === "create" ? "Nueva ruta" : `Editar ${route?.route_code ?? ""}`}
      subtitle={
        mode === "create"
          ? "Las ciudades intermedias heredan el radio default del catálogo. Puedes overridearlo solo para esta ruta."
          : route?.name ?? undefined
      }
      onClose={onClose}
      pending={isPending || deletePending}
      width={680}
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
          gap: 20,
        }}
      >
        {mode === "edit" && route && (
          <input type="hidden" name="id" value={route.id} />
        )}
        {/* Hidden fields driven by client state */}
        <input type="hidden" name="name" value={submittedName} />
        <input type="hidden" name="route_type" value={routeType} />
        <input type="hidden" name="hub" value={hub} />
        <input type="hidden" name="origin_city" value={originCity} />
        <input type="hidden" name="destination_city" value={destinationCity} />
        <input type="hidden" name="active" value={active ? "true" : "false"} />
        <input
          type="hidden"
          name="intermediate_cities"
          value={JSON.stringify(intermediates.filter((ic) => ic.city.trim()))}
        />
        <input type="hidden" name="sla_hours" value={slaHours} />
        <input type="hidden" name="notes" value={notes} />

        {/* ── IDENTIFICACIÓN ──────────────────────────── */}
        <Section eyebrow="Identificación">
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label">ID de ruta</label>
              <input
                value={mode === "edit" && route ? route.route_code : "Se asigna al crear"}
                disabled
                className="studio-input studio-input-mono"
                style={{ marginTop: 6 }}
              />
            </div>
            <div>
              <label className="studio-label">
                Nombre (opcional · auto si vacío)
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={autoName || "Valencia → …"}
                className="studio-input"
                style={{ marginTop: 6 }}
              />
              {state?.fieldErrors?.name && (
                <FieldError msg={state.fieldErrors.name} />
              )}
            </div>
          </div>
        </Section>

        {/* ── TIPO DE RUTA · segmented cards ──────────── */}
        <Section eyebrow="Tipo de ruta">
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <TypeCard
              active={routeType === "directa"}
              tone="info"
              icon={Icon.arrowR(15)}
              label="Directa"
              desc="Solo paquetes con destino exacto. Sin paradas."
              onClick={() => setType("directa")}
            />
            <TypeCard
              active={routeType === "intermedias"}
              tone="warning"
              icon={Icon.pin(15)}
              label="Con ciudades"
              desc="Destino + paquetes del radio de cada parada."
              onClick={() => setType("intermedias")}
            />
          </div>
        </Section>

        {/* ── ORIGEN Y DESTINO ────────────────────────── */}
        <Section eyebrow="Origen y destino">
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label">Hub origen</label>
              <select
                value={hub}
                onChange={(e) => setHub(e.target.value as DispatchHub)}
                className="studio-input"
                style={{ marginTop: 6 }}
              >
                {DISPATCH_HUB_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
            <CityPicker
              label="Ciudad origen"
              value={originCity}
              onChange={setOriginCity}
              cities={activeCities.filter((c) => c.city !== destinationCity)}
              veCatalog={veCatalog}
              placeholder="— Elegir origen —"
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <CityPicker
              label="Ciudad destino"
              value={destinationCity}
              onChange={setDestinationCity}
              cities={activeCities.filter((c) => c.city !== originCity)}
              veCatalog={veCatalog}
              placeholder="— Elegir destino —"
            />
            {state?.fieldErrors?.destination_city && (
              <FieldError msg={state.fieldErrors.destination_city} />
            )}
          </div>
          <InfoLine>
            {Icon.info(11)}
            <span>
              Multi-hub habilitado: {Object.values(DISPATCH_HUB_LABELS).join(" · ")}.
              El origen normalmente coincide con el hub elegido.
            </span>
          </InfoLine>
        </Section>

        {/* ── CIUDADES INTERMEDIAS (solo si intermedias) ── */}
        {routeType === "intermedias" && (
          <Section
            eyebrow="Ciudades intermedias"
            headerRight={
              <span
                style={{
                  font: "500 11.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                {intermediates.length} ciudad
                {intermediates.length === 1 ? "" : "es"} configurada
                {intermediates.length === 1 ? "" : "s"}
              </span>
            }
          >
            {intermediates.length === 0 && (
              <div
                style={{
                  padding: "14px 16px",
                  textAlign: "center",
                  background: "var(--bg-elevated)",
                  border: "1px dashed var(--border)",
                  borderRadius: "var(--r-md)",
                  font: "500 12.5px/1.5 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginBottom: 10,
                }}
              >
                Todavía no agregaste ciudades intermedias. Elige una del selector
                de abajo.
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {intermediates.map((s, i) => {
                const def = cities.find((c) => c.city === s.city);
                const isOverride =
                  def && def.default_radius_km !== s.radius_km;
                return (
                  <div
                    key={`${s.city}-${i}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px 1fr 160px 28px",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: "var(--warning-bg)",
                        color: "var(--warning)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        font: "800 12px/1 var(--f-display)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          font: "700 13px/1.2 var(--f-sans)",
                          color: "var(--ink)",
                        }}
                      >
                        {s.city}
                      </div>
                      <div
                        style={{
                          font: "500 10.5px/1 var(--f-sans)",
                          color: "var(--ink-soft)",
                          marginTop: 2,
                        }}
                      >
                        {def
                          ? `default catálogo: ${def.default_radius_km} km`
                          : "sin default · ciudad no está en catálogo"}
                        {isOverride && (
                          <span
                            style={{
                              color: "var(--wine-text)",
                              marginLeft: 6,
                              font: "700 10.5px/1 var(--f-sans)",
                            }}
                          >
                            {" "}
                            · override en esta ruta
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        justifySelf: "end",
                      }}
                    >
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={s.radius_km}
                        onChange={(e) =>
                          updateIntermediateRadius(
                            i,
                            parseInt(e.target.value || "0", 10),
                          )
                        }
                        style={{
                          width: 60,
                          height: 30,
                          padding: "0 8px",
                          background: "var(--bg-surface)",
                          color: "var(--ink)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--r-sm)",
                          font: "700 13px/1 var(--f-mono)",
                          textAlign: "center",
                          outline: "none",
                        }}
                      />
                      <span
                        style={{
                          font: "700 11px/1 var(--f-sans)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        km de radio
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeIntermediate(i)}
                      aria-label="Quitar ciudad"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "var(--r-sm)",
                        color: "var(--danger)",
                        background: "transparent",
                        border: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {Icon.close(14)}
                    </button>
                  </div>
                );
              })}
            </div>

            <CityPicker
              label="Agregar ciudad intermedia"
              value=""
              onChange={addIntermediate}
              cities={intermediateCandidates}
              veCatalog={veCatalog}
              placeholder="— Elige una ciudad —"
              showDefaultRadius
            />
            {state?.fieldErrors?.intermediate_cities && (
              <FieldError msg={state.fieldErrors.intermediate_cities} />
            )}
          </Section>
        )}

        {/* ── SLA y notas ─────────────────────────────── */}
        <Section eyebrow="Tiempos y notas">
          <div
            style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label">SLA en horas</label>
              <input
                type="number"
                min={1}
                max={720}
                value={slaHours}
                onChange={(e) => setSlaHours(Number(e.target.value))}
                className="studio-input studio-input-mono"
                style={{ marginTop: 6 }}
              />
              {state?.fieldErrors?.sla_hours && (
                <FieldError msg={state.fieldErrors.sla_hours} />
              )}
            </div>
            <div>
              <label className="studio-label">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Mejores horarios, peajes, contactos…"
                className="studio-input"
                style={{ marginTop: 6, resize: "vertical" }}
              />
            </div>
          </div>
        </Section>

        {/* ── ESTADO ──────────────────────────────────── */}
        <div
          style={{
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                font: "800 12.5px/1.1 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              Ruta activa
            </div>
            <div
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 2,
              }}
            >
              Solo las activas aparecen en el filtro de la cola de despacho.
            </div>
          </div>
          <DrawerSwitch on={active} onChange={() => setActive(!active)} />
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
          <div>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              disabled={isPending || deletePending}
              style={{ color: "var(--danger)" }}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Eliminar ruta
            </button>
          </div>
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
            {isPending
              ? "Guardando…"
              : mode === "create"
                ? "Crear ruta"
                : "Guardar cambios"}
          </button>
        </div>
      </footer>
      {mode === "edit" && route && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          danger
          pending={deletePending}
          title={`Eliminar ruta ${route.route_code}`}
          message="La ruta quedará desactivada y dejará de aparecer en las listas. Su historial se conserva."
          confirmLabel="Eliminar ruta"
          error={deleteState?.error}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={() => {
            const data = new FormData();
            data.set("id", route.id);
            startDeleteTransition(() => deleteAction(data));
          }}
        />
      )}
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────

function Section({
  eyebrow,
  headerRight,
  children,
}: {
  eyebrow: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </span>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function TypeCard({
  active,
  tone,
  icon,
  label,
  desc,
  onClick,
}: {
  active: boolean;
  tone: "info" | "warning";
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "12px 14px",
        textAlign: "left",
        background: active ? `var(--${tone}-bg)` : "var(--bg-elevated)",
        border: `1px solid ${active ? `var(--${tone})` : "transparent"}`,
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span style={{ color: `var(--${tone})`, marginTop: 2, display: "inline-flex" }}>
        {icon}
      </span>
      <div>
        <div
          style={{
            font: "800 13px/1.1 var(--f-display)",
            color: active ? `var(--${tone})` : "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: active ? `var(--${tone})` : "var(--ink-soft)",
            marginTop: 3,
          }}
        >
          {desc}
        </div>
      </div>
    </button>
  );
}

function DrawerSwitch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={on}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 999,
        background: on ? "var(--wine)" : "var(--bg-elevated)",
        border: `1px solid ${on ? "var(--wine)" : "var(--border)"}`,
        transition: "background-color 160ms ease, border-color 160ms ease",
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 160ms ease",
        }}
      />
    </button>
  );
}

function InfoLine({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8,
        font: "500 11.5px/1.5 var(--f-sans)",
        color: "var(--ink-soft)",
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
      }}
    >
      {children}
    </div>
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
    <Aviso tono="error">{msg}</Aviso>
  );
}

"use client";

/**
 * Filtros del listado de Tracking.
 *
 * Filtros principales (siempre visibles):
 *   - q (busqueda libre, debounced 350ms)
 *   - service (dropdown)
 *   - status (dropdown)
 *
 * Panel "Mas filtros" (toggle, oculto por defecto):
 *   - createdFrom / createdTo (date pickers)
 *   - origin / destination (substring ilike)
 *   - vehicleCategory (dropdown)
 *   - onlyAlert (toggle, equivalente a status=exception)
 *
 * URL state: ?q=&service=&status=&from=&to=&origin=&dest=&veh=&alert=1
 * El boton "Mas filtros" muestra contador cuando hay filtros activos.
 * "Limpiar" resetea todo.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import {
  SERVICE_OPTIONS,
  STATUS_LABELS,
  VEHICLE_CATEGORY_OPTIONS,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";

const ALL_STATUSES: ShipmentStatus[] = [
  "draft",
  "in_warehouse",
  "consolidating",
  "shipped",
  "in_transit",
  "in_customs",
  "arrived_destination",
  "delayed_warehouse",
  "out_for_delivery",
  "last_mile",
  "delivered",
  "exception",
  "cancelled",
];

type AdvFilters = {
  from: string;
  to: string;
  origin: string;
  dest: string;
  veh: string;
  alert: boolean;
};

const EMPTY_ADV: AdvFilters = {
  from: "",
  to: "",
  origin: "",
  dest: "",
  veh: "",
  alert: false,
};

function readAdvFromParams(sp: URLSearchParams): AdvFilters {
  return {
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    origin: sp.get("origin") ?? "",
    dest: sp.get("dest") ?? "",
    veh: sp.get("veh") ?? "",
    alert: sp.get("alert") === "1",
  };
}

function countActive(adv: AdvFilters): number {
  let c = 0;
  if (adv.from) c++;
  if (adv.to) c++;
  if (adv.origin.trim()) c++;
  if (adv.dest.trim()) c++;
  if (adv.veh) c++;
  if (adv.alert) c++;
  return c;
}

export function TrackingFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Estado local (sync con URL al inicio + al navegar)
  const [q, setQ] = useState(params.get("q") ?? "");
  const [service, setService] = useState(params.get("service") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [adv, setAdv] = useState<AdvFilters>(() => readAdvFromParams(params));
  const [showAdv, setShowAdv] = useState(() => countActive(readAdvFromParams(params)) > 0);

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setService(params.get("service") ?? "");
    setStatus(params.get("status") ?? "");
    setAdv(readAdvFromParams(params));
  }, [params]);

  const buildUrl = (overrides: Partial<AdvFilters & { q: string; service: string; status: string }> = {}) => {
    const search = new URLSearchParams();
    const fQ = overrides.q ?? q;
    const fService = overrides.service ?? service;
    const fStatus = overrides.status ?? status;
    const fAdv: AdvFilters = {
      from: overrides.from ?? adv.from,
      to: overrides.to ?? adv.to,
      origin: overrides.origin ?? adv.origin,
      dest: overrides.dest ?? adv.dest,
      veh: overrides.veh ?? adv.veh,
      alert: overrides.alert ?? adv.alert,
    };

    if (fQ.trim()) search.set("q", fQ.trim());
    if (fService) search.set("service", fService);
    if (fStatus) search.set("status", fStatus);
    if (fAdv.from) search.set("from", fAdv.from);
    if (fAdv.to) search.set("to", fAdv.to);
    if (fAdv.origin.trim()) search.set("origin", fAdv.origin.trim());
    if (fAdv.dest.trim()) search.set("dest", fAdv.dest.trim());
    if (fAdv.veh) search.set("veh", fAdv.veh);
    if (fAdv.alert) search.set("alert", "1");

    return search.toString() ? `/studio/tracking?${search.toString()}` : "/studio/tracking";
  };

  const push = (url: string) => startTransition(() => router.push(url));

  const clear = () => {
    setQ("");
    setService("");
    setStatus("");
    setAdv(EMPTY_ADV);
    push("/studio/tracking");
  };

  // Debounce del input de busqueda (350ms)
  useEffect(() => {
    const currentUrlQ = params.get("q") ?? "";
    if (q === currentUrlQ) return;
    const timer = setTimeout(() => push(buildUrl({ q })), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Debounce de origen/destino (texto libre)
  useEffect(() => {
    const currentOrigin = params.get("origin") ?? "";
    const currentDest = params.get("dest") ?? "";
    if (adv.origin === currentOrigin && adv.dest === currentDest) return;
    const timer = setTimeout(
      () => push(buildUrl({ origin: adv.origin, dest: adv.dest })),
      350,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adv.origin, adv.dest]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    push(buildUrl());
  };

  const hasAnyFilter =
    q !== "" ||
    service !== "" ||
    status !== "" ||
    countActive(adv) > 0;
  const advCount = countActive(adv);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginBottom: 18,
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 0.12s",
      }}
    >
      {/* Fila principal */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
          <label className="studio-label" htmlFor="filter-q">
            Buscar
          </label>
          <input
            id="filter-q"
            type="search"
            className="studio-input"
            placeholder="Código, cliente, ruta, ‘terrestre’, ‘aduana’…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 200px" }}>
          <label className="studio-label" htmlFor="filter-service">
            Servicio
          </label>
          <select
            id="filter-service"
            className="studio-input"
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              push(buildUrl({ service: e.target.value }));
            }}
          >
            <option value="">Todos los servicios</option>
            {SERVICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 170px" }}>
          <label className="studio-label" htmlFor="filter-status">
            Estado
          </label>
          <select
            id="filter-status"
            className="studio-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              push(buildUrl({ status: e.target.value }));
            }}
          >
            <option value="">Todos los estados</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ height: 38 }}
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={() => setShowAdv((s) => !s)}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{
            height: 38,
            background: showAdv ? "var(--studio-paper-2)" : undefined,
            borderColor: advCount > 0 ? "var(--studio-wine)" : undefined,
            color: advCount > 0 ? "var(--studio-wine)" : undefined,
          }}
          title="Más filtros: fecha, ruta, vehículo, alertas"
          aria-expanded={showAdv}
          aria-controls="advanced-filters-panel"
        >
          <FilterIcon />
          <span>Más filtros{advCount > 0 ? ` (${advCount})` : ""}</span>
        </button>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={clear}
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38, color: "var(--ink-soft)" }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Panel de filtros avanzados */}
      {showAdv && (
        <div
          id="advanced-filters-panel"
          style={{
            marginTop: 12,
            padding: 16,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
            Más filtros
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label className="studio-label" htmlFor="adv-from">
                Creado desde
              </label>
              <input
                id="adv-from"
                type="date"
                className="studio-input"
                value={adv.from}
                onChange={(e) => {
                  const v = e.target.value;
                  setAdv((a) => ({ ...a, from: v }));
                  push(buildUrl({ from: v }));
                }}
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="adv-to">
                Creado hasta
              </label>
              <input
                id="adv-to"
                type="date"
                className="studio-input"
                value={adv.to}
                onChange={(e) => {
                  const v = e.target.value;
                  setAdv((a) => ({ ...a, to: v }));
                  push(buildUrl({ to: v }));
                }}
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="adv-origin">
                Origen
              </label>
              <input
                id="adv-origin"
                type="text"
                className="studio-input"
                placeholder="Yiwu, Guangzhou…"
                value={adv.origin}
                onChange={(e) => setAdv((a) => ({ ...a, origin: e.target.value }))}
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="adv-dest">
                Destino
              </label>
              <input
                id="adv-dest"
                type="text"
                className="studio-input"
                placeholder="Valencia, Caracas…"
                value={adv.dest}
                onChange={(e) => setAdv((a) => ({ ...a, dest: e.target.value }))}
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="adv-veh">
                Vehículo
              </label>
              <select
                id="adv-veh"
                className="studio-input"
                value={adv.veh}
                onChange={(e) => {
                  const v = e.target.value;
                  setAdv((a) => ({ ...a, veh: v }));
                  push(buildUrl({ veh: v }));
                }}
              >
                <option value="">Cualquiera</option>
                {VEHICLE_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  background: adv.alert ? "var(--danger-bg)" : "var(--bg-elevated)",
                  border: `1px solid ${adv.alert ? "var(--danger)" : "var(--border)"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  font: "500 12px/1 var(--f-sans)",
                  color: adv.alert ? "var(--danger)" : "var(--ink)",
                  width: "100%",
                  height: 38,
                  boxSizing: "border-box",
                }}
                title="Solo envíos en estado «Excepción» (alerta operativa)"
              >
                <input
                  type="checkbox"
                  checked={adv.alert}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setAdv((a) => ({ ...a, alert: v }));
                    push(buildUrl({ alert: v }));
                  }}
                  style={{ accentColor: "var(--danger)" }}
                />
                <span>⚠ Solo con alerta</span>
              </label>
            </div>
          </div>

          <p
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-mute)",
              margin: "12px 0 0",
            }}
          >
            Próximamente: filtros por bodegaje activo (días), peso/volumen, MARKBOX cliente.
          </p>
        </div>
      )}
    </form>
  );
}

/** Ícono filter (líneas decrecientes) */
function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

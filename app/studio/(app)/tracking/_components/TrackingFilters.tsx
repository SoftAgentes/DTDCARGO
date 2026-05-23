"use client";

/**
 * Filtros del listado de Tracking.
 *
 * Mantiene URL state via searchParams: ?service=consolidacion&status=in_transit&q=...
 * Submit con Enter en el input o cambio del select dispara router.push().
 * "Limpiar" resetea a /studio/tracking sin params.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import {
  SERVICE_OPTIONS,
  STATUS_LABELS,
  type ShipmentService,
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

export function TrackingFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initialQ = params.get("q") ?? "";
  const initialService = params.get("service") ?? "";
  const initialStatus = params.get("status") ?? "";

  // Local state para inputs controlados
  const [q, setQ] = useState(initialQ);
  const [service, setService] = useState(initialService);
  const [status, setStatus] = useState(initialStatus);

  // Sync con URL cuando el usuario navega atras/adelante
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setService(params.get("service") ?? "");
    setStatus(params.get("status") ?? "");
  }, [params]);

  const apply = (next: { q?: string; service?: string; status?: string }) => {
    const search = new URLSearchParams();
    const fQ = next.q ?? q;
    const fService = next.service ?? service;
    const fStatus = next.status ?? status;

    if (fQ.trim()) search.set("q", fQ.trim());
    if (fService) search.set("service", fService);
    if (fStatus) search.set("status", fStatus);

    const url = search.toString()
      ? `/studio/tracking?${search.toString()}`
      : "/studio/tracking";
    startTransition(() => router.push(url));
  };

  const clear = () => {
    setQ("");
    setService("");
    setStatus("");
    startTransition(() => router.push("/studio/tracking"));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apply({});
  };

  const hasFilters = q !== "" || service !== "" || status !== "";

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-end",
        flexWrap: "wrap",
        marginBottom: 18,
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 0.12s",
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
          placeholder="Código, cliente o MARKBOX…"
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
            apply({ service: e.target.value });
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
            apply({ status: e.target.value });
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
      {hasFilters && (
        <button
          type="button"
          onClick={clear}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ height: 38, color: "#6B6B6B" }}
        >
          Limpiar
        </button>
      )}
    </form>
  );
}

/**
 * Convierte searchParams crudos en un objeto ShipmentFilters tipado.
 * Sanitiza valores invalidos: "consolidacion-fake" → undefined.
 */
export function parseFiltersFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): { service?: ShipmentService; status?: ShipmentStatus; q?: string } {
  const service = typeof sp.service === "string" ? sp.service : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const validServices: ShipmentService[] = [
    "consolidacion",
    "puerta_a_puerta_DDP",
    "reserva_FCL",
    "transporte_terrestre",
  ];

  return {
    service: service && validServices.includes(service as ShipmentService)
      ? (service as ShipmentService)
      : undefined,
    status: status && ALL_STATUSES.includes(status as ShipmentStatus)
      ? (status as ShipmentStatus)
      : undefined,
    q,
  };
}

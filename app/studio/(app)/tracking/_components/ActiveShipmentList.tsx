"use client";

/**
 * ActiveShipmentList — sidebar 320px de embarques activos (SDD-0013).
 *
 * Client component: tiene búsqueda local y mantiene la selección via
 * URL (?id=...) usando useRouter.replace. Reusa el StatusBadge.
 */

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge } from "./StatusBadge";
import {
  computeProgress,
} from "@/lib/studio/tracking-progress";
import type {
  ShipmentService,
  ShipmentStatus,
} from "@/lib/studio/shipment-types";
import { AdjuntosConteo } from "@/app/studio/_components/documents/AdjuntosConteo";
import {
  FILTRO_ADJUNTOS_OPCIONES,
  desgloseEmbarque,
  pasaFiltroAdjuntos,
  type ConteoEmbarque,
  type ConteosPorId,
  type FiltroAdjuntos,
} from "@/lib/studio/documents/adjuntos";

export type ActiveShipmentRow = {
  id: string;
  code: string;
  client_name: string | null;
  client_markbox: string | null;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  created_at: string;
  arrived_destination_at: string | null;
};

type Props = {
  shipments: ActiveShipmentRow[];
  selectedId: string | null;
  /** SDD-0507: adjuntos por embarque. `null` = no se pudo contar (se dice). */
  adjuntos: ConteosPorId<ConteoEmbarque>;
};

function formatEta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}

export function ActiveShipmentList({ shipments, selectedId, adjuntos }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [filtroAdjuntos, setFiltroAdjuntos] = useState<FiltroAdjuntos>("todos");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // SDD-0507: con / sin adjuntos. Sin conteo no filtra (y el select ni se pinta).
    const conAdjuntos = shipments.filter((s) =>
      pasaFiltroAdjuntos(filtroAdjuntos, adjuntos, s.id),
    );
    if (!q) return conAdjuntos;
    return conAdjuntos.filter((s) => {
      return (
        s.code.toLowerCase().includes(q) ||
        (s.client_name?.toLowerCase().includes(q) ?? false) ||
        (s.client_markbox?.toLowerCase().includes(q) ?? false) ||
        (s.origin?.toLowerCase().includes(q) ?? false) ||
        (s.destination?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [shipments, query, filtroAdjuntos, adjuntos]);

  function selectShipment(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("id", id);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Search */}
      <input
        type="search"
        placeholder="Buscar embarque…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="studio-input"
      />

      {adjuntos !== null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label
            className="studio-label"
            htmlFor="trk-adj"
            style={{ margin: 0, flexShrink: 0 }}
          >
            Adjuntos
          </label>
          <select
            id="trk-adj"
            className="studio-input"
            value={filtroAdjuntos}
            onChange={(e) => setFiltroAdjuntos(e.target.value as FiltroAdjuntos)}
          >
            {FILTRO_ADJUNTOS_OPCIONES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p
          role="status"
          style={{
            margin: 0,
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          No se pudieron contar los adjuntos.
        </p>
      )}

      {/* Lista scrollable */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          maxHeight: 720,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "var(--s-6) var(--s-4)",
              textAlign: "center",
              color: "var(--ink-soft)",
              font: "500 12px/1.5 var(--f-sans)",
              border: "1px dashed var(--border-strong)",
              borderRadius: 8,
            }}
          >
            {query
              ? "Ningún envío coincide con la búsqueda."
              : filtroAdjuntos === "con"
                ? "Ningún envío activo tiene adjuntos."
                : filtroAdjuntos === "sin"
                  ? "Todos los envíos activos tienen adjuntos."
                  : "Sin envíos activos."}
          </div>
        ) : (
          filtered.map((s) => {
            const isActive = s.id === selectedId;
            const progress = computeProgress(s.status);
            const isAlert =
              s.status === "exception" || s.status === "delayed_warehouse";

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectShipment(s.id)}
                className="studio-shipment-card"
                data-active={isActive ? "true" : "false"}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  background: isActive
                    ? "var(--wine-tint)"
                    : "var(--bg-surface)",
                  border: `1px solid ${
                    isActive ? "var(--wine)" : "var(--border)"
                  }`,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <code
                    style={{
                      font: "800 12px/1 var(--f-mono)",
                      color: isActive ? "var(--wine)" : "var(--ink)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {s.code}
                  </code>
                  <StatusBadge status={s.status} />
                </div>

                <div
                  style={{
                    font: "600 12.5px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  {s.client_name ?? "Sin cliente"}
                </div>

                {(s.origin || s.destination) && (
                  <div
                    style={{
                      font: "500 11px/1.3 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginTop: 3,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {s.origin ?? "?"} → {s.destination ?? "?"}
                  </div>
                )}

                {/* Progress bar */}
                <div
                  style={{
                    height: 4,
                    background: "var(--bg-elevated)",
                    borderRadius: 4,
                    marginTop: 10,
                    overflow: "hidden",
                  }}
                  aria-hidden
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: isAlert
                        ? "var(--warning)"
                        : "var(--wine)",
                      transition: "width 240ms",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 6,
                    font: "600 10.5px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                  }}
                >
                  <span>{progress}%</span>
                  {adjuntos !== null && (
                    <AdjuntosDeTarjeta conteo={adjuntos[s.id]} />
                  )}
                  <span>ETA {formatEta(s.arrived_destination_at)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Indicador de la tarjeta. Sin entrada cuenta como cero (ver `pasaFiltroAdjuntos`). */
function AdjuntosDeTarjeta({ conteo }: { conteo: ConteoEmbarque | undefined }) {
  const c = conteo ?? { internos: 0, portal: 0, total: 0 };
  return <AdjuntosConteo total={c.total} desglose={desgloseEmbarque(c)} variante="tarjeta" />;
}

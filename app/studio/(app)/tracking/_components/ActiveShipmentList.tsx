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
};

function formatEta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}

export function ActiveShipmentList({ shipments, selectedId }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shipments;
    return shipments.filter((s) => {
      return (
        s.code.toLowerCase().includes(q) ||
        (s.client_name?.toLowerCase().includes(q) ?? false) ||
        (s.client_markbox?.toLowerCase().includes(q) ?? false) ||
        (s.origin?.toLowerCase().includes(q) ?? false) ||
        (s.destination?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [shipments, query]);

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
              padding: "24px 16px",
              textAlign: "center",
              color: "var(--ink-soft)",
              font: "500 12px/1.5 var(--f-sans)",
              border: "1px dashed var(--border-strong)",
              borderRadius: 8,
            }}
          >
            {query
              ? "Ningún envío coincide con la búsqueda."
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
                    marginTop: 6,
                    font: "600 10.5px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                  }}
                >
                  <span>{progress}%</span>
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

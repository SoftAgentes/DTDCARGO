"use client";

/**
 * Timeline del envio: lista de eventos cronologica (mas reciente arriba).
 *
 * Cliente porque incluye modal "Agregar evento manual". Para listas grandes
 * tirariamos a colapso, pero MVP-0 muestra todos (max 200 del query).
 */

import { useState, useTransition } from "react";
import { addShipmentEvent } from "../actions";
import { getApplicableStatuses } from "@/lib/studio/shipment-state-machine";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/studio/shipment-types";
import type {
  ShipmentService,
  ShipmentStatus,
} from "@/lib/studio/shipment-types";
import type { ShipmentEventRow } from "@/lib/studio/shipment-queries";

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return `hace ${diffHr} h · ${d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TimelinePanel({
  shipmentId,
  service,
  events,
}: {
  shipmentId: string;
  service: ShipmentService;
  events: ShipmentEventRow[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const applicableStatuses = getApplicableStatuses(service);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await addShipmentEvent(shipmentId, {}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setShowForm(false);
      }
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div className="studio-eyebrow">Timeline</div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="studio-btn studio-btn-ghost studio-btn-xs"
        >
          {showForm ? "Cancelar" : "+ Evento manual"}
        </button>
      </div>

      {showForm && (
        <form
          action={handleSubmit}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <label className="studio-label">Estado</label>
          <select
            name="status"
            className="studio-input"
            defaultValue=""
            required
            style={{ marginBottom: 10 }}
          >
            <option value="" disabled>
              Elige un estado…
            </option>
            {applicableStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <label className="studio-label">Fecha del evento</label>
          <input
            type="datetime-local"
            name="occurred_at"
            className="studio-input"
            style={{ marginBottom: 10 }}
          />

          <label className="studio-label">Nota (opcional)</label>
          <textarea
            name="note"
            className="studio-input"
            rows={2}
            placeholder="Detalles del evento, p. ej. ‘pasó por aduana sin inspección’"
            style={{ marginBottom: 12, resize: "vertical" }}
          />

          {error && (
            <p
              style={{
                color: "var(--danger)",
                font: "500 11.5px/1.4 var(--f-sans)",
                marginBottom: 10,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="studio-btn studio-btn-primary studio-btn-sm"
            disabled={isPending}
          >
            {isPending ? "Guardando…" : "Guardar evento"}
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Sin eventos todavía.
        </p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            position: "relative",
          }}
        >
          {events.map((e, i) => {
            const color = STATUS_COLORS[e.status];
            return (
              <li
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "14px 1fr",
                  gap: 12,
                  paddingBottom: i === events.length - 1 ? 0 : 14,
                  position: "relative",
                }}
              >
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      display: "block",
                      width: 12,
                      height: 12,
                      background: color,
                      borderRadius: "50%",
                      border: "2px solid var(--bg-base)",
                      marginTop: 3,
                      // Evento mas reciente: ring sutil del mismo color
                      boxShadow: i === 0 ? `0 0 0 4px ${color}33` : undefined,
                    }}
                  />
                  {i < events.length - 1 && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 18,
                        left: 5,
                        bottom: -18,
                        width: 2,
                        background: "var(--border)",
                      }}
                    />
                  )}
                </div>
                <div>
                  <div
                    style={{
                      font: "700 12px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                      marginBottom: 3,
                    }}
                  >
                    {STATUS_LABELS[e.status]}
                  </div>
                  {e.note && (
                    <div
                      style={{
                        font: "400 12px/1.45 var(--f-sans)",
                        color: "var(--ink)",
                        marginBottom: 3,
                      }}
                    >
                      {e.note}
                    </div>
                  )}
                  <div
                    style={{
                      font: "500 10.5px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {formatEventTime(e.occurred_at)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

"use client";

/**
 * CalendarSection — sección "Feriados & ferias" del admin (SDD-0127).
 *
 * Lista el calendario operativo CN/VE (feriados + ferias) y permite CRUD vía
 * drawer. Afecta lead times / SLAs — de ahí que viva en admin.
 */

import { useMemo, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { CalendarEventDrawer } from "./CalendarEventDrawer";
import {
  calCountryLabel,
  calKindLabel,
  calKindTone,
  type CalendarEvent,
} from "@/lib/studio/op-calendar-types";

type DrawerState = { mode: "create" | "edit"; event: CalendarEvent | null } | null;

function fmt(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

function dateLabel(e: CalendarEvent): string {
  return e.endDate && e.endDate !== e.startDate ? `${fmt(e.startDate)} → ${fmt(e.endDate)}` : fmt(e.startDate);
}

export function CalendarSection({ events }: { events: CalendarEvent[] }) {
  const toast = useToast();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const filtered = useMemo(
    () => events.filter((e) => countryFilter === "all" || e.country === countryFilter),
    [events, countryFilter],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="studio-input"
          style={{ maxWidth: 200 }}
          aria-label="Filtrar por país"
        >
          <option value="all">Todos los países</option>
          <option value="CN">China</option>
          <option value="VE">Venezuela</option>
        </select>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={() => setDrawer({ mode: "create", event: null })}
        >
          + Nuevo feriado o feria
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          eyebrow="Calendario operativo"
          title="Sin eventos"
          description={
            events.length === 0
              ? "Carga feriados y ferias CN/VE para que operaciones los tenga en cuenta en los lead times."
              : "Ningún evento para ese país."
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((e) => (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "88px 90px 1fr 200px 80px",
                gap: 14,
                padding: "12px 14px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                alignItems: "center",
              }}
            >
              <Badge tone={e.country === "VE" ? "neutral" : "info"} size="sm">
                {calCountryLabel(e.country)}
              </Badge>
              <Badge tone={calKindTone(e.kind)} size="sm">
                {calKindLabel(e.kind)}
              </Badge>
              <div>
                <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{e.name}</div>
                {e.note && (
                  <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>{e.note}</div>
                )}
              </div>
              <code style={{ font: "600 12px/1.3 var(--f-mono)", color: "var(--ink-soft)" }}>{dateLabel(e)}</code>
              <button
                type="button"
                onClick={() => setDrawer({ mode: "edit", event: e })}
                style={{ font: "600 11.5px/1 var(--f-sans)", color: "var(--wine)", justifySelf: "end", background: "transparent", border: 0, cursor: "pointer" }}
              >
                Editar →
              </button>
            </div>
          ))}
        </div>
      )}

      {drawer && (
        <CalendarEventDrawer
          mode={drawer.mode}
          event={drawer.event}
          onClose={() => setDrawer(null)}
          onSaved={(msg) => toast.success(msg)}
        />
      )}
    </div>
  );
}

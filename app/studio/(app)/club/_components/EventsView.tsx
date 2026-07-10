"use client";

/**
 * Vista Eventos del Club (SDD-0116, Slice C V1). KPIs + lista de eventos
 * (tarjetas). Alta/edición vía drawer; baja con confirm. Trazabilidad: highlight
 * warm del evento creado. Inscripciones de miembros = diferidas (Slice C.2).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import {
  clubEventModalityLabel,
  clubEventStatusLabel,
  clubEventStatusTone,
  type ClubEvent,
  type ClubEventStats,
} from "@/lib/studio/club/club-event-types";
import { ClubEventDrawer } from "./ClubEventDrawer";
import { softDeleteClubEventAction } from "../actions";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso: string | null): string {
  if (!iso) return "fecha por definir";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "fecha por definir";
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function EventsView({
  stats,
  events,
}: {
  stats: ClubEventStats;
  events: ClubEvent[];
}) {
  const router = useRouter();
  const toast = useToast();
  const flashClassFor = useRowHighlight();

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ClubEvent | null>(null);
  const [toDelete, setToDelete] = useState<ClubEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const r = await softDeleteClubEventAction(toDelete.id);
    setDeleting(false);
    if (r.error) return toast.error(r.error);
    toast.success(`Evento "${toDelete.name}" eliminado`);
    setToDelete(null);
    router.refresh();
  };

  return (
    <div>
      {events.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button type="button" className="studio-btn studio-btn-primary" onClick={() => setShowNew(true)}>
            + Nuevo evento
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard
          value={stats.proximos}
          label="Próximos eventos"
          valueColor={stats.proximos > 0 ? "var(--info)" : "var(--ink)"}
          sub="por venir"
        />
        <KpiCard value={stats.total} label="Total de eventos" sub="vivos" />
      </div>

      {events.length === 0 ? (
        <EmptyState
          eyebrow="Eventos"
          title="Aún no hay eventos del Club"
          description="Crea el primer encuentro de la comunidad: una feria, una sesión en vivo o una visita con el equipo DTD."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={() => setShowNew(true)}>
              + Nuevo evento
            </button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              flashClassFor={flashClassFor}
              onEdit={() => setEditing(ev)}
              onDelete={() => setToDelete(ev)}
            />
          ))}
        </div>
      )}

      {showNew && <ClubEventDrawer onClose={() => setShowNew(false)} />}
      {editing && <ClubEventDrawer event={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar evento"
        message={toDelete ? `¿Eliminar el evento "${toDelete.name}"?` : ""}
        confirmLabel="Eliminar"
        danger
        pending={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function EventCard({
  ev,
  flashClassFor,
  onEdit,
  onDelete,
}: {
  ev: ClubEvent;
  flashClassFor: (id: string | null | undefined) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = [
    fmtDate(ev.startsAt),
    clubEventModalityLabel(ev.modality),
    ev.place,
    ev.facilitatorName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      data-row-id={ev.id}
      className={flashClassFor(ev.id)}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
            <span style={{ font: "700 15px/1.2 var(--f-sans)", color: "var(--ink)" }}>{ev.name}</span>
            <Badge tone={clubEventStatusTone(ev.status)} size="sm">
              {clubEventStatusLabel(ev.status)}
            </Badge>
          </div>
          <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: "var(--s-1)" }}>
            {meta}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="studio-btn studio-btn-danger studio-btn-xs" onClick={onDelete}>
            Eliminar
          </button>
        </div>
      </div>

      {ev.summary && (
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "8px 0 0" }}>
          {ev.summary}
        </p>
      )}
    </div>
  );
}

"use client";

/**
 * Vista Eventos del Club (SDD-0116, Slice C + C.2). KPIs + lista de eventos
 * (tarjetas) con su grilla de inscripciones de miembros (C.2: inscribir + marcar
 * asistencia). Alta/edición vía drawer; baja con confirm. Trazabilidad: highlight
 * warm del evento creado.
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
import {
  EVENT_REGISTRATION_STATUSES,
  eventRegistrationStatusLabel,
  eventRegistrationStatusTone,
  type EventRegistration,
  type EventRegistrationStatus,
} from "@/lib/studio/club/club-event-registration-types";
import type { EligibleMember } from "@/lib/studio/club/group-buy-queries";
import { ClubEventDrawer } from "./ClubEventDrawer";
import { EventRegistrationDrawer } from "./EventRegistrationDrawer";
import {
  softDeleteClubEventAction,
  removeEventRegistrationAction,
  setRegistrationAttendanceAction,
} from "../actions";

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
  registrationsByEvent,
  eligibleMembers,
}: {
  stats: ClubEventStats;
  events: ClubEvent[];
  registrationsByEvent: Record<string, EventRegistration[]>;
  eligibleMembers: EligibleMember[];
}) {
  const router = useRouter();
  const toast = useToast();
  const flashClassFor = useRowHighlight();

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ClubEvent | null>(null);
  const [toDelete, setToDelete] = useState<ClubEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Inscribir/editar inscripción: guardamos el evento + (opcional) la inscripción.
  const [regCtx, setRegCtx] = useState<{
    ev: ClubEvent;
    registration: EventRegistration | null;
  } | null>(null);
  const [toRemove, setToRemove] = useState<EventRegistration | null>(null);
  const [removing, setRemoving] = useState(false);

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

  const handleRemoveReg = async () => {
    if (!toRemove) return;
    setRemoving(true);
    const r = await removeEventRegistrationAction(toRemove.id);
    setRemoving(false);
    if (r.error) return toast.error(r.error);
    toast.success(`${toRemove.memberName} quitado del evento`);
    setToRemove(null);
    router.refresh();
  };

  const handleAttendance = async (reg: EventRegistration, status: EventRegistrationStatus) => {
    const r = await setRegistrationAttendanceAction(reg.id, status);
    if (r.error) return toast.error(r.error);
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
              registrations={registrationsByEvent[ev.id] ?? []}
              flashClassFor={flashClassFor}
              onEdit={() => setEditing(ev)}
              onDelete={() => setToDelete(ev)}
              onAddRegistration={() => setRegCtx({ ev, registration: null })}
              onEditRegistration={(reg) => setRegCtx({ ev, registration: reg })}
              onRemoveRegistration={(reg) => setToRemove(reg)}
              onAttendance={handleAttendance}
            />
          ))}
        </div>
      )}

      {showNew && <ClubEventDrawer onClose={() => setShowNew(false)} />}
      {editing && <ClubEventDrawer event={editing} onClose={() => setEditing(null)} />}
      {regCtx && (
        <EventRegistrationDrawer
          eventId={regCtx.ev.id}
          eventName={regCtx.ev.name}
          registration={regCtx.registration}
          eligibleMembers={eligibleMembers}
          takenMemberIds={(registrationsByEvent[regCtx.ev.id] ?? []).map((r) => r.memberId)}
          onClose={() => setRegCtx(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar evento"
        message={toDelete ? `¿Eliminar el evento "${toDelete.name}"? Sus inscripciones también se ocultan.` : ""}
        confirmLabel="Eliminar"
        danger
        pending={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!toRemove}
        title="Quitar inscripción"
        message={toRemove ? `¿Quitar a ${toRemove.memberName} de este evento?` : ""}
        confirmLabel="Quitar"
        danger
        pending={removing}
        onCancel={() => setToRemove(null)}
        onConfirm={handleRemoveReg}
      />
    </div>
  );
}

function EventCard({
  ev,
  registrations,
  flashClassFor,
  onEdit,
  onDelete,
  onAddRegistration,
  onEditRegistration,
  onRemoveRegistration,
  onAttendance,
}: {
  ev: ClubEvent;
  registrations: EventRegistration[];
  flashClassFor: (id: string | null | undefined) => string;
  onEdit: () => void;
  onDelete: () => void;
  onAddRegistration: () => void;
  onEditRegistration: (reg: EventRegistration) => void;
  onRemoveRegistration: (reg: EventRegistration) => void;
  onAttendance: (reg: EventRegistration, status: EventRegistrationStatus) => void;
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

      {/* Inscripciones (C.2) */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--s-2)",
          }}
        >
          <span className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
            Inscripciones ({registrations.length})
          </span>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-xs"
            onClick={onAddRegistration}
          >
            + Inscribir miembro
          </button>
        </div>

        {registrations.length === 0 ? (
          <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Sin inscritos todavía.
          </p>
        ) : (
          <table aria-label="Inscripciones del evento" style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {registrations.map((reg) => (
                <tr
                  key={reg.id}
                  data-row-id={reg.id}
                  className={flashClassFor(reg.id)}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "8px 6px" }}>
                    <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                      {reg.memberName}
                    </span>
                    {reg.note && (
                      <span
                        style={{
                          font: "500 11px/1.3 var(--f-sans)",
                          color: "var(--ink-soft)",
                          display: "block",
                          marginTop: 2,
                        }}
                      >
                        {reg.note}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "center" }}>
                    <Badge tone={eventRegistrationStatusTone(reg.status)} size="sm">
                      {eventRegistrationStatusLabel(reg.status)}
                    </Badge>
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <select
                      aria-label={`Asistencia de ${reg.memberName}`}
                      className="studio-input"
                      value={reg.status}
                      onChange={(e) => onAttendance(reg, e.target.value as EventRegistrationStatus)}
                      style={{ display: "inline-block", width: "auto", padding: "3px 6px", fontSize: 12 }}
                    >
                      {EVENT_REGISTRATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {eventRegistrationStatusLabel(s)}
                        </option>
                      ))}
                    </select>{" "}
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => onEditRegistration(reg)}
                    >
                      Editar
                    </button>{" "}
                    <button
                      type="button"
                      className="studio-btn studio-btn-danger studio-btn-xs"
                      onClick={() => onRemoveRegistration(reg)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

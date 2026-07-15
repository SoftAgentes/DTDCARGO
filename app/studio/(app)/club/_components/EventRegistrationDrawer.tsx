"use client";

/**
 * Drawer para inscribir/editar un miembro en un Evento del Club (SDD-0116, Slice
 * C.2). El inscrito es un miembro del Club (selector). Patrón espejo de
 * ParticipantDrawer.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Field, FormError } from "./Field";
import {
  EVENT_REGISTRATION_STATUSES,
  eventRegistrationStatusLabel,
  type EventRegistration,
  type EventRegistrationInput,
  type EventRegistrationStatus,
} from "@/lib/studio/club/club-event-registration-types";
import type { EligibleMember } from "@/lib/studio/club/group-buy-queries";
import {
  registerMemberToEventAction,
  updateEventRegistrationAction,
} from "../actions";

export function EventRegistrationDrawer({
  eventId,
  eventName,
  registration,
  eligibleMembers,
  takenMemberIds,
  onClose,
}: {
  eventId: string;
  eventName: string;
  registration?: EventRegistration | null;
  eligibleMembers: EligibleMember[];
  takenMemberIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!registration;

  const taken = new Set(takenMemberIds);
  const pickable = eligibleMembers.filter((m) => !taken.has(m.member_id));

  const [memberId, setMemberId] = useState(registration?.memberId ?? "");
  const [status, setStatus] = useState<EventRegistrationStatus>(registration?.status ?? "inscrito");
  const [note, setNote] = useState(registration?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = (isEdit || memberId.length > 0) && !pending;
  const noPickable = !isEdit && pickable.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);

    const payload: Partial<EventRegistrationInput> = {
      memberId: isEdit ? registration!.memberId : memberId,
      status,
      note: note.trim() || null,
    };

    const r = isEdit
      ? await updateEventRegistrationAction(registration!.id, payload)
      : await registerMemberToEventAction(eventId, payload);
    setPending(false);
    if (r.error) return setError(r.error);
    if (r.fieldErrors) return setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");

    toast.success(isEdit ? "Inscripción actualizada" : "Miembro inscrito en el evento");
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={isEdit ? "Editar inscripción" : "Inscribir miembro"}
      subtitle={eventName}
      onClose={onClose}
      pending={pending}
      width={480}
    >
      <form
        id="event-registration-form"
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {error && <FormError message={error} />}

        {isEdit ? (
          <div
            style={{
              padding: "10px 12px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {registration?.memberName}
            </div>
            <div style={{ font: "500 12px/1.4 var(--f-mono)", color: "var(--ink-soft)" }}>
              {registration?.memberNationalId ?? "Sin cédula"}
            </div>
          </div>
        ) : noPickable ? (
          <p style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            No hay miembros disponibles para inscribir. Da de alta miembros en la
            pestaña <strong>Miembros</strong> o revisa quiénes ya están inscritos.
          </p>
        ) : (
          <Field label="Miembro del Club">
            <select
              className="studio-input"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              autoFocus
            >
              <option value="">Selecciona un miembro…</option>
              {pickable.map((m) => (
                <option key={m.member_id} value={m.member_id}>
                  {m.person_name}
                  {m.national_id ? ` · ${m.national_id}` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!noPickable && (
          <>
            <Field label="Estado">
              <select
                className="studio-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as EventRegistrationStatus)}
              >
                {EVENT_REGISTRATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {eventRegistrationStatusLabel(s)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nota" optional>
              <textarea
                className="studio-input"
                rows={2}
                placeholder="Observaciones de la inscripción…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </Field>
          </>
        )}
      </form>

      <DrawerFooter
        formId="event-registration-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit && !noPickable}
        submitLabel={isEdit ? "Guardar" : "Inscribir"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

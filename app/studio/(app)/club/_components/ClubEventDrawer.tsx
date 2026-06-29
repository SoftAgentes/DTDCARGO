"use client";

/**
 * Drawer de alta/edición de un Evento del Club (SDD-0116, Slice C V1). El evento
 * vive en academy_cohorts con context='club' (D9). Sin inscripciones todavía
 * (diferidas). Patrón espejo de GroupBuyDrawer.
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
  CLUB_EVENT_MODALITIES,
  CLUB_EVENT_STATUSES,
  clubEventModalityLabel,
  clubEventStatusLabel,
  type ClubEvent,
  type ClubEventInput,
  type ClubEventModality,
  type ClubEventStatus,
} from "@/lib/studio/club/club-event-types";
import { createClubEventAction, updateClubEventAction } from "../actions";

export function ClubEventDrawer({
  event,
  onClose,
}: {
  event?: ClubEvent | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!event;

  const [name, setName] = useState(event?.name ?? "");
  const [summary, setSummary] = useState(event?.summary ?? "");
  const [modality, setModality] = useState<ClubEventModality>(event?.modality ?? "presencial");
  const [place, setPlace] = useState(event?.place ?? "");
  const [startsAt, setStartsAt] = useState(event?.startsAt ? event.startsAt.slice(0, 10) : "");
  const [facilitatorName, setFacilitatorName] = useState(event?.facilitatorName ?? "");
  const [status, setStatus] = useState<ClubEventStatus>(event?.status ?? "proximamente");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = name.trim().length > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);

    const payload: Partial<ClubEventInput> = {
      name: name.trim(),
      summary: summary.trim() || null,
      modality,
      place: place.trim() || null,
      startsAt: startsAt.trim() || null,
      facilitatorName: facilitatorName.trim() || null,
      status,
    };

    const r = isEdit
      ? await updateClubEventAction(event!.id, payload)
      : await createClubEventAction(payload);
    setPending(false);
    if (r.error) return setError(r.error);
    if (r.fieldErrors) return setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");

    toast.success(isEdit ? `Evento "${name.trim()}" actualizado` : `Evento "${name.trim()}" creado`);
    onClose();
    if (!isEdit && r.createdId) {
      router.push(`/studio/club?highlight=${r.createdId}&hl-tone=warm`);
    } else {
      router.refresh();
    }
  };

  return (
    <DrawerShell
      title={isEdit ? "Editar evento" : "Nuevo evento"}
      subtitle="Club DTD · evento de la comunidad"
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="club-event-form"
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

        <Field label="Nombre">
          <input
            className="studio-input"
            placeholder="Feria de importadores · Valencia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Resumen" optional>
          <textarea
            className="studio-input"
            rows={2}
            placeholder="De qué trata el evento, para quién…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Modalidad">
            <select
              className="studio-input"
              value={modality}
              onChange={(e) => setModality(e.target.value as ClubEventModality)}
            >
              {CLUB_EVENT_MODALITIES.map((m) => (
                <option key={m} value={m}>
                  {clubEventModalityLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha" optional>
            <input
              className="studio-input"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Lugar" optional>
          <input
            className="studio-input"
            placeholder="Sede DTD Valencia / enlace Zoom"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Facilitador" optional>
            <input
              className="studio-input"
              placeholder="Equipo DTD"
              value={facilitatorName}
              onChange={(e) => setFacilitatorName(e.target.value)}
            />
          </Field>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ClubEventStatus)}
            >
              {CLUB_EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {clubEventStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </form>

      <DrawerFooter
        formId="club-event-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={isEdit ? "Guardar cambios" : "Crear evento"}
        pendingLabel={isEdit ? "Guardando…" : "Creando…"}
      />
    </DrawerShell>
  );
}

"use client";

/**
 * Drawer de alta/edición de cohorte (SDD-0093, Slice B). Curso (opcional =
 * evento standalone), nombre, modalidad, sesiones, horas, lugar, fecha de inicio,
 * facilitador y estado. Patrón del Studio: <form id> en el cuerpo + submit en el
 * footer (DrawerFooter, HTML5; sin requestSubmit hack).
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
  COHORT_MODALITIES,
  COHORT_STATUSES,
  cohortStatusLabel,
  modalityLabel,
  type AcademyCohort,
  type CohortInput,
  type CohortModality,
  type CohortStatus,
} from "@/lib/studio/academia/types";
import type { CourseWithCounts } from "@/lib/studio/academia/types";
import { createCohortAction, updateCohortAction } from "../actions";

export function CohortDrawer({
  cohort,
  courses,
  onClose,
}: {
  cohort?: AcademyCohort;
  courses: CourseWithCounts[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!cohort;

  const [courseId, setCourseId] = useState(cohort?.course_id ?? "");
  const [name, setName] = useState(cohort?.name ?? "");
  const [modality, setModality] = useState<CohortModality>(cohort?.modality ?? "presencial");
  const [sessions, setSessions] = useState(
    cohort?.sessions != null ? String(cohort.sessions) : "1",
  );
  const [hours, setHours] = useState(cohort?.hours != null ? String(cohort.hours) : "");
  const [place, setPlace] = useState(cohort?.place ?? "");
  const [startsAt, setStartsAt] = useState(cohort?.starts_at ?? "");
  const [facilitator, setFacilitator] = useState(cohort?.facilitator_name ?? "");
  const [status, setStatus] = useState<CohortStatus>(cohort?.status ?? "proximamente");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = name.trim().length > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    const payload: Partial<CohortInput> = {
      courseId: courseId || null,
      name: name.trim(),
      modality,
      sessions: sessions.trim() === "" ? 1 : Number(sessions),
      hours: hours.trim() === "" ? null : Number(hours),
      place: place.trim() || null,
      startsAt: startsAt || null,
      facilitatorName: facilitator.trim() || null,
      status,
    };
    const r = editing
      ? await updateCohortAction(cohort!.id, payload)
      : await createCohortAction(payload);
    setPending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    if (r.fieldErrors) {
      setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
      return;
    }
    toast.success(editing ? `Cohorte actualizada` : `Cohorte creada`);
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={editing ? cohort!.name : "Nueva cohorte"}
      subtitle={
        editing
          ? `${modalityLabel(modality)} · ${sessions} sesiones`
          : "Cohorte en vivo · curso, facilitador y sesiones"
      }
      onClose={onClose}
      pending={pending}
      width={620}
    >
      <form
        id="cohort-form"
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

        <Field label="Curso" optional>
          <select
            className="studio-input"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">— Evento standalone (sin curso) —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nombre de la cohorte">
          <input
            className="studio-input"
            placeholder="Asesoría de Compras en China · Junio 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Modalidad">
            <select
              className="studio-input"
              value={modality}
              onChange={(e) => setModality(e.target.value as CohortModality)}
            >
              {COHORT_MODALITIES.map((m) => (
                <option key={m} value={m}>
                  {modalityLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sesiones">
            <input
              className="studio-input studio-input-mono"
              type="number"
              min={1}
              step={1}
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
            />
          </Field>
          <Field label="Horas" optional>
            <input
              className="studio-input studio-input-mono"
              type="number"
              min={0}
              step={1}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Inicio" optional>
            <input
              className="studio-input"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as CohortStatus)}
            >
              {COHORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {cohortStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Lugar" optional>
          <input
            className="studio-input"
            placeholder="Valencia, Venezuela · u Online (Zoom)"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </Field>

        <Field label="Facilitador" optional>
          <input
            className="studio-input"
            placeholder="Nombre del instructor"
            value={facilitator}
            onChange={(e) => setFacilitator(e.target.value)}
          />
        </Field>
      </form>

      <DrawerFooter
        formId="cohort-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear cohorte"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

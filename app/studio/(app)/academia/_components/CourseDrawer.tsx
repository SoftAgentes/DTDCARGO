"use client";

/**
 * Drawer de alta/edición de un CURSO del catálogo (SDD-0093, Feature A). El
 * Director (rol commercial) gestiona el contenido: título, slug (kebab,
 * autoderivado del título), tier, nivel, resumen y estado. El PRECIO no se toca
 * acá — vive en service_configs (Administración, gate por rol SDD-0085).
 *
 * Patrón del Studio: <form id> en el cuerpo + submit en el footer (DrawerFooter,
 * HTML5; sin requestSubmit hack). Solo tokens var(--*).
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
  COURSE_STATUSES,
  COURSE_TIERS,
  courseStatusLabel,
  slugify,
  tierLabel,
  type AcademyCourse,
  type CourseInput,
  type CourseStatus,
  type CourseTier,
} from "@/lib/studio/academia/types";
import { createCourseAction, updateCourseAction } from "../actions";

export function CourseDrawer({
  course,
  onClose,
}: {
  course?: AcademyCourse;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!course;

  const [title, setTitle] = useState(course?.title ?? "");
  const [slug, setSlug] = useState(course?.slug ?? "");
  // Si el slug está vacío y no es edición, lo seguimos derivando del título.
  const [slugTouched, setSlugTouched] = useState(editing);
  const [tier, setTier] = useState<CourseTier>(course?.tier ?? "inicial");
  const [level, setLevel] = useState(course?.level ?? "");
  const [summary, setSummary] = useState(course?.summary ?? "");
  const [status, setStatus] = useState<CourseStatus>(course?.status ?? "borrador");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const canSubmit = title.trim().length > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    const payload: Partial<CourseInput> = {
      title: title.trim(),
      slug: effectiveSlug.trim() || undefined,
      tier,
      level: level.trim() || null,
      summary: summary.trim() || null,
      status,
    };
    const r = editing
      ? await updateCourseAction(course!.id, payload)
      : await createCourseAction(payload);
    setPending(false);
    if (r.fieldErrors) {
      setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
      return;
    }
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(editing ? "Curso actualizado" : "Curso creado");
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={editing ? course!.title : "Nuevo curso"}
      subtitle={
        editing
          ? `${tierLabel(tier)} · ${courseStatusLabel(status)}`
          : "Catálogo on-demand · el precio se fija aparte (Administración)"
      }
      onClose={onClose}
      pending={pending}
      width={620}
    >
      <form
        id="course-form"
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

        <Field label="Título del curso">
          <input
            className="studio-input"
            placeholder="Domina Yiwu: De la Pantalla al Contenedor"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Slug (URL)">
          <input
            className="studio-input studio-input-mono"
            placeholder="domina-yiwu"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
          <span
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: "var(--s-1)",
              display: "block",
            }}
          >
            Solo minúsculas, números y guiones. Se deriva del título si lo dejas en blanco.
          </span>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Tier">
            <select
              className="studio-input"
              value={tier}
              onChange={(e) => setTier(e.target.value as CourseTier)}
            >
              {COURSE_TIERS.map((t) => (
                <option key={t} value={t}>
                  {tierLabel(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
            >
              {COURSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {courseStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Nivel" optional>
          <input
            className="studio-input"
            placeholder="Principiante · Intermedio · Avanzado"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </Field>

        <Field label="Resumen" optional>
          <textarea
            className="studio-input"
            rows={3}
            placeholder="Una línea que describe para quién es el curso y qué logra."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            style={{ resize: "vertical", minHeight: 64 }}
          />
        </Field>
      </form>

      <DrawerFooter
        formId="course-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear curso"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

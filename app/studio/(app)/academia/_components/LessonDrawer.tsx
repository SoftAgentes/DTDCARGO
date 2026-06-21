"use client";

/**
 * Drawer de alta/edición de una LECCIÓN (SDD-0093, Feature A · el más rico).
 * Módulo (select), tipo (video/texto/descarga/quiz), URL del video + duración,
 * preview gratis (checkbox), herramienta embebida (widget: Ninguna / Guía
 * Alibaba) y estado. El curso se hereda; el módulo se puede cambiar entre los
 * módulos del mismo curso. Patrón del Studio: <form id> + submit en el footer.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Field, FormError } from "@/app/studio/(app)/naviera/_components/SailingDrawer";
import {
  LESSON_KINDS,
  LESSON_STATUSES,
  LESSON_WIDGETS,
  lessonKindLabel,
  lessonStatusLabel,
  lessonWidgetLabel,
  type AcademyLesson,
  type AcademyModule,
  type LessonInput,
  type LessonKind,
  type LessonStatus,
  type LessonWidget,
} from "@/lib/studio/academia/types";
import { createLessonAction, updateLessonAction } from "../actions";

export function LessonDrawer({
  courseId,
  modules,
  lesson,
  defaultModuleId,
  defaultSort,
  onClose,
}: {
  courseId: string;
  /** Módulos del curso (para mover/elegir el módulo de la lección). */
  modules: AcademyModule[];
  lesson?: AcademyLesson;
  defaultModuleId?: string;
  defaultSort?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!lesson;

  const [moduleId, setModuleId] = useState(
    lesson?.module_id ?? defaultModuleId ?? modules[0]?.id ?? "",
  );
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [kind, setKind] = useState<LessonKind>(lesson?.kind ?? "video");
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url ?? "");
  const [durationMin, setDurationMin] = useState(
    lesson?.duration_min != null ? String(lesson.duration_min) : "",
  );
  const [freePreview, setFreePreview] = useState(lesson?.free_preview ?? false);
  const [widget, setWidget] = useState<LessonWidget | "">(lesson?.widget ?? "");
  const [status, setStatus] = useState<LessonStatus>(lesson?.status ?? "borrador");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = title.trim().length > 0 && moduleId.length > 0 && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    const payload: Partial<LessonInput> = {
      moduleId,
      courseId,
      title: title.trim(),
      kind,
      videoUrl: videoUrl.trim() || null,
      durationMin: durationMin.trim() === "" ? null : Number(durationMin),
      freePreview,
      widget: widget === "" ? null : widget,
      status,
      sort: lesson?.sort ?? defaultSort ?? 0,
    };
    const r = editing
      ? await updateLessonAction(lesson!.id, payload)
      : await createLessonAction(payload);
    setPending(false);
    if (r.fieldErrors) {
      setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");
      return;
    }
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success(editing ? "Lección actualizada" : "Lección creada");
    onClose();
    router.refresh();
  };

  return (
    <DrawerShell
      title={editing ? lesson!.title : "Nueva lección"}
      subtitle={`${lessonKindLabel(kind)} · ${lessonStatusLabel(status)}`}
      onClose={onClose}
      pending={pending}
      width={620}
    >
      <form
        id="lesson-form"
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

        <Field label="Módulo">
          <select
            className="studio-input"
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
          >
            {modules.length === 0 && <option value="">— sin módulos —</option>}
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Título de la lección">
          <input
            className="studio-input"
            placeholder="Cómo leer una ficha de producto en 1688"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Tipo">
            <select
              className="studio-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as LessonKind)}
            >
              {LESSON_KINDS.map((k) => (
                <option key={k} value={k}>
                  {lessonKindLabel(k)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duración (min)" optional>
            <input
              className="studio-input studio-input-mono"
              type="number"
              min={0}
              step={1}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </Field>
        </div>

        <Field label="URL del video" optional>
          <input
            className="studio-input"
            type="url"
            placeholder="https://… (YouTube, Vimeo, etc.)"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Herramienta embebida" optional>
            <select
              className="studio-input"
              value={widget}
              onChange={(e) => setWidget(e.target.value as LessonWidget | "")}
            >
              <option value="">{lessonWidgetLabel(null)}</option>
              {LESSON_WIDGETS.map((w) => (
                <option key={w} value={w}>
                  {lessonWidgetLabel(w)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as LessonStatus)}
            >
              {LESSON_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {lessonStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            font: "500 13px/1.4 var(--f-sans)",
            color: "var(--ink)",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <input
            type="checkbox"
            checked={freePreview}
            onChange={(e) => setFreePreview(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--wine)" }}
          />
          Preview gratis (visible sin compra)
        </label>
      </form>

      <DrawerFooter
        formId="lesson-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear lección"}
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

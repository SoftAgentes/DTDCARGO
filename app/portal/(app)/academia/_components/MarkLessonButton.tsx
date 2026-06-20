"use client";

/**
 * Botón "Marcar como completada" del reproductor (SDD-0093, Slice D.2).
 * Optimista: refleja el nuevo estado al instante y llama a la server action; ante
 * error, revierte y muestra el motivo. La action revalida → el server component
 * recalcula el progreso.
 */

import { useState, useTransition } from "react";
import { setLessonComplete } from "../actions";
import { IconCheck } from "./icons";

export function MarkLessonButton({
  courseId,
  lessonId,
  initialDone,
}: {
  courseId: string;
  lessonId: string;
  initialDone: boolean;
}) {
  const [done, setDone] = useState(initialDone);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !done;
    setError(null);
    setDone(next); // optimista
    startTransition(async () => {
      const res = await setLessonComplete(courseId, lessonId, next);
      if (!res.ok) {
        setDone(!next); // revertir
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={done}
        className={`${done ? "btn btn-ghost" : "btn btn-primary"} text-sm disabled:opacity-60`}
      >
        {pending ? (
          "Guardando…"
        ) : done ? (
          <span className="inline-flex items-center gap-1.5">
            <IconCheck className="w-3.5 h-3.5" /> Lección completada
          </span>
        ) : (
          "Marcar como completada"
        )}
      </button>
      {error ? (
        <p role="alert" className="text-[13px] text-status-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

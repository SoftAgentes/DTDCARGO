/**
 * Portal · Academia · Detalle de curso (SDD-0093, Slice D.2).
 *
 * Server component: módulos → lecciones (acordeón nativo <details>, accesible sin
 * JS), progreso derivado y CTA "Continuar". Scope por client_markbox vía la query.
 * Pensado para cursos donde el cliente está inscrito ("Mis cursos").
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getPortalCourseDetail, tierLabel, type PortalCourseLesson } from "@/lib/portal/portal-academy-queries";
import { IconCheck, IconLock, IconChevron } from "../_components/icons";

export const metadata = { title: "Curso · Academia · DTD Cargo" };

export default async function PortalCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const detail = await getPortalCourseDetail(supabase, courseId);
  if (!detail) notFound();

  const { course, progress, modules, nextLessonId } = detail;
  const lessonCount = modules.reduce((a, m) => a + m.lessons.length, 0);
  const pct = Math.min(100, Math.max(0, progress.pct));

  return (
    <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto flex flex-col gap-6">
      <Link href="/portal/academia" className="text-[13px] font-semibold text-grey-500 hover:text-ink">
        ← Volver a la Academia
      </Link>

      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-wine">
          {tierLabel(course.tier)}
        </span>
        <h1 className="text-2xl font-extrabold text-ink leading-tight">{course.title}</h1>
        {course.summary ? <p className="text-sm text-grey-500 max-w-prose">{course.summary}</p> : null}
        <p className="text-[12px] font-semibold text-grey-500">
          {modules.length} módulos · {lessonCount} lecciones
        </p>

        {lessonCount > 0 ? (
          <div className="flex flex-col gap-1 mt-1">
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progreso del curso: ${pct}%`}
              className="h-2 w-full rounded-full bg-grey-100 overflow-hidden"
            >
              <div className="h-full rounded-full bg-wine" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-grey-500">
              {progress.done} de {progress.total} lecciones · <span className="text-ink">{pct}%</span>
            </span>
          </div>
        ) : null}

        {nextLessonId ? (
          <Link
            href={`/portal/academia/${course.id}/${nextLessonId}`}
            className="btn btn-primary text-sm self-start mt-1"
          >
            {progress.completed ? "Repasar el curso" : progress.done > 0 ? "Continuar donde quedaste" : "Empezar curso"}
          </Link>
        ) : null}
      </header>

      {lessonCount === 0 ? (
        <section className="rounded-xl border border-dashed border-grey-200 bg-white p-6 text-center">
          <p className="text-sm text-grey-500">
            Estamos preparando las lecciones de este curso. Muy pronto las verás aquí.
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-grey-500">Contenido</h2>
          {modules.map((m, mi) => (
            <details
              key={m.id}
              open
              className="group rounded-xl border border-grey-200 bg-white overflow-hidden"
            >
              <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-grey-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink">
                <span className="flex-shrink-0 w-6 h-6 grid place-items-center rounded-md bg-grey-100 text-[11px] font-bold text-grey-500">
                  {mi + 1}
                </span>
                <span className="flex-1 text-sm font-bold text-ink">{m.title}</span>
                <span className="text-[11px] text-grey-500">{m.lessons.length} lec.</span>
                <IconChevron className="w-4 h-4 text-grey-500 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="border-t border-grey-200">
                {m.lessons.map((l) => (
                  <li key={l.id} className="border-t border-grey-200 first:border-t-0">
                    <LessonRow courseId={course.id} lesson={l} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}

function LessonRow({ courseId, lesson }: { courseId: string; lesson: PortalCourseLesson }) {
  const inner = (
    <>
      <span
        aria-hidden
        className={`flex-shrink-0 w-5 h-5 rounded-full grid place-items-center ${
          lesson.done
            ? "bg-status-success text-[color:var(--color-on-accent)]"
            : "border border-grey-200 text-grey-500"
        }`}
      >
        {lesson.done ? <IconCheck className="w-3 h-3" /> : null}
      </span>
      <span className="flex-1 min-w-0 text-[13px] font-medium text-ink truncate">
        {lesson.done ? <span className="sr-only">Completada · </span> : null}
        {lesson.title}
      </span>
      {lesson.widget === "alibaba_address" ? (
        <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-wine bg-grey-100 px-1.5 py-0.5 rounded">
          Herramienta
        </span>
      ) : null}
      {lesson.freePreview ? (
        <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-status-success bg-grey-100 px-1.5 py-0.5 rounded">
          Preview
        </span>
      ) : null}
      {lesson.durationMin ? (
        <span className="flex-shrink-0 font-mono text-[11px] text-grey-500">{lesson.durationMin}m</span>
      ) : null}
    </>
  );

  if (lesson.locked) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 opacity-55" aria-disabled>
        {inner}
        <IconLock className="flex-shrink-0 w-3.5 h-3.5 text-grey-500" />
      </div>
    );
  }
  return (
    <Link
      href={`/portal/academia/${courseId}/${lesson.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-grey-100 transition-colors"
    >
      {inner}
    </Link>
  );
}

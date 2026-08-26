/**
 * Portal · Academia · Reproductor de lección (SDD-0093, Slice D.2).
 *
 * Server component: la lección (video o placeholder), botón de completar
 * (client), navegación anterior/siguiente, índice del curso y, según el `widget`
 * de la lección, una herramienta embebida:
 *
 *   alibaba_address (migr 0149) → sólo la dirección de la bodega de Yiwu, campo
 *                                 por campo, con el MARKBOX del alumno.
 *   alibaba_curso   (migr 0393) → la guía interactiva COMPLETA de compra en
 *                                 Alibaba: 9 etapas, calculadoras y avance.
 *
 * Los dos componentes son públicos (`components/`, sólo design-tokens) → el
 * portal puede importarlos, y los dos reciben el MARKBOX que el portal ya
 * conoce en vez de hacérselo transcribir al alumno.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getPortalLesson } from "@/lib/portal/portal-academy-queries";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { AlibabaAddressGuide } from "@/components/AlibabaAddressGuide";
import { AlibabaCursoGuide } from "@/components/AlibabaCursoGuide";
import { MarkLessonButton } from "../../_components/MarkLessonButton";
import { IconCheck, IconChevron } from "../../_components/icons";

export const metadata = { title: "Lección · Academia · DTD Cargo" };

export default async function PortalLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();
  const view = await getPortalLesson(supabase, courseId, lessonId);
  if (!view) notFound();

  // El portal YA conoce el Shipping Mark del cliente: se lo pasamos al widget en
  // vez de hacerle transcribir a mano un dato nuestro. Es el mismo patron que
  // /portal/proveedores (SuppliersClient), que si lo hacia.
  const client = await getPortalClient(supabase).catch(() => null);

  const { course, lesson, lessons, idx, prevId, nextId } = view;

  return (
    <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto flex flex-col gap-5">
      <Link
        href={`/portal/academia/${course.id}`}
        className="text-[13px] font-semibold text-grey-500 hover:text-ink"
      >
        ← {course.title}
      </Link>

      {/* Video o placeholder (16:9). El placeholder NO se pinta cuando la lección
          trae una herramienta: ahí el contenido es el widget, y una caja negra
          diciendo "video pronto" encima leía como que faltaba algo. */}
      {lesson.videoUrl || !lesson.widget ? (
        <div className="rounded-xl overflow-hidden bg-ink aspect-video grid place-items-center">
          {lesson.videoUrl ? (
            <iframe
              src={lesson.videoUrl}
              title={lesson.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <p className="text-[13px] text-white/85 px-6 text-center">
              El video de esta lección estará disponible pronto.
            </p>
          )}
        </div>
      ) : null}

      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-wine-text">
          Lección {idx + 1} de {lessons.length}
        </span>
        <h1 className="text-xl font-extrabold text-ink leading-snug">{lesson.title}</h1>
        {lesson.durationMin ? (
          <span className="font-mono text-[12px] text-grey-500">{lesson.durationMin} min</span>
        ) : null}
      </header>

      <MarkLessonButton courseId={course.id} lessonId={lesson.id} initialDone={lesson.done} />

      {/* Integración aprobada: guía de dirección Alibaba/1688 embebida en la lección */}
      {lesson.widget === "alibaba_address" ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-grey-500">
            Tu dirección para Alibaba / 1688
          </h2>
          <p className="text-[13px] text-grey-500 max-w-prose">
            Esta es la dirección de la bodega de DTD en Yiwu. Escribe tu Shipping Mark y copia cada campo en el
            formulario de tu proveedor — el chino se pega tal cual.
          </p>
          <AlibabaAddressGuide markbox={client?.markbox ?? undefined} />
        </section>
      ) : lesson.widget === "alibaba_curso" ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-grey-500">
            Guía interactiva: comprar en Alibaba paso a paso
          </h2>
          <p className="text-[13px] text-grey-500 max-w-prose">
            Nueve etapas, de crear tu cuenta a tener la mercancía en nuestra bodega de Yiwu. Tu
            Shipping Mark ya va cargado y tu avance se guarda solo — puedes salir y volver.
          </p>
          <AlibabaCursoGuide markbox={client?.markbox ?? undefined} />
        </section>
      ) : null}

      {/* Anterior / Siguiente */}
      <nav className="grid grid-cols-2 gap-3" aria-label="Navegación de lecciones">
        {prevId ? (
          <Link href={`/portal/academia/${course.id}/${prevId}`} className="btn btn-ghost text-sm">
            ← Anterior
          </Link>
        ) : (
          <span className="btn btn-ghost text-sm opacity-45 pointer-events-none" aria-disabled="true">
            ← Anterior
          </span>
        )}
        {nextId ? (
          <Link href={`/portal/academia/${course.id}/${nextId}`} className="btn btn-ghost text-sm">
            Siguiente →
          </Link>
        ) : (
          <Link href={`/portal/academia/${course.id}`} className="btn btn-ghost text-sm">
            Terminar →
          </Link>
        )}
      </nav>

      {/* Índice del curso */}
      <details className="group rounded-xl border border-grey-200 bg-white overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none text-sm font-bold text-ink list-none [&::-webkit-details-marker]:hidden hover:bg-grey-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink">
          Todas las lecciones
          <IconChevron className="w-4 h-4 text-grey-500 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="border-t border-grey-200">
          {lessons.map((ll, i) => {
            const current = ll.id === lesson.id;
            return (
              <li key={ll.id} className="border-t border-grey-200 first:border-t-0">
                <Link
                  href={`/portal/academia/${course.id}/${ll.id}`}
                  aria-current={current ? "true" : undefined}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-grey-100 transition-colors ${
                    current ? "bg-grey-100" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex-shrink-0 w-5 h-5 rounded-full grid place-items-center text-[11px] ${
                      ll.done ? "bg-status-success text-[color:var(--color-on-accent)]" : "border border-grey-200 text-grey-500"
                    }`}
                  >
                    {ll.done ? <IconCheck className="w-3 h-3" /> : i + 1}
                  </span>
                  <span
                    className={`flex-1 min-w-0 truncate text-[13px] ${
                      current ? "font-bold text-wine-text" : "font-medium text-ink"
                    }`}
                  >
                    {ll.done ? <span className="sr-only">Completada · </span> : null}
                    {ll.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

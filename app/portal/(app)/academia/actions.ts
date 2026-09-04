"use server";

/**
 * Server actions del Portal · Academia (SDD-0093, Slice D.2). El alumno marca /
 * desmarca una lección como completada. El progreso del curso se DERIVA de estas
 * filas (ver portal-academy-queries) — acá solo se toca `academy_lesson_progress`,
 * nunca `academy_enrollments` (sin UPDATE forjable → sin BOLA).
 *
 * Aislamiento: principal Portal coherente + filtros explícitos por tenant y
 * Shipping Mark. La RLS de 0149/0418 y la inscripción son defensas adicionales.
 * Completar = upsert idempotente; descompletar = delete.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createComponentLogger } from "@/lib/observability/structured-logger";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";

export type LessonToggleResult =
  | { ok: true; done: boolean }
  | { ok: false; error: string };

export async function setLessonComplete(
  courseId: string,
  lessonId: string,
  done: boolean,
): Promise<LessonToggleResult> {
  if (!courseId || !lessonId) return { ok: false, error: "Datos incompletos." };
  const logger = createComponentLogger("portal.academy.lesson-progress");

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  }
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  const { tenantId } = principal;
  const markbox = principal.client.markbox;

  // Defensa en profundidad: solo cuenta progreso de cursos donde está inscrito.
  const { data: enr } = await supabase
    .from("academy_enrollments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("course_id", courseId)
    .eq("client_markbox", markbox)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!enr) return { ok: false, error: "No estás inscrito en este curso." };

  if (done) {
    const { error } = await supabase.from("academy_lesson_progress").upsert(
      {
        tenant_id: tenantId,
        client_markbox: markbox,
        course_id: courseId,
        lesson_id: lessonId,
      },
      { onConflict: "client_markbox,lesson_id", ignoreDuplicates: true },
    );
    if (error) {
      logger.error("portal_academy.progress_failed", {
        error,
        operation: "complete",
        stage: "write",
      });
      return { ok: false, error: "No pudimos guardar tu progreso." };
    }
  } else {
    const { error } = await supabase
      .from("academy_lesson_progress")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("client_markbox", markbox)
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId);
    if (error) {
      logger.error("portal_academy.progress_failed", {
        error,
        operation: "uncomplete",
        stage: "write",
      });
      return { ok: false, error: "No pudimos actualizar tu progreso." };
    }
  }

  revalidatePath("/portal/academia");
  revalidatePath(`/portal/academia/${courseId}`);
  revalidatePath(`/portal/academia/${courseId}/${lessonId}`);
  return { ok: true, done };
}

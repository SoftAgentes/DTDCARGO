"use server";

/**
 * Server actions del Portal · Academia (SDD-0093, Slice D.2). El alumno marca /
 * desmarca una lección como completada. El progreso del curso se DERIVA de estas
 * filas (ver portal-academy-queries) — acá solo se toca `academy_lesson_progress`,
 * nunca `academy_enrollments` (sin UPDATE forjable → sin BOLA).
 *
 * Aislamiento (SDD-0549): tenant + Shipping Mark del principal Portal de la
 * sesión (`getPortalClientPrincipal`), resueltos UNA vez y sin las RPC
 * `get_portal_client_markbox()` / `get_portal_client_tenant()`. Cada lectura y
 * escritura filtra por los dos: el Shipping Mark es único POR tenant. La RLS de
 * 0418 exige pertenencia por principal y tenant; además exigimos inscripción
 * (defensa en profundidad). Completar = upsert idempotente; descompletar =
 * delete.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
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

  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  const { tenantId } = principal;
  const { markbox } = principal.client;

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
      console.error("[setLessonComplete] upsert error:", error);
      return { ok: false, error: "No pudimos guardar tu progreso." };
    }
  } else {
    const { error } = await supabase
      .from("academy_lesson_progress")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("client_markbox", markbox)
      .eq("lesson_id", lessonId);
    if (error) {
      console.error("[setLessonComplete] delete error:", error);
      return { ok: false, error: "No pudimos actualizar tu progreso." };
    }
  }

  revalidatePath("/portal/academia");
  revalidatePath(`/portal/academia/${courseId}`);
  revalidatePath(`/portal/academia/${courseId}/${lessonId}`);
  return { ok: true, done };
}

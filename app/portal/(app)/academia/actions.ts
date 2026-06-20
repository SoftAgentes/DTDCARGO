"use server";

/**
 * Server actions del Portal · Academia (SDD-0093, Slice D.2). El alumno marca /
 * desmarca una lección como completada. El progreso del curso se DERIVA de estas
 * filas (ver portal-academy-queries) — acá solo se toca `academy_lesson_progress`,
 * nunca `academy_enrollments` (sin UPDATE forjable → sin BOLA).
 *
 * Aislamiento: MARKBOX del cliente vía `get_portal_client_markbox()` + tenant vía
 * `get_portal_client_tenant()` (igual que proveedores/compras). La RLS de 0149
 * exige pertenencia por markbox; además exigimos inscripción (defensa en
 * profundidad). Completar = upsert idempotente; descompletar = delete.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export type LessonToggleResult =
  | { ok: true; done: boolean }
  | { ok: false; error: string };

/** MARKBOX del cliente del portal logueado, o null. */
async function portalMarkbox(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_portal_client_markbox");
  if (error || !data) return null;
  return String(data);
}

export async function setLessonComplete(
  courseId: string,
  lessonId: string,
  done: boolean,
): Promise<LessonToggleResult> {
  if (!courseId || !lessonId) return { ok: false, error: "Datos incompletos." };

  const supabase = await createClient();
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };

  // Defensa en profundidad: solo cuenta progreso de cursos donde está inscrito.
  const { data: enr } = await supabase
    .from("academy_enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("client_markbox", markbox)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!enr) return { ok: false, error: "No estás inscrito en este curso." };

  if (done) {
    const { data: tenantData } = await supabase.rpc("get_portal_client_tenant");
    const tenantId = tenantData ? String(tenantData) : null;
    if (!tenantId) return { ok: false, error: "No pudimos resolver tu cuenta." };

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

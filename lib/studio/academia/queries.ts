/**
 * Queries de lectura de la Academia DTD (SDD-0093). Funciones puras que reciben
 * un SupabaseClient (RLS scope-a por tenant). Devuelven [] / null ante error
 * (no lanzan) — patrón de los demás módulos del Studio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcademyCourse,
  AcademyLesson,
  AcademiaStats,
  CourseTree,
  CourseWithCounts,
  ModuleWithLessons,
} from "@/lib/studio/academia/types";

/** Catálogo de cursos + conteo de módulos y lecciones (vivos). */
export async function listCoursesWithCounts(supabase: SupabaseClient): Promise<CourseWithCounts[]> {
  const [coursesRes, modulesRes, lessonsRes] = await Promise.all([
    supabase
      .from("academy_courses")
      .select("id, tenant_id, slug, title, tier, summary, level, service_key, status, sort, cover_path, created_at, updated_at")
      .is("deleted_at", null)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("academy_modules").select("id, course_id").is("deleted_at", null),
    supabase.from("academy_lessons").select("id, course_id").is("deleted_at", null),
  ]);

  const courses = (coursesRes.data ?? []) as AcademyCourse[];
  const modules = (modulesRes.data ?? []) as { id: string; course_id: string }[];
  const lessons = (lessonsRes.data ?? []) as { id: string; course_id: string }[];

  const modCount = new Map<string, number>();
  for (const m of modules) modCount.set(m.course_id, (modCount.get(m.course_id) ?? 0) + 1);
  const lesCount = new Map<string, number>();
  for (const l of lessons) lesCount.set(l.course_id, (lesCount.get(l.course_id) ?? 0) + 1);

  return courses.map((c) => ({
    ...c,
    modules_count: modCount.get(c.id) ?? 0,
    lessons_count: lesCount.get(c.id) ?? 0,
  }));
}

/** Detalle de un curso: módulos con sus lecciones, ordenados. */
export async function getCourseTree(supabase: SupabaseClient, courseId: string): Promise<CourseTree | null> {
  const { data: course } = await supabase
    .from("academy_courses")
    .select("id, tenant_id, slug, title, tier, summary, level, service_key, status, sort, cover_path, created_at, updated_at")
    .eq("id", courseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!course) return null;

  const [modulesRes, lessonsRes] = await Promise.all([
    supabase
      .from("academy_modules")
      .select("id, tenant_id, course_id, title, sort")
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
    supabase
      .from("academy_lessons")
      .select("id, tenant_id, module_id, course_id, title, sort, kind, video_url, asset_path, duration_min, free_preview, status")
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
  ]);

  const lessons = (lessonsRes.data ?? []) as AcademyLesson[];
  const byModule = new Map<string, AcademyLesson[]>();
  for (const l of lessons) {
    const arr = byModule.get(l.module_id) ?? [];
    arr.push(l);
    byModule.set(l.module_id, arr);
  }

  const modules: ModuleWithLessons[] = ((modulesRes.data ?? []) as ModuleWithLessons[]).map((m) => ({
    ...m,
    lessons: byModule.get(m.id) ?? [],
  }));

  return { ...(course as AcademyCourse), modules };
}

/** KPIs del módulo. */
export async function academiaStats(supabase: SupabaseClient): Promise<AcademiaStats> {
  const live = { count: "exact" as const, head: true };
  const [cursos, publicados, proximamente, cohortes, alumnos] = await Promise.all([
    supabase.from("academy_courses").select("id", live).is("deleted_at", null),
    supabase.from("academy_courses").select("id", live).eq("status", "publicado").is("deleted_at", null),
    supabase.from("academy_courses").select("id", live).eq("status", "proximamente").is("deleted_at", null),
    supabase.from("academy_cohorts").select("id", live).is("deleted_at", null),
    supabase.from("academy_enrollments").select("id", live).is("deleted_at", null),
  ]);

  return {
    cursos: cursos.count ?? 0,
    publicados: publicados.count ?? 0,
    proximamente: proximamente.count ?? 0,
    cohortes: cohortes.count ?? 0,
    alumnos: alumnos.count ?? 0,
  };
}

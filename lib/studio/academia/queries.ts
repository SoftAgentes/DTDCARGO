/**
 * Queries de lectura de la Academia DTD (SDD-0093). Funciones puras que reciben
 * un SupabaseClient (RLS scope-a por tenant). Devuelven [] / null ante error
 * (no lanzan) — patrón de los demás módulos del Studio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countAttended,
  attendanceRatio,
  isApproved,
  type AcademyCohort,
  type AcademyCourse,
  type AcademyDiploma,
  type AcademyEnrollment,
  type AcademyLesson,
  type AcademiaStats,
  type CohortDetail,
  type CohortWithCounts,
  type CourseTree,
  type CourseWithCounts,
  type ModuleWithLessons,
  type RosterRow,
} from "@/lib/studio/academia/types";

const COURSE_COLS =
  "id, tenant_id, slug, title, tier, summary, level, service_key, status, sort, cover_path, created_at, updated_at";
const LESSON_COLS =
  "id, tenant_id, module_id, course_id, title, sort, kind, video_url, asset_path, duration_min, free_preview, status, widget";

const COHORT_COLS =
  "id, tenant_id, course_id, name, hours, sessions, modality, place, starts_at, facilitator_name, status, created_at, updated_at";
const ENROLLMENT_COLS =
  "id, tenant_id, course_id, cohort_id, client_markbox, student_name, student_ci, student_email, progress_pct, completed_at, created_at";

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

/**
 * Detalle de un curso: módulos con sus lecciones, ordenados. Incluye TODAS las
 * lecciones vivas (incl. borrador) — es la vista de EDICIÓN del Director, no la
 * pública del portal. `getCourseEditorTree` es el alias semántico para el editor.
 */
export async function getCourseTree(supabase: SupabaseClient, courseId: string): Promise<CourseTree | null> {
  const { data: course } = await supabase
    .from("academy_courses")
    .select(COURSE_COLS)
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
      .select(LESSON_COLS)
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .order("sort", { ascending: true })
      .order("title", { ascending: true }),
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

/**
 * Árbol de un curso para el EDITOR (Feature A): curso + módulos (ordenados) +
 * lecciones por módulo, incluyendo borradores (es la vista de edición del
 * Director). Alias explícito de `getCourseTree` para no acoplar el editor a la
 * vista de lectura — si mañana la pública filtra `status='publicado'`, el editor
 * sigue viendo todo.
 */
export async function getCourseEditorTree(
  supabase: SupabaseClient,
  courseId: string,
): Promise<CourseTree | null> {
  return getCourseTree(supabase, courseId);
}

/** KPIs del módulo (Slice A + Slice B). */
export async function academiaStats(supabase: SupabaseClient): Promise<AcademiaStats> {
  const live = { count: "exact" as const, head: true };
  const [cursos, publicados, proximamente, cohortes, enCurso, alumnos, ready] =
    await Promise.all([
      supabase.from("academy_courses").select("id", live).is("deleted_at", null),
      supabase.from("academy_courses").select("id", live).eq("status", "publicado").is("deleted_at", null),
      supabase.from("academy_courses").select("id", live).eq("status", "proximamente").is("deleted_at", null),
      supabase.from("academy_cohorts").select("id", live).is("deleted_at", null),
      supabase.from("academy_cohorts").select("id", live).eq("status", "en_curso").is("deleted_at", null),
      supabase.from("academy_enrollments").select("id", live).is("deleted_at", null),
      countDiplomasReady(supabase),
    ]);

  return {
    cursos: cursos.count ?? 0,
    publicados: publicados.count ?? 0,
    proximamente: proximamente.count ?? 0,
    cohortes: cohortes.count ?? 0,
    enCurso: enCurso.count ?? 0,
    alumnos: alumnos.count ?? 0,
    diplomasListos: ready,
  };
}

/**
 * Cuenta inscritos aprobados (≥75% de asistencia sobre las sesiones de SU cohorte)
 * que todavía NO tienen diploma. Recorre cohortes → inscritos → asistencia.
 * RLS scope-a por tenant. Devuelve 0 ante cualquier error.
 */
async function countDiplomasReady(supabase: SupabaseClient): Promise<number> {
  const [cohortsRes, enrollRes, attRes, dipRes] = await Promise.all([
    supabase.from("academy_cohorts").select("id, sessions").is("deleted_at", null),
    supabase
      .from("academy_enrollments")
      .select("id, cohort_id")
      .not("cohort_id", "is", null)
      .is("deleted_at", null),
    supabase.from("academy_attendance").select("enrollment_id, attended"),
    supabase.from("academy_diplomas").select("enrollment_id").is("deleted_at", null),
  ]);

  const sessionsByCohort = new Map<string, number>();
  for (const c of (cohortsRes.data ?? []) as { id: string; sessions: number }[]) {
    sessionsByCohort.set(c.id, Number(c.sessions) || 0);
  }
  const attByEnrollment = new Map<string, number>();
  for (const a of (attRes.data ?? []) as { enrollment_id: string; attended: boolean }[]) {
    if (a.attended) attByEnrollment.set(a.enrollment_id, (attByEnrollment.get(a.enrollment_id) ?? 0) + 1);
  }
  const withDiploma = new Set<string>();
  for (const d of (dipRes.data ?? []) as { enrollment_id: string | null }[]) {
    if (d.enrollment_id) withDiploma.add(d.enrollment_id);
  }

  let ready = 0;
  for (const e of (enrollRes.data ?? []) as { id: string; cohort_id: string | null }[]) {
    if (!e.cohort_id || withDiploma.has(e.id)) continue;
    const sessions = sessionsByCohort.get(e.cohort_id) ?? 0;
    if (isApproved(attByEnrollment.get(e.id) ?? 0, sessions)) ready += 1;
  }
  return ready;
}

/**
 * Detalle COMPLETO de todas las cohortes en una sola pasada (cohorte + curso +
 * roster con asistencia derivada). Para la pestaña Cohortes (detalle inline,
 * patrón de NavieraClient que precarga `ConsolidationDetail[]`). Evita N+1: lee
 * cohortes, cursos, inscritos, asistencia y diplomas una vez y arma todo en memoria.
 */
export async function listCohortDetails(supabase: SupabaseClient): Promise<CohortDetail[]> {
  const [cohortsRes, coursesRes, enrollRes, attRes, dipRes] = await Promise.all([
    supabase
      .from("academy_cohorts")
      .select(COHORT_COLS)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("academy_courses").select("id, title").is("deleted_at", null),
    supabase
      .from("academy_enrollments")
      .select(ENROLLMENT_COLS)
      .not("cohort_id", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("academy_attendance").select("enrollment_id, cohort_id, session_num, attended"),
    supabase
      .from("academy_diplomas")
      .select("enrollment_id")
      .not("enrollment_id", "is", null)
      .is("deleted_at", null),
  ]);

  const cohorts = (cohortsRes.data ?? []) as AcademyCohort[];
  const titleById = new Map<string, string>();
  for (const c of (coursesRes.data ?? []) as { id: string; title: string }[]) {
    titleById.set(c.id, c.title);
  }

  const enrollByCohort = new Map<string, AcademyEnrollment[]>();
  for (const e of (enrollRes.data ?? []) as AcademyEnrollment[]) {
    if (!e.cohort_id) continue;
    const arr = enrollByCohort.get(e.cohort_id) ?? [];
    arr.push(e);
    enrollByCohort.set(e.cohort_id, arr);
  }

  const attendedByEnrollment = new Map<string, Set<number>>();
  for (const a of (attRes.data ?? []) as {
    enrollment_id: string;
    session_num: number;
    attended: boolean;
  }[]) {
    if (!a.attended) continue;
    const set = attendedByEnrollment.get(a.enrollment_id) ?? new Set<number>();
    set.add(Number(a.session_num));
    attendedByEnrollment.set(a.enrollment_id, set);
  }

  const withDiploma = new Set<string>();
  for (const d of (dipRes.data ?? []) as { enrollment_id: string | null }[]) {
    if (d.enrollment_id) withDiploma.add(d.enrollment_id);
  }

  return cohorts.map((c) => {
    const sessions = Number(c.sessions) || 0;
    let readyToEmit = 0;
    const roster: RosterRow[] = (enrollByCohort.get(c.id) ?? []).map((e) => {
      const set = attendedByEnrollment.get(e.id) ?? new Set<number>();
      const arr: boolean[] = Array.from({ length: sessions }, (_, i) => set.has(i + 1));
      const attendedCount = countAttended(arr);
      const ratio = attendanceRatio(attendedCount, sessions);
      const approved = isApproved(attendedCount, sessions);
      const hasDiploma = withDiploma.has(e.id);
      if (approved && !hasDiploma) readyToEmit += 1;
      return { enrollment: e, attended: arr, attendedCount, ratio, approved, hasDiploma };
    });
    return {
      cohort: c,
      course_title: c.course_id ? titleById.get(c.course_id) ?? null : null,
      roster,
      readyToEmit,
    };
  });
}

/** Cohortes + curso (denorm) + #inscritos, para la pestaña Cohortes. */
export async function listCohorts(supabase: SupabaseClient): Promise<CohortWithCounts[]> {
  const [cohortsRes, coursesRes, enrollRes] = await Promise.all([
    supabase
      .from("academy_cohorts")
      .select(COHORT_COLS)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("academy_courses").select("id, title").is("deleted_at", null),
    supabase
      .from("academy_enrollments")
      .select("id, cohort_id")
      .not("cohort_id", "is", null)
      .is("deleted_at", null),
  ]);

  const cohorts = (cohortsRes.data ?? []) as AcademyCohort[];
  const titleById = new Map<string, string>();
  for (const c of (coursesRes.data ?? []) as { id: string; title: string }[]) {
    titleById.set(c.id, c.title);
  }
  const enrolledByCohort = new Map<string, number>();
  for (const e of (enrollRes.data ?? []) as { id: string; cohort_id: string }[]) {
    enrolledByCohort.set(e.cohort_id, (enrolledByCohort.get(e.cohort_id) ?? 0) + 1);
  }

  return cohorts.map((c) => ({
    ...c,
    course_title: c.course_id ? titleById.get(c.course_id) ?? null : null,
    enrolled_count: enrolledByCohort.get(c.id) ?? 0,
  }));
}

/**
 * Detalle de una cohorte: cohorte + título del curso + roster (inscritos) con su
 * asistencia por sesión derivada (booleanos de largo = sessions), ratio y
 * aprobación (≥75%). null si la cohorte no existe / no es accesible.
 */
export async function getCohortWithRoster(
  supabase: SupabaseClient,
  cohortId: string,
): Promise<CohortDetail | null> {
  const { data: cohort } = await supabase
    .from("academy_cohorts")
    .select(COHORT_COLS)
    .eq("id", cohortId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!cohort) return null;
  const c = cohort as AcademyCohort;

  let courseTitle: string | null = null;
  if (c.course_id) {
    const { data: course } = await supabase
      .from("academy_courses")
      .select("title")
      .eq("id", c.course_id)
      .is("deleted_at", null)
      .maybeSingle<{ title: string }>();
    courseTitle = course?.title ?? null;
  }

  const [enrollRes, attRes, dipRes] = await Promise.all([
    supabase
      .from("academy_enrollments")
      .select(ENROLLMENT_COLS)
      .eq("cohort_id", cohortId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("academy_attendance")
      .select("enrollment_id, session_num, attended")
      .eq("cohort_id", cohortId),
    supabase
      .from("academy_diplomas")
      .select("enrollment_id")
      .not("enrollment_id", "is", null)
      .is("deleted_at", null),
  ]);

  const enrollments = (enrollRes.data ?? []) as AcademyEnrollment[];
  const sessions = Number(c.sessions) || 0;

  // Asistencia → mapa enrollment_id → set de sesiones asistidas.
  const attended = new Map<string, Set<number>>();
  for (const a of (attRes.data ?? []) as {
    enrollment_id: string;
    session_num: number;
    attended: boolean;
  }[]) {
    if (!a.attended) continue;
    const set = attended.get(a.enrollment_id) ?? new Set<number>();
    set.add(Number(a.session_num));
    attended.set(a.enrollment_id, set);
  }
  const withDiploma = new Set<string>();
  for (const d of (dipRes.data ?? []) as { enrollment_id: string | null }[]) {
    if (d.enrollment_id) withDiploma.add(d.enrollment_id);
  }

  let readyToEmit = 0;
  const roster: RosterRow[] = enrollments.map((e) => {
    const set = attended.get(e.id) ?? new Set<number>();
    const arr: boolean[] = Array.from({ length: sessions }, (_, i) => set.has(i + 1));
    const attendedCount = countAttended(arr);
    const ratio = attendanceRatio(attendedCount, sessions);
    const approved = isApproved(attendedCount, sessions);
    const hasDiploma = withDiploma.has(e.id);
    if (approved && !hasDiploma) readyToEmit += 1;
    return { enrollment: e, attended: arr, attendedCount, ratio, approved, hasDiploma };
  });

  return { cohort: c, course_title: courseTitle, roster, readyToEmit };
}

// ── Diplomas (Feature B · generador imprimible) ──────────────

/**
 * Diplomas emitidos del tenant (Feature B). LEE de `academy_diplomas` (no del
 * localStorage del prototipo del Norte). Orden: el más reciente primero. RLS
 * scope-a por tenant. Devuelve [] ante error.
 */
export async function listDiplomas(supabase: SupabaseClient): Promise<AcademyDiploma[]> {
  const { data } = await supabase
    .from("academy_diplomas")
    .select(
      "id, tenant_id, enrollment_id, client_markbox, folio, student_name, course_title, hours, place, issued_at, storage_path, created_at",
    )
    .is("deleted_at", null)
    .order("issued_at", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as AcademyDiploma[];
}

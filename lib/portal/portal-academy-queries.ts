/**
 * Queries del Portal · Academia (SDD-0093). El cliente del portal ve SOLO lo
 * suyo: el principal Portal de la sesión (`getPortalClientPrincipal`, SDD-0549)
 * fija tenant + Shipping Mark y cada lectura filtra EXPLÍCITO por los dos. El
 * Shipping Mark es único POR tenant, y la policy «by tenant» es permisiva: sin
 * el tenant, una sesión híbrida (equipo de otro tenant + cliente Portal) leía
 * inscripciones, diplomas y progreso del mismo Shipping Mark ajeno, y el
 * catálogo de ese otro tenant. Para un cliente Portal puro la RLS de 0418 ya
 * exige ese mismo tenant: el filtro no cambia lo que ve.
 *
 * Progreso DERIVADO (Slice D.2): el % de un curso = lecciones publicadas
 * completadas / total publicadas, leído de `academy_lesson_progress`. El portal
 * NUNCA escribe `academy_enrollments.progress_pct` (evita un UPDATE forjable →
 * sin BOLA). Requiere migraciones 0145 (lectura del catálogo) y 0149 (progreso).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalClientPrincipal } from "./portal-queries";

export interface PortalAcademyCourse {
  courseId: string;
  title: string;
  tier: string;
  progressPct: number;
  completed: boolean;
}

export interface PortalAcademyDiploma {
  id: string;
  folio: string;
  courseTitle: string;
  issuedAt: string;
}

export interface PortalAcademy {
  /** Miembro = tiene ≥1 inscripción o diploma (orgánico, SDD-0093). */
  isMember: boolean;
  courses: PortalAcademyCourse[];
  diplomas: PortalAcademyDiploma[];
}

export interface PortalCourseLesson {
  id: string;
  title: string;
  durationMin: number | null;
  kind: string;
  freePreview: boolean;
  /** Herramienta embebida (hoy 'alibaba_address') o null. */
  widget: string | null;
  /** Bloqueada = no inscrito y no es preview (catálogo); en "mis cursos" siempre false. */
  locked: boolean;
  done: boolean;
}

export interface PortalCourseModule {
  id: string;
  title: string;
  lessons: PortalCourseLesson[];
}

export interface PortalCourseDetail {
  course: { id: string; title: string; tier: string; summary: string | null; level: string | null; status: string };
  enrolled: boolean;
  progress: { done: number; total: number; pct: number; completed: boolean };
  modules: PortalCourseModule[];
  /** Próxima lección sin completar (o la primera), para "Continuar". */
  nextLessonId: string | null;
}

export interface PortalLessonView {
  course: { id: string; title: string };
  lesson: {
    id: string;
    title: string;
    kind: string;
    durationMin: number | null;
    videoUrl: string | null;
    widget: string | null;
    done: boolean;
  };
  /** Lista plana ordenada (módulo→lección) para el índice + anterior/siguiente. */
  lessons: { id: string; title: string; done: boolean }[];
  idx: number;
  prevId: string | null;
  nextId: string | null;
}

/** Tenant + Shipping Mark del principal Portal de la sesión. */
type PortalScope = { tenantId: string; markbox: string };

/** Scope del principal Portal logueado, o null si la sesión no tiene uno válido. */
async function portalScope(supabase: SupabaseClient): Promise<PortalScope | null> {
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  return { tenantId: principal.tenantId, markbox: principal.client.markbox };
}

function pctOf(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

const TIER_LABEL: Record<string, string> = {
  gratis: "Gratis",
  inicial: "Inicial",
  core: "Core",
  pro: "Pro",
  complemento: "Complemento",
};

/** Etiqueta legible del tier del curso (consistente en home + detalle). */
export function tierLabel(tier: string): string {
  return TIER_LABEL[tier] ?? tier;
}

// ── Tipos de fila (Supabase devuelve sin tipar; cast explícito, patrón del repo) ──
type CourseRow = {
  id: string;
  title: string;
  tier: string;
  summary: string | null;
  level: string | null;
  status: string;
};
type ModuleRow = { id: string; title: string; sort: number };
type LessonRow = {
  id: string;
  module_id: string;
  title: string;
  sort: number;
  kind: string;
  duration_min: number | null;
  free_preview: boolean;
  widget: string | null;
  video_url: string | null;
};

/**
 * Árbol del curso: módulos ordenados, cada uno con sus lecciones PUBLICADAS
 * ordenadas, + la lista plana en orden módulo→lección (para anterior/siguiente).
 * Las borrador no se muestran (se están redactando). RLS 0145: enrolled ve todas
 * las publicadas; no-enrolled solo las free_preview de cursos publicados.
 */
async function fetchCourseTree(
  supabase: SupabaseClient,
  tenantId: string,
  courseId: string,
): Promise<{ modules: { id: string; title: string; lessons: LessonRow[] }[]; flat: LessonRow[] }> {
  const [modRes, lesRes] = await Promise.all([
    supabase
      .from("academy_modules")
      .select("id, title, sort")
      .eq("tenant_id", tenantId)
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
    supabase
      .from("academy_lessons")
      .select("id, module_id, title, sort, kind, duration_min, free_preview, widget, video_url")
      .eq("tenant_id", tenantId)
      .eq("course_id", courseId)
      .eq("status", "publicado")
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
  ]);

  const lessons = (lesRes.data ?? []) as LessonRow[];
  const modules = ((modRes.data ?? []) as ModuleRow[]).map((m) => ({
    id: m.id,
    title: m.title,
    lessons: lessons
      .filter((l) => l.module_id === m.id)
      .sort((a, b) => a.sort - b.sort),
  }));
  const flat = modules.flatMap((m) => m.lessons);
  return { modules, flat };
}

/** Set de lesson_id completados por el cliente en un curso. */
async function doneLessonIds(
  supabase: SupabaseClient,
  scope: PortalScope,
  courseId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("academy_lesson_progress")
    .select("lesson_id")
    .eq("tenant_id", scope.tenantId)
    .eq("client_markbox", scope.markbox)
    .eq("course_id", courseId);
  return new Set(((data ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id));
}

type EnrollmentRow = {
  id: string;
  course_id: string;
  academy_courses:
    | { title: string; tier: string }
    | { title: string; tier: string }[]
    | null;
};

type DiplomaRow = {
  id: string;
  folio: string;
  course_title: string;
  issued_at: string;
};

/**
 * Estado de Academia del cliente del portal: sus cursos (con progreso derivado),
 * sus diplomas, y si es miembro. Devuelve vacío/no-miembro ante error o sin
 * sesión de portal (no lanza).
 */
export async function getPortalAcademy(supabase: SupabaseClient): Promise<PortalAcademy> {
  const scope = await portalScope(supabase);
  if (!scope) return { isMember: false, courses: [], diplomas: [] };

  const [enrollRes, dipRes] = await Promise.all([
    supabase
      .from("academy_enrollments")
      .select("id, course_id, academy_courses(title, tier)")
      .eq("tenant_id", scope.tenantId)
      .eq("client_markbox", scope.markbox)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("academy_diplomas")
      .select("id, folio, course_title, issued_at")
      .eq("tenant_id", scope.tenantId)
      .eq("client_markbox", scope.markbox)
      .is("deleted_at", null)
      .order("issued_at", { ascending: false }),
  ]);

  const enrollments = (enrollRes.data ?? []) as EnrollmentRow[];
  const courseIds = [...new Set(enrollments.map((e) => e.course_id))];

  // Progreso derivado: lecciones publicadas + completadas de los cursos inscritos.
  let publishedByCourse = new Map<string, Set<string>>();
  let doneByCourse = new Map<string, Set<string>>();
  if (courseIds.length > 0) {
    const [lessonsRes, progressRes] = await Promise.all([
      supabase
        .from("academy_lessons")
        .select("id, course_id")
        .eq("tenant_id", scope.tenantId)
        .in("course_id", courseIds)
        .eq("status", "publicado")
        .is("deleted_at", null),
      supabase
        .from("academy_lesson_progress")
        .select("lesson_id, course_id")
        .eq("tenant_id", scope.tenantId)
        .eq("client_markbox", scope.markbox)
        .in("course_id", courseIds),
    ]);
    publishedByCourse = groupIds((lessonsRes.data ?? []) as { id: string; course_id: string }[], "id");
    doneByCourse = groupIds((progressRes.data ?? []) as { lesson_id: string; course_id: string }[], "lesson_id");
  }

  const courses: PortalAcademyCourse[] = enrollments.map((e) => {
    const c = Array.isArray(e.academy_courses) ? e.academy_courses[0] : e.academy_courses;
    const published = publishedByCourse.get(e.course_id) ?? new Set();
    const done = doneByCourse.get(e.course_id) ?? new Set();
    const doneCount = [...done].filter((id) => published.has(id)).length;
    const total = published.size;
    return {
      courseId: e.course_id,
      title: c?.title ?? "Curso",
      tier: c?.tier ?? "inicial",
      progressPct: pctOf(doneCount, total),
      completed: total > 0 && doneCount >= total,
    };
  });

  const diplomas: PortalAcademyDiploma[] = ((dipRes.data ?? []) as DiplomaRow[]).map((d) => ({
    id: d.id,
    folio: d.folio,
    courseTitle: d.course_title,
    issuedAt: d.issued_at,
  }));

  return { isMember: courses.length > 0 || diplomas.length > 0, courses, diplomas };
}

/** Agrupa filas {course_id, <key>} en Map<course_id, Set<valor de key>>. */
function groupIds<K extends string>(
  rows: ({ course_id: string } & Record<K, string>)[],
  key: K,
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = m.get(r.course_id) ?? new Set<string>();
    set.add(r[key]);
    m.set(r.course_id, set);
  }
  return m;
}

/**
 * Detalle de un curso para el portal (módulos → lecciones, progreso, próxima
 * lección). Devuelve null si el curso no existe o no es legible (RLS). Pensado
 * para cursos donde el cliente está inscrito ("mis cursos").
 */
export async function getPortalCourseDetail(
  supabase: SupabaseClient,
  courseId: string,
): Promise<PortalCourseDetail | null> {
  const scope = await portalScope(supabase);
  if (!scope) return null;

  const { data: courseData } = await supabase
    .from("academy_courses")
    .select("id, title, tier, summary, level, status")
    .eq("tenant_id", scope.tenantId)
    .eq("id", courseId)
    .is("deleted_at", null)
    .maybeSingle<CourseRow>();
  if (!courseData) return null;

  const [{ modules, flat }, done, enrolled] = await Promise.all([
    fetchCourseTree(supabase, scope.tenantId, courseId),
    doneLessonIds(supabase, scope, courseId),
    isEnrolled(supabase, scope, courseId),
  ]);

  const modulesOut: PortalCourseModule[] = modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      durationMin: l.duration_min,
      kind: l.kind,
      freePreview: l.free_preview,
      widget: l.widget,
      locked: !enrolled && !l.free_preview,
      done: done.has(l.id),
    })),
  }));

  const total = flat.length;
  const doneCount = flat.filter((l) => done.has(l.id)).length;
  const next = flat.find((l) => !done.has(l.id)) ?? flat[0] ?? null;

  return {
    course: {
      id: courseData.id,
      title: courseData.title,
      tier: courseData.tier,
      summary: courseData.summary,
      level: courseData.level,
      status: courseData.status,
    },
    enrolled,
    progress: { done: doneCount, total, pct: pctOf(doneCount, total), completed: total > 0 && doneCount >= total },
    modules: modulesOut,
    nextLessonId: next ? next.id : null,
  };
}

/** ¿El cliente está inscrito en el curso? (RLS portal SELECT sobre enrollments.) */
async function isEnrolled(
  supabase: SupabaseClient,
  scope: PortalScope,
  courseId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academy_enrollments")
    .select("id")
    .eq("tenant_id", scope.tenantId)
    .eq("course_id", courseId)
    .eq("client_markbox", scope.markbox)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  return data != null;
}

/**
 * Una lección para el reproductor del portal: la lección + la lista plana del
 * curso (con done) + vecinos anterior/siguiente. Null si la lección no existe,
 * no es del curso, no está publicada o no es legible (RLS).
 */
export async function getPortalLesson(
  supabase: SupabaseClient,
  courseId: string,
  lessonId: string,
): Promise<PortalLessonView | null> {
  const scope = await portalScope(supabase);
  if (!scope) return null;

  const { data: courseData } = await supabase
    .from("academy_courses")
    .select("id, title")
    .eq("tenant_id", scope.tenantId)
    .eq("id", courseId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; title: string }>();
  if (!courseData) return null;

  const [{ flat }, done] = await Promise.all([
    fetchCourseTree(supabase, scope.tenantId, courseId),
    doneLessonIds(supabase, scope, courseId),
  ]);

  const idx = flat.findIndex((l) => l.id === lessonId);
  if (idx < 0) return null;
  const l = flat[idx];

  return {
    course: { id: courseData.id, title: courseData.title },
    lesson: {
      id: l.id,
      title: l.title,
      kind: l.kind,
      durationMin: l.duration_min,
      videoUrl: l.video_url,
      widget: l.widget,
      done: done.has(l.id),
    },
    lessons: flat.map((x) => ({ id: x.id, title: x.title, done: done.has(x.id) })),
    idx,
    prevId: idx > 0 ? flat[idx - 1].id : null,
    nextId: idx < flat.length - 1 ? flat[idx + 1].id : null,
  };
}

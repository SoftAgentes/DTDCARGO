/**
 * Tipos + validadores de la Academia DTD (SDD-0093).
 * DATA PURA (sin React, sin server-only). Convención del Studio: enums = uniones
 * de string-literal (espejo de los CHECK de la migración 0144), sin Zod.
 */

export type CourseTier = "gratis" | "inicial" | "core" | "pro" | "complemento";
export type CourseStatus = "borrador" | "proximamente" | "publicado";
export type LessonKind = "video" | "texto" | "descarga" | "quiz";
export type LessonStatus = "borrador" | "publicado";
export type CohortModality = "presencial" | "online";
export type CohortStatus = "proximamente" | "en_curso" | "completado";

export const COURSE_TIERS: readonly CourseTier[] = ["gratis", "inicial", "core", "pro", "complemento"];
export const COURSE_STATUSES: readonly CourseStatus[] = ["borrador", "proximamente", "publicado"];

export interface AcademyCourse {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  tier: CourseTier;
  summary: string | null;
  level: string | null;
  service_key: string | null;
  status: CourseStatus;
  sort: number;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademyModule {
  id: string;
  tenant_id: string;
  course_id: string;
  title: string;
  sort: number;
}

export interface AcademyLesson {
  id: string;
  tenant_id: string;
  module_id: string;
  course_id: string;
  title: string;
  sort: number;
  kind: LessonKind;
  video_url: string | null;
  asset_path: string | null;
  duration_min: number | null;
  free_preview: boolean;
  status: LessonStatus;
  /** Herramienta embebida (migr 0149). null = lección normal. */
  widget: "alibaba_address" | null;
}

/** Curso del catálogo + conteos para la vista de tarjetas. */
export interface CourseWithCounts extends AcademyCourse {
  modules_count: number;
  lessons_count: number;
}

/** Árbol de un curso (detalle): módulos con sus lecciones. */
export interface ModuleWithLessons extends AcademyModule {
  lessons: AcademyLesson[];
}
export interface CourseTree extends AcademyCourse {
  modules: ModuleWithLessons[];
}

export interface AcademiaStats {
  cursos: number;
  publicados: number;
  proximamente: number;
  cohortes: number;
  alumnos: number;
  /** Cohortes en curso (Slice B). */
  enCurso: number;
  /** Diplomas listos para emitir: inscritos aprobados (≥75%) sin diploma aún. */
  diplomasListos: number;
}

// ── Cohortes / inscritos / asistencia / diplomas (Slice B) ───

export interface AcademyCohort {
  id: string;
  tenant_id: string;
  course_id: string | null;
  name: string;
  hours: number | null;
  sessions: number;
  modality: CohortModality;
  place: string | null;
  starts_at: string | null;
  facilitator_name: string | null;
  status: CohortStatus;
  created_at: string;
  updated_at: string;
}

export interface AcademyEnrollment {
  id: string;
  tenant_id: string;
  course_id: string;
  cohort_id: string | null;
  client_markbox: string | null;
  student_name: string;
  student_ci: string | null;
  student_email: string | null;
  progress_pct: number;
  completed_at: string | null;
  created_at: string;
}

export interface AcademyAttendance {
  id: string;
  cohort_id: string;
  enrollment_id: string;
  session_num: number;
  attended: boolean;
}

export interface AcademyDiploma {
  id: string;
  tenant_id: string;
  enrollment_id: string | null;
  client_markbox: string | null;
  folio: string;
  student_name: string;
  course_title: string;
  hours: number | null;
  place: string | null;
  issued_at: string;
  storage_path: string | null;
  created_at: string;
}

/** Cohorte + curso (denorm) + #inscritos, para la lista de cohortes. */
export interface CohortWithCounts extends AcademyCohort {
  course_title: string | null;
  enrolled_count: number;
}

/** Un inscrito + su asistencia derivada (para la grilla del detalle). */
export interface RosterRow {
  enrollment: AcademyEnrollment;
  /** attended[i] = asistió a la sesión (i+1). Largo = sessions de la cohorte. */
  attended: boolean[];
  attendedCount: number;
  /** asistencia / sessions, 0..1. */
  ratio: number;
  approved: boolean;
  /** Ya tiene diploma emitido. */
  hasDiploma: boolean;
}

/** Detalle de cohorte: cohorte + curso + roster con asistencia. */
export interface CohortDetail {
  cohort: AcademyCohort;
  course_title: string | null;
  roster: RosterRow[];
  /** #inscritos aprobados sin diploma (candidatos a emitir). */
  readyToEmit: number;
}

// ── Labels / tonos (UI) ──────────────────────────────────────
export function tierLabel(t: CourseTier): string {
  return { gratis: "Gratis", inicial: "Inicial", core: "Core", pro: "Pro", complemento: "Complemento" }[t];
}

export function courseStatusLabel(s: CourseStatus): string {
  return { borrador: "Borrador", proximamente: "Próximamente", publicado: "Publicado" }[s];
}

/** Tono de Badge para el estado del curso (tonos del sistema). */
export function courseStatusTone(s: CourseStatus): "neutral" | "warning" | "success" {
  return { borrador: "neutral", proximamente: "warning", publicado: "success" }[s] as
    "neutral" | "warning" | "success";
}

export const COHORT_MODALITIES: readonly CohortModality[] = ["presencial", "online"];
export const COHORT_STATUSES: readonly CohortStatus[] = ["proximamente", "en_curso", "completado"];

export function modalityLabel(m: CohortModality): string {
  return { presencial: "Presencial", online: "Online" }[m];
}

export function cohortStatusLabel(s: CohortStatus): string {
  return { proximamente: "Próximamente", en_curso: "En curso", completado: "Completado" }[s];
}

/** Tono de Badge para el estado de la cohorte (tonos del sistema). */
export function cohortStatusTone(s: CohortStatus): "neutral" | "warning" | "wine" | "success" {
  return { proximamente: "neutral", en_curso: "wine", completado: "success" }[s] as
    "neutral" | "wine" | "success";
}

// ── Regla de aprobación (≥75% de asistencia) ─────────────────

/** Umbral de aprobación: asistencia / sesiones. Lógica de app (SDD-0093). */
export const APPROVAL_THRESHOLD = 0.75;

/** Cuenta de asistencias `true` en un arreglo de sesiones. */
export function countAttended(attended: readonly boolean[]): number {
  return attended.reduce((n, a) => n + (a ? 1 : 0), 0);
}

/** Ratio asistencia/sesiones en 0..1 (0 si sessions ≤ 0, sin NaN). */
export function attendanceRatio(attendedCount: number, sessions: number): number {
  if (sessions <= 0) return 0;
  return attendedCount / sessions;
}

/** ¿Aprueba? attended/sessions ≥ 0.75. sessions ≤ 0 → false (sin NaN). */
export function isApproved(attendedCount: number, sessions: number): boolean {
  return attendanceRatio(attendedCount, sessions) >= APPROVAL_THRESHOLD;
}

// ── Folio del diploma (app-side, sin migración) ──────────────

/**
 * Folio del diploma: `DTD-AC-{YYYY}-{seq4}` (seq con padding a 4).
 * El `seq` lo provee el caller (count de diplomas del tenant + 1) y se recomputa
 * ante un choque del unique(tenant, folio) — patrón de reintento de prealertas.
 */
export function buildDiplomaFolio(year: number, seq: number): string {
  const yyyy = String(year).padStart(4, "0");
  const s4 = String(Math.max(1, Math.trunc(seq))).padStart(4, "0");
  return `DTD-AC-${yyyy}-${s4}`;
}

// ── Validación (sin Zod) ─────────────────────────────────────
export interface CourseInput {
  title: string;
  slug: string;
  tier: CourseTier;
  summary: string | null;
  level: string | null;
  status: CourseStatus;
}

export interface CourseActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof CourseInput, string>>;
  createdId?: string;
}

/** slug seguro a partir del título (a-z0-9-). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Formato kebab estricto: solo a-z0-9 separados por guion simple, sin bordes. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateCourseInput(
  partial: Partial<CourseInput>,
): { input: CourseInput | null; fieldErrors: Partial<Record<keyof CourseInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof CourseInput, string>> = {};

  const title = partial.title?.trim() ?? "";
  if (!title) fieldErrors.title = "El título es requerido";

  const tier = partial.tier ?? "inicial";
  if (!COURSE_TIERS.includes(tier)) fieldErrors.tier = "Tier inválido";

  const status = partial.status ?? "borrador";
  if (!COURSE_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  // slug: si viene, debe ser kebab; si falta, se deriva del título.
  const rawSlug = partial.slug?.trim() ?? "";
  const slug = rawSlug || slugify(title);
  if (!slug) {
    fieldErrors.slug = "No se pudo generar el slug (escribe un título o un slug)";
  } else if (!SLUG_RE.test(slug)) {
    fieldErrors.slug = "El slug solo admite minúsculas, números y guiones (ej. domina-yiwu)";
  }

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      title,
      slug,
      tier,
      status,
      summary: partial.summary?.trim() || null,
      level: partial.level?.trim() || null,
    },
    fieldErrors: null,
  };
}

// ── Módulo: input + validación + action state ────────────────

export interface ModuleInput {
  courseId: string;
  title: string;
  sort: number;
}

export interface ModuleActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ModuleInput, string>>;
  moduleId?: string;
}

/** Normaliza un entero de orden (sort) ≥ 0; vacío/NaN → 0. */
function normalizeSort(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 0;
  const n = Math.trunc(raw);
  return n < 0 ? 0 : n;
}

export function validateModuleInput(
  partial: Partial<ModuleInput>,
): { input: ModuleInput | null; fieldErrors: Partial<Record<keyof ModuleInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof ModuleInput, string>> = {};

  const courseId = partial.courseId?.trim() ?? "";
  if (!courseId) fieldErrors.courseId = "Falta el curso";

  const title = partial.title?.trim() ?? "";
  if (!title) fieldErrors.title = "El título del módulo es requerido";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: { courseId, title, sort: normalizeSort(partial.sort) },
    fieldErrors: null,
  };
}

// ── Lección: input + validación + action state ───────────────

export const LESSON_KINDS: readonly LessonKind[] = ["video", "texto", "descarga", "quiz"];
export const LESSON_STATUSES: readonly LessonStatus[] = ["borrador", "publicado"];

/** Widgets embebibles en una lección (espejo del CHECK de la migración 0149). */
export type LessonWidget = "alibaba_address";
export const LESSON_WIDGETS: readonly LessonWidget[] = ["alibaba_address"];

export function lessonKindLabel(k: LessonKind): string {
  return { video: "Video", texto: "Texto", descarga: "Descarga", quiz: "Quiz" }[k];
}

export function lessonStatusLabel(s: LessonStatus): string {
  return { borrador: "Borrador", publicado: "Publicado" }[s];
}

export function lessonWidgetLabel(w: LessonWidget | null): string {
  if (w === "alibaba_address") return "Guía de dirección (Alibaba)";
  return "Ninguna";
}

export interface LessonInput {
  moduleId: string;
  courseId: string;
  title: string;
  kind: LessonKind;
  videoUrl: string | null;
  durationMin: number | null;
  freePreview: boolean;
  widget: LessonWidget | null;
  status: LessonStatus;
  sort: number;
}

export interface LessonActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof LessonInput, string>>;
  lessonId?: string;
}

export function validateLessonInput(
  partial: Partial<LessonInput>,
): { input: LessonInput | null; fieldErrors: Partial<Record<keyof LessonInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof LessonInput, string>> = {};

  const moduleId = partial.moduleId?.trim() ?? "";
  if (!moduleId) fieldErrors.moduleId = "Falta el módulo";

  const courseId = partial.courseId?.trim() ?? "";
  if (!courseId) fieldErrors.courseId = "Falta el curso";

  const title = partial.title?.trim() ?? "";
  if (!title) fieldErrors.title = "El título de la lección es requerido";

  const kind = partial.kind ?? "video";
  if (!LESSON_KINDS.includes(kind)) fieldErrors.kind = "Tipo de lección inválido";

  const status = partial.status ?? "borrador";
  if (!LESSON_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  // widget: null o uno del whitelist.
  let widget: LessonWidget | null = null;
  if (partial.widget != null && String(partial.widget).trim() !== "") {
    if (!LESSON_WIDGETS.includes(partial.widget)) fieldErrors.widget = "Widget inválido";
    else widget = partial.widget;
  }

  // duration_min: opcional, entero ≥ 0 si viene.
  let durationMin: number | null = null;
  if (partial.durationMin != null && !Number.isNaN(partial.durationMin)) {
    const d = Math.trunc(partial.durationMin);
    if (d < 0) fieldErrors.durationMin = "La duración no puede ser negativa";
    else durationMin = d;
  }

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      moduleId,
      courseId,
      title,
      kind,
      videoUrl: partial.videoUrl?.trim() || null,
      durationMin,
      freePreview: partial.freePreview === true,
      widget,
      status,
      sort: normalizeSort(partial.sort),
    },
    fieldErrors: null,
  };
}

// ── Diploma imprimible: variante estable por folio (Feature B) ─

/** Las 4 variantes del generador del Norte (diploma.js): A/B/C/D. */
export const DIPLOMA_VARIANTS = ["A", "B", "C", "D"] as const;
export type DiplomaVariant = (typeof DIPLOMA_VARIANTS)[number];

/**
 * Elige una variante de diploma de forma ESTABLE a partir del folio (mismo folio
 * → misma variante siempre). Hash simple (suma de char codes) % 4. No es
 * criptográfico: solo reparte el catálogo de variantes de modo determinista.
 */
export function pickDiplomaVariant(folio: string): DiplomaVariant {
  let h = 0;
  for (let i = 0; i < folio.length; i++) {
    h = (h + folio.charCodeAt(i)) % DIPLOMA_VARIANTS.length;
  }
  return DIPLOMA_VARIANTS[h];
}

// ── Cohorte: input + validación + action state ───────────────

export interface CohortInput {
  courseId: string | null;
  name: string;
  hours: number | null;
  sessions: number;
  modality: CohortModality;
  place: string | null;
  startsAt: string | null;
  facilitatorName: string | null;
  status: CohortStatus;
}

export interface CohortActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof CohortInput, string>>;
  cohortId?: string;
}

/** Normaliza una fecha (YYYY-MM-DD) o null. Rechaza formatos no-ISO. */
function normalizeDate(raw: string | null | undefined): { value: string | null; bad: boolean } {
  const s = (raw ?? "").trim();
  if (!s) return { value: null, bad: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: null, bad: true };
  return { value: s, bad: false };
}

export function validateCohortInput(
  partial: Partial<CohortInput>,
): { input: CohortInput | null; fieldErrors: Partial<Record<keyof CohortInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof CohortInput, string>> = {};

  const name = partial.name?.trim() ?? "";
  if (!name) fieldErrors.name = "El nombre de la cohorte es requerido";

  const modality = partial.modality ?? "presencial";
  if (!COHORT_MODALITIES.includes(modality)) fieldErrors.modality = "Modalidad inválida";

  const status = partial.status ?? "proximamente";
  if (!COHORT_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  // sessions: entero ≥ 1.
  const sessionsRaw = partial.sessions;
  const sessions =
    sessionsRaw == null || Number.isNaN(sessionsRaw) ? 1 : Math.trunc(sessionsRaw);
  if (!Number.isFinite(sessions) || sessions < 1) {
    fieldErrors.sessions = "Las sesiones deben ser un entero ≥ 1";
  }

  // hours: opcional, entero ≥ 0 si viene.
  let hours: number | null = null;
  if (partial.hours != null && !Number.isNaN(partial.hours)) {
    const h = Math.trunc(partial.hours);
    if (h < 0) fieldErrors.hours = "Las horas no pueden ser negativas";
    else hours = h;
  }

  const dateRes = normalizeDate(partial.startsAt);
  if (dateRes.bad) fieldErrors.startsAt = "Fecha inválida (usa el selector)";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      courseId: partial.courseId?.trim() || null,
      name,
      hours,
      sessions,
      modality,
      place: partial.place?.trim() || null,
      startsAt: dateRes.value,
      facilitatorName: partial.facilitatorName?.trim() || null,
      status,
    },
    fieldErrors: null,
  };
}

// ── Inscripción: input + validación + action state ───────────

export interface EnrollmentInput {
  cohortId: string;
  courseId: string | null;
  studentName: string;
  studentCi: string | null;
  studentEmail: string | null;
  clientMarkbox: string | null;
}

export interface EnrollmentActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof EnrollmentInput, string>>;
  enrollmentId?: string;
}

/** Validación laxa de email (solo si viene); el campo es opcional. */
function looksLikeEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

export function validateEnrollmentInput(
  partial: Partial<EnrollmentInput>,
): { input: EnrollmentInput | null; fieldErrors: Partial<Record<keyof EnrollmentInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof EnrollmentInput, string>> = {};

  const cohortId = partial.cohortId?.trim() ?? "";
  if (!cohortId) fieldErrors.cohortId = "Falta la cohorte";

  const studentName = partial.studentName?.trim() ?? "";
  if (!studentName) fieldErrors.studentName = "El nombre del alumno es requerido";

  const email = partial.studentEmail?.trim() ?? "";
  if (email && !looksLikeEmail(email)) fieldErrors.studentEmail = "Correo inválido";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      cohortId,
      courseId: partial.courseId?.trim() || null,
      studentName,
      studentCi: partial.studentCi?.trim() || null,
      studentEmail: email || null,
      clientMarkbox: partial.clientMarkbox?.trim() || null,
    },
    fieldErrors: null,
  };
}

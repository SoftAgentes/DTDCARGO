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

// ── Validación (sin Zod) ─────────────────────────────────────
export interface CourseInput {
  title: string;
  slug: string;
  tier: CourseTier;
  summary: string | null;
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

  const slug = (partial.slug?.trim() || slugify(title)) ?? "";
  if (!slug) fieldErrors.slug = "No se pudo generar el slug";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: { title, slug, tier, status, summary: partial.summary?.trim() || null },
    fieldErrors: null,
  };
}

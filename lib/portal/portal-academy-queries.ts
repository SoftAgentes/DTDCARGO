/**
 * Queries del Portal · Academia (SDD-0093, Slice D). El cliente del portal ve
 * SOLO lo suyo: scope por `client_markbox` (`get_portal_client_markbox()` +
 * filtro explícito), mismo aislamiento que `portal-queries.ts`.
 *
 * Requiere la migración 0145 (policies de lectura de portal sobre el catálogo).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

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

/** MARKBOX del cliente del portal logueado, o null si el principal no es cliente. */
async function portalMarkbox(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_portal_client_markbox");
  if (error || !data) return null;
  return data as string;
}

type EnrollmentRow = {
  id: string;
  course_id: string;
  progress_pct: number | null;
  completed_at: string | null;
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
 * Estado de Academia del cliente del portal: sus cursos (con progreso), sus
 * diplomas, y si es miembro. Devuelve vacío/no-miembro ante error o sin sesión
 * de portal (no lanza).
 */
export async function getPortalAcademy(supabase: SupabaseClient): Promise<PortalAcademy> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return { isMember: false, courses: [], diplomas: [] };

  const [enrollRes, dipRes] = await Promise.all([
    supabase
      .from("academy_enrollments")
      .select("id, course_id, progress_pct, completed_at, academy_courses(title, tier)")
      .eq("client_markbox", markbox)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("academy_diplomas")
      .select("id, folio, course_title, issued_at")
      .eq("client_markbox", markbox)
      .is("deleted_at", null)
      .order("issued_at", { ascending: false }),
  ]);

  const courses: PortalAcademyCourse[] = ((enrollRes.data ?? []) as EnrollmentRow[]).map((e) => {
    const c = Array.isArray(e.academy_courses) ? e.academy_courses[0] : e.academy_courses;
    return {
      courseId: e.course_id,
      title: c?.title ?? "Curso",
      tier: c?.tier ?? "inicial",
      progressPct: e.progress_pct ?? 0,
      completed: e.completed_at != null,
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

"use server";

/**
 * Server actions de la Academia DTD (SDD-0093, Slice B). Gestión de cohortes,
 * inscritos, asistencia y emisión de diplomas.
 *
 * Patrón del Studio: "use server" + gate `moduleEditDenial` (backstop server-side
 * de RBAC, SDD-0085) + parsing/validación manual con los `validate*Input()` de
 * lib/studio/academia/types (NO Zod) + resolución de tenant desde user_tenants
 * (RLS lo fuerza igual) + revalidatePath.
 *
 * Acciones:
 *  - createCohortAction / updateCohortAction   → alta/edición de cohorte.
 *  - createEnrollmentAction                    → inscribe un alumno a una cohorte.
 *  - toggleAttendanceAction                    → upsert/flip de asistencia por
 *                                                (enrollment_id, session_num).
 *  - emitDiplomasAction(cohortId)              → emite diplomas a los aprobados
 *                                                (≥75%) sin diploma. Folio app-side
 *                                                `DTD-AC-{YYYY}-{seq4}` con REINTENTO
 *                                                ante choque del unique(tenant, folio).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  buildDiplomaFolio,
  countAttended,
  isApproved,
  validateCohortInput,
  validateEnrollmentInput,
  type CohortActionState,
  type CohortInput,
  type EnrollmentActionState,
  type EnrollmentInput,
} from "@/lib/studio/academia/types";

type Result = { ok?: boolean; error?: string };

const MODULE = "academia";

function revalidate(): void {
  revalidatePath("/studio/academia");
  revalidatePath("/studio/dashboard");
}

/** Resuelve el tenant del usuario logueado (RLS). null si no se puede. */
async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  return link?.tenant_id ?? null;
}

// ════════════════════════════════════════════════════════════════
// Cohortes
// ════════════════════════════════════════════════════════════════

export async function createCohortAction(
  raw: Partial<CohortInput>,
): Promise<CohortActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateCohortInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos de la cohorte inválidos." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: row, error } = await supabase
    .from("academy_cohorts")
    .insert({
      tenant_id: tenantId,
      course_id: input.courseId,
      name: input.name,
      hours: input.hours,
      sessions: input.sessions,
      modality: input.modality,
      place: input.place,
      starts_at: input.startsAt,
      facilitator_name: input.facilitatorName,
      status: input.status,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !row) {
    return { error: `No se pudo crear la cohorte: ${error?.message ?? "desconocido"}` };
  }
  revalidate();
  return { ok: true, cohortId: row.id };
}

export async function updateCohortAction(
  cohortId: string,
  raw: Partial<CohortInput>,
): Promise<CohortActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!cohortId) return { error: "Falta la cohorte a editar." };
  const { input, fieldErrors } = validateCohortInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos de la cohorte inválidos." };

  const { error } = await supabase
    .from("academy_cohorts")
    .update({
      course_id: input.courseId,
      name: input.name,
      hours: input.hours,
      sessions: input.sessions,
      modality: input.modality,
      place: input.place,
      starts_at: input.startsAt,
      facilitator_name: input.facilitatorName,
      status: input.status,
    })
    .eq("id", cohortId)
    .is("deleted_at", null);

  if (error) return { error: `No se pudo actualizar la cohorte: ${error.message}` };
  revalidate();
  return { ok: true, cohortId };
}

// ════════════════════════════════════════════════════════════════
// Inscripciones
// ════════════════════════════════════════════════════════════════

export async function createEnrollmentAction(
  raw: Partial<EnrollmentInput>,
): Promise<EnrollmentActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateEnrollmentInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos de la inscripción inválidos." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // La cohorte define el course_id (academy_enrollments.course_id es NOT NULL).
  // Resolvemos su course_id (y validamos que la cohorte exista en el tenant).
  const { data: cohort, error: cohortErr } = await supabase
    .from("academy_cohorts")
    .select("id, course_id")
    .eq("id", input.cohortId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; course_id: string | null }>();
  if (cohortErr) return { error: `No se pudo leer la cohorte: ${cohortErr.message}` };
  if (!cohort) return { fieldErrors: { cohortId: "Esa cohorte no es válida." } };

  // course_id: el de la cohorte; si es standalone (null), exige uno explícito.
  const courseId = cohort.course_id ?? input.courseId;
  if (!courseId) {
    return {
      error:
        "Esta cohorte no tiene curso asociado; no se puede inscribir hasta vincularla a un curso.",
    };
  }

  const { data: row, error } = await supabase
    .from("academy_enrollments")
    .insert({
      tenant_id: tenantId,
      course_id: courseId,
      cohort_id: input.cohortId,
      client_markbox: input.clientMarkbox,
      student_name: input.studentName,
      student_ci: input.studentCi,
      student_email: input.studentEmail,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !row) {
    return { error: `No se pudo inscribir al alumno: ${error?.message ?? "desconocido"}` };
  }
  revalidate();
  return { ok: true, enrollmentId: row.id };
}

// ════════════════════════════════════════════════════════════════
// Asistencia
// ════════════════════════════════════════════════════════════════

/**
 * Marca/desmarca la asistencia de un inscrito a una sesión. Upsert por
 * (enrollment_id, session_num) — el `attended` que llega es el valor DESEADO
 * (no un flip ciego), así la UI es idempotente y no depende de re-leer antes.
 */
export async function toggleAttendanceAction(args: {
  cohortId: string;
  enrollmentId: string;
  sessionNum: number;
  attended: boolean;
}): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  const { cohortId, enrollmentId, sessionNum, attended } = args;
  if (!cohortId || !enrollmentId) return { error: "Falta la cohorte o el inscrito." };
  if (!Number.isInteger(sessionNum) || sessionNum < 1) {
    return { error: "Número de sesión inválido." };
  }

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase
    .from("academy_attendance")
    .upsert(
      {
        tenant_id: tenantId,
        cohort_id: cohortId,
        enrollment_id: enrollmentId,
        session_num: sessionNum,
        attended,
      },
      { onConflict: "enrollment_id,session_num" },
    );

  if (error) return { error: `No se pudo guardar la asistencia: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════
// Emisión de diplomas
// ════════════════════════════════════════════════════════════════

const MAX_FOLIO_RETRIES = 6;

export async function emitDiplomasAction(
  cohortId: string,
): Promise<{ ok?: boolean; error?: string; emitted?: number; folios?: string[] }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!cohortId) return { error: "Falta la cohorte." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Cohorte + curso (para course_title / hours / place del diploma).
  const { data: cohort, error: cohortErr } = await supabase
    .from("academy_cohorts")
    .select("id, course_id, name, hours, sessions, place")
    .eq("id", cohortId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      course_id: string | null;
      name: string;
      hours: number | null;
      sessions: number;
      place: string | null;
    }>();
  if (cohortErr) return { error: `No se pudo leer la cohorte: ${cohortErr.message}` };
  if (!cohort) return { error: "La cohorte no existe o no es accesible." };

  let courseTitle = cohort.name;
  if (cohort.course_id) {
    const { data: course } = await supabase
      .from("academy_courses")
      .select("title")
      .eq("id", cohort.course_id)
      .is("deleted_at", null)
      .maybeSingle<{ title: string }>();
    if (course?.title) courseTitle = course.title;
  }

  const sessions = Number(cohort.sessions) || 0;

  // Inscritos de la cohorte + asistencia + diplomas existentes (para excluir).
  const [enrollRes, attRes, dipRes] = await Promise.all([
    supabase
      .from("academy_enrollments")
      .select("id, client_markbox, student_name")
      .eq("cohort_id", cohortId)
      .is("deleted_at", null),
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
  if (enrollRes.error) return { error: `No se pudieron leer los inscritos: ${enrollRes.error.message}` };

  const enrollments = (enrollRes.data ?? []) as {
    id: string;
    client_markbox: string | null;
    student_name: string;
  }[];

  // Asistencia por inscrito (booleanos por sesión).
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

  // Candidatos: aprobados (≥75%) sin diploma.
  const candidates = enrollments.filter((e) => {
    if (withDiploma.has(e.id)) return false;
    const arr: boolean[] = Array.from({ length: sessions }, (_, i) =>
      (attended.get(e.id) ?? new Set<number>()).has(i + 1),
    );
    return isApproved(countAttended(arr), sessions);
  });

  if (candidates.length === 0) {
    return { error: "Aún no hay alumnos aprobados (≥ 75% de asistencia) sin diploma." };
  }

  // seq base = count de diplomas del tenant. Se inserta UNO a UNO con reintento
  // ante choque del unique(tenant, folio) — recomputando el seq desde el count
  // vivo (race entre dos emisiones simultáneas).
  const year = new Date().getFullYear();
  const folios: string[] = [];

  for (const cand of candidates) {
    let inserted = false;
    for (let attempt = 0; attempt < MAX_FOLIO_RETRIES && !inserted; attempt++) {
      const { count, error: countErr } = await supabase
        .from("academy_diplomas")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      if (countErr) {
        return { error: `No se pudo numerar el diploma: ${countErr.message}` };
      }
      const folio = buildDiplomaFolio(year, (count ?? 0) + 1 + attempt);

      const { error: insErr } = await supabase.from("academy_diplomas").insert({
        tenant_id: tenantId,
        enrollment_id: cand.id,
        client_markbox: cand.client_markbox,
        folio,
        student_name: cand.student_name,
        course_title: courseTitle,
        hours: cohort.hours,
        place: cohort.place,
      });

      if (!insErr) {
        folios.push(folio);
        inserted = true;
        break;
      }
      if (insErr.code === "23505") {
        // Choque de folio (otra emisión ganó la carrera o el +attempt aún colisiona)
        // → reintentamos recomputando el seq.
        continue;
      }
      return { error: `No se pudo emitir el diploma: ${insErr.message}` };
    }
    if (!inserted) {
      // Agotamos reintentos para este candidato; devolvemos lo emitido hasta acá.
      revalidate();
      return {
        ok: folios.length > 0,
        emitted: folios.length,
        folios,
        error:
          folios.length > 0
            ? `Se emitieron ${folios.length} diploma(s); reintenta para los restantes.`
            : "No se pudo numerar el diploma (reintenta).",
      };
    }
  }

  revalidate();
  return { ok: true, emitted: folios.length, folios };
}

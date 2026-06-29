/**
 * Queries de lectura del Club DTD (SDD-0116, Slice A). Funciones puras que
 * reciben un SupabaseClient (RLS scope-a por tenant). Devuelven [] / null ante
 * error (no lanzan) — patrón de los demás módulos del Studio.
 *
 * La resolución de la PERSONA por cédula (ubicar/crear, deduplicado) se reusa de
 * la Academia (SDD-0107) — un solo camino de identidad por cédula en el repo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClubMember,
  ClubMemberRow,
  ClubStats,
} from "@/lib/studio/club/club-member-types";

const MEMBER_COLS =
  "id, tenant_id, person_id, client_markbox, plan, status, joined_at, current_period_end, source, notes, created_at, updated_at, deleted_at";

/**
 * Miembros vivos del Club + datos denormalizados de su persona (nombre, cédula),
 * Shipping Mark de carga (si ya es cliente) y elegibilidad de Academia (D1: ¿la
 * persona tiene ≥1 inscripción?). Una sola pasada (evita N+1).
 */
export async function listClubMembers(supabase: SupabaseClient): Promise<ClubMemberRow[]> {
  const { data: membersData } = await supabase
    .from("club_members")
    .select(MEMBER_COLS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const members = (membersData ?? []) as ClubMember[];
  if (members.length === 0) return [];

  const personIds = Array.from(new Set(members.map((m) => m.person_id)));

  const [personsRes, clientsRes, enrollRes] = await Promise.all([
    supabase.from("persons").select("id, name, national_id").in("id", personIds),
    supabase
      .from("clients")
      .select("person_id, markbox")
      .in("person_id", personIds)
      .is("deleted_at", null)
      // Orden determinista: el markbox "primero" = el perfil de carga más antiguo
      // (una persona puede tener >1 perfil de carga).
      .order("created_at", { ascending: true }),
    supabase
      .from("academy_enrollments")
      .select("person_id")
      .in("person_id", personIds)
      .is("deleted_at", null),
  ]);

  const personById = new Map<string, { name: string; national_id: string | null }>();
  for (const p of (personsRes.data ?? []) as {
    id: string;
    name: string;
    national_id: string | null;
  }[]) {
    personById.set(p.id, { name: p.name, national_id: p.national_id });
  }

  // Primer markbox por persona (más antiguo, por el order de la query).
  const markboxByPerson = new Map<string, string>();
  for (const c of (clientsRes.data ?? []) as { person_id: string | null; markbox: string }[]) {
    if (c.person_id && !markboxByPerson.has(c.person_id)) {
      markboxByPerson.set(c.person_id, c.markbox);
    }
  }

  const academyMembers = new Set<string>();
  for (const e of (enrollRes.data ?? []) as { person_id: string | null }[]) {
    if (e.person_id) academyMembers.add(e.person_id);
  }

  return members.map((m) => {
    const person = personById.get(m.person_id);
    return {
      ...m,
      person_name: person?.name ?? "—",
      person_national_id: person?.national_id ?? null,
      cargo_markbox: markboxByPerson.get(m.person_id) ?? null,
      is_academy_member: academyMembers.has(m.person_id),
    };
  });
}

/** KPIs del módulo. RLS scope-a por tenant. */
export async function clubStats(supabase: SupabaseClient): Promise<ClubStats> {
  const live = { count: "exact" as const, head: true };
  const [miembros, activos, importadores, mayoristas] = await Promise.all([
    supabase.from("club_members").select("id", live).is("deleted_at", null),
    supabase.from("club_members").select("id", live).eq("status", "activa").is("deleted_at", null),
    supabase.from("club_members").select("id", live).eq("plan", "importador").is("deleted_at", null),
    supabase.from("club_members").select("id", live).eq("plan", "mayorista").is("deleted_at", null),
  ]);

  return {
    miembros: miembros.count ?? 0,
    activos: activos.count ?? 0,
    importadores: importadores.count ?? 0,
    mayoristas: mayoristas.count ?? 0,
  };
}

/** Una membresía viva por id (para el drawer de edición). null si no existe. */
export async function getClubMemberById(
  supabase: SupabaseClient,
  id: string,
): Promise<ClubMember | null> {
  const { data } = await supabase
    .from("club_members")
    .select(MEMBER_COLS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as ClubMember | null) ?? null;
}

/**
 * D1: ¿la persona es miembro de la Academia (≥1 inscripción viva)? Define la
 * elegibilidad para el Club. No bloquea el alta (es un aviso al operador), pero
 * la usa el portal del miembro (Slice E) para el gate del tab.
 */
export async function isPersonAcademyMember(
  supabase: SupabaseClient,
  personId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("academy_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("person_id", personId)
    .is("deleted_at", null);
  return (count ?? 0) > 0;
}

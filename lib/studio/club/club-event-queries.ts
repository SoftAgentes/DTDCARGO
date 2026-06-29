/**
 * Queries de lectura de los Eventos del Club (SDD-0116, Slice C V1). Funciones
 * puras que reciben un SupabaseClient (RLS scope-a por tenant). Devuelven []
 * ante error (no lanzan).
 *
 * D9: los eventos viven en `academy_cohorts` con `context='club'`. Esta capa SOLO
 * ve esos (filtro explícito `context='club'`); las cohortes de curso las maneja
 * lib/studio/academia. Mapea las columnas de cohorte → forma ClubEvent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClubEvent,
  ClubEventModality,
  ClubEventStatus,
} from "@/lib/studio/club/club-event-types";

type CohortRow = {
  id: string;
  name: string;
  summary: string | null;
  modality: ClubEventModality;
  place: string | null;
  starts_at: string | null;
  facilitator_name: string | null;
  status: ClubEventStatus;
};

const COLS = "id, name, summary, modality, place, starts_at, facilitator_name, status";

/**
 * Eventos del Club vivos (context='club'), ordenados por fecha (más próximos /
 * recientes primero). RLS scope-a por tenant.
 */
export async function listClubEvents(supabase: SupabaseClient): Promise<ClubEvent[]> {
  const { data } = await supabase
    .from("academy_cohorts")
    .select(COLS)
    .eq("context", "club")
    .is("deleted_at", null)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as CohortRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    summary: r.summary,
    modality: r.modality,
    place: r.place,
    startsAt: r.starts_at,
    facilitatorName: r.facilitator_name,
    status: r.status,
  }));
}

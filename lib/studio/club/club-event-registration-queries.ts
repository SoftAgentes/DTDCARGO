/**
 * Queries de lectura de las Inscripciones a Eventos del Club (SDD-0116, Slice
 * C.2). Funciones puras que reciben un SupabaseClient (RLS scope-a por tenant).
 * Devuelven Map/[] ante error (no lanzan).
 *
 * El inscrito es un miembro del Club → resolvemos el nombre/cédula vía
 * club_members → persons (una sola pasada, evita N+1).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EventRegistration,
  EventRegistrationStatus,
} from "@/lib/studio/club/club-event-registration-types";

type RegRow = {
  id: string;
  event_id: string;
  member_id: string;
  status: EventRegistrationStatus;
  note: string | null;
};

/**
 * Inscripciones vivas de una lista de eventos, agrupadas por event_id. Una sola
 * pasada: registrations → members → persons. RLS scope-a por tenant.
 */
export async function listEventRegistrationsByEvent(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, EventRegistration[]>> {
  const byEvent = new Map<string, EventRegistration[]>();
  if (eventIds.length === 0) return byEvent;

  const { data: regData } = await supabase
    .from("club_event_registrations")
    .select("id, event_id, member_id, status, note")
    .in("event_id", eventIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const regs = (regData ?? []) as RegRow[];
  if (regs.length === 0) return byEvent;

  const memberIds = Array.from(new Set(regs.map((r) => r.member_id)));
  const memberMeta = new Map<string, { person_id: string }>();
  if (memberIds.length > 0) {
    const { data: mData } = await supabase
      .from("club_members")
      .select("id, person_id")
      .in("id", memberIds);
    for (const m of (mData ?? []) as { id: string; person_id: string }[]) {
      memberMeta.set(m.id, { person_id: m.person_id });
    }
  }

  const personIds = Array.from(
    new Set(Array.from(memberMeta.values()).map((m) => m.person_id)),
  );
  const personById = new Map<string, { name: string; national_id: string | null }>();
  if (personIds.length > 0) {
    const { data: pData } = await supabase
      .from("persons")
      .select("id, name, national_id")
      .in("id", personIds);
    for (const p of (pData ?? []) as {
      id: string;
      name: string;
      national_id: string | null;
    }[]) {
      personById.set(p.id, { name: p.name, national_id: p.national_id });
    }
  }

  for (const r of regs) {
    const meta = memberMeta.get(r.member_id);
    const person = meta ? personById.get(meta.person_id) : undefined;
    const row: EventRegistration = {
      id: r.id,
      eventId: r.event_id,
      memberId: r.member_id,
      status: r.status,
      note: r.note,
      memberName: person?.name ?? "—",
      memberNationalId: person?.national_id ?? null,
    };
    const arr = byEvent.get(r.event_id) ?? [];
    arr.push(row);
    byEvent.set(r.event_id, arr);
  }

  return byEvent;
}

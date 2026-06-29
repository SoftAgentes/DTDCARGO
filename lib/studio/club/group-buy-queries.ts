/**
 * Queries de lectura de la Compra Grupal del Club (SDD-0116, Slice B). Funciones
 * puras que reciben un SupabaseClient (RLS scope-a por tenant). Devuelven [] / null
 * ante error (no lanzan).
 *
 * `committed_cbm` se DERIVA acá (suma de estimated_cbm de participantes NO
 * retirados) — no se persiste, no puede driftear. Una sola pasada (evita N+1).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countsTowardCommitted,
  type ClubGroupBuy,
  type ClubGroupBuyParticipant,
  type GroupBuyDetail,
  type GroupBuyStats,
  type ParticipantRow,
} from "@/lib/studio/club/group-buy-types";

const GB_COLS =
  "id, tenant_id, title, slug, summary, status, opens_at, closes_at, target_cbm, origin, destination, consolidation_id, created_at, updated_at, deleted_at";
const P_COLS =
  "id, tenant_id, group_buy_id, member_id, estimated_cbm, estimated_value_usd, status, note, created_at, updated_at, deleted_at";

/** Miembro pickeable para sumar a una ronda (membresía viva + datos de persona). */
export interface EligibleMember {
  member_id: string;
  person_name: string;
  national_id: string | null;
  plan: string;
}

/**
 * Compras grupales vivas + participantes (con datos del miembro/persona) +
 * volumen comprometido DERIVADO + #participantes. Una sola pasada.
 */
export async function listGroupBuysWithDetail(
  supabase: SupabaseClient,
): Promise<GroupBuyDetail[]> {
  const { data: gbData } = await supabase
    .from("club_group_buys")
    .select(GB_COLS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const groupBuys = (gbData ?? []) as ClubGroupBuy[];
  if (groupBuys.length === 0) return [];

  const gbIds = groupBuys.map((g) => g.id);

  const { data: pData } = await supabase
    .from("club_group_buy_participants")
    .select(P_COLS)
    .in("group_buy_id", gbIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const participants = (pData ?? []) as ClubGroupBuyParticipant[];
  const memberIds = Array.from(new Set(participants.map((p) => p.member_id)));

  // member_id → { person_id, plan }
  const memberMeta = new Map<string, { person_id: string; plan: string }>();
  if (memberIds.length > 0) {
    const { data: mData } = await supabase
      .from("club_members")
      .select("id, person_id, plan")
      .in("id", memberIds);
    for (const m of (mData ?? []) as { id: string; person_id: string; plan: string }[]) {
      memberMeta.set(m.id, { person_id: m.person_id, plan: m.plan });
    }
  }

  const personIds = Array.from(
    new Set(Array.from(memberMeta.values()).map((m) => m.person_id)),
  );
  const personById = new Map<string, { name: string; national_id: string | null }>();
  if (personIds.length > 0) {
    const { data: persData } = await supabase
      .from("persons")
      .select("id, name, national_id")
      .in("id", personIds);
    for (const p of (persData ?? []) as {
      id: string;
      name: string;
      national_id: string | null;
    }[]) {
      personById.set(p.id, { name: p.name, national_id: p.national_id });
    }
  }

  const participantsByGb = new Map<string, ParticipantRow[]>();
  for (const p of participants) {
    const meta = memberMeta.get(p.member_id);
    const person = meta ? personById.get(meta.person_id) : undefined;
    const row: ParticipantRow = {
      ...p,
      member_name: person?.name ?? "—",
      member_national_id: person?.national_id ?? null,
      member_plan: meta?.plan ?? "—",
    };
    const arr = participantsByGb.get(p.group_buy_id) ?? [];
    arr.push(row);
    participantsByGb.set(p.group_buy_id, arr);
  }

  return groupBuys.map((g) => {
    const rows = participantsByGb.get(g.id) ?? [];
    const committed = rows.reduce(
      (sum, r) =>
        countsTowardCommitted(r.status) ? sum + (Number(r.estimated_cbm) || 0) : sum,
      0,
    );
    return {
      ...g,
      committed_cbm: Math.round(committed * 1000) / 1000,
      participants_count: rows.length,
      participants: rows,
    };
  });
}

/** KPIs de la pestaña Compras grupales. */
export async function groupBuyStats(supabase: SupabaseClient): Promise<GroupBuyStats> {
  const details = await listGroupBuysWithDetail(supabase);
  let abiertas = 0;
  let enConsolidacion = 0;
  let cbmAbierto = 0;
  for (const g of details) {
    if (g.status === "abierta") {
      abiertas += 1;
      cbmAbierto += g.committed_cbm;
    } else if (g.status === "en_consolidacion") {
      enConsolidacion += 1;
    }
  }
  return {
    abiertas,
    enConsolidacion,
    cbmAbierto: Math.round(cbmAbierto * 1000) / 1000,
  };
}

/**
 * Miembros del Club vivos, pickeables para sumar a una ronda (D5). Ordenados por
 * nombre. RLS scope-a por tenant.
 */
export async function listEligibleMembers(
  supabase: SupabaseClient,
): Promise<EligibleMember[]> {
  const { data: members } = await supabase
    .from("club_members")
    .select("id, person_id, plan")
    .is("deleted_at", null);

  const rows = (members ?? []) as { id: string; person_id: string; plan: string }[];
  if (rows.length === 0) return [];

  const personIds = Array.from(new Set(rows.map((r) => r.person_id)));
  const personById = new Map<string, { name: string; national_id: string | null }>();
  const { data: persData } = await supabase
    .from("persons")
    .select("id, name, national_id")
    .in("id", personIds);
  for (const p of (persData ?? []) as {
    id: string;
    name: string;
    national_id: string | null;
  }[]) {
    personById.set(p.id, { name: p.name, national_id: p.national_id });
  }

  return rows
    .map((r) => {
      const person = personById.get(r.person_id);
      return {
        member_id: r.id,
        person_name: person?.name ?? "—",
        national_id: person?.national_id ?? null,
        plan: r.plan,
      };
    })
    .sort((a, b) => a.person_name.localeCompare(b.person_name, "es"));
}

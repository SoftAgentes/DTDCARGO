/**
 * Queries del Portal · Club DTD (SDD-0116, Slice E — read-only V1). El miembro del
 * portal ve SOLO lo suyo, vía las policies de portal de la migr 0187:
 *   · su PROPIA membresía (club_members, scope por persona).
 *   · las compras grupales ABIERTAS de su tenant (si es miembro ACTIVO).
 *   · SOLO sus PROPIAS participaciones (privacidad: no ve a otros miembros).
 *
 * El aislamiento lo fuerza RLS (no este código). Igual que portal-academy-queries,
 * NO importa `@/lib/studio` (frontera): los labels viven acá, duplicados a propósito.
 * Devuelve no-miembro / vacío ante error o sin sesión de portal (no lanza).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Labels locales (frontera: el portal no importa lib/studio) ──
const PLAN_LABEL: Record<string, string> = {
  comunidad: "Comunidad",
  importador: "Importador",
  mayorista: "Mayorista",
};
const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  interesado: "Interesado",
  confirmado: "Confirmado",
  retirado: "Retirado",
};

/** Etiqueta legible del plan del Club (espejo de planLabel del Studio). */
export function planLabel(plan: string): string {
  return PLAN_LABEL[plan] ?? plan;
}

export interface PortalClubMembership {
  plan: string;
  status: string;
  joinedAt: string;
}

export interface PortalClubParticipation {
  status: string;
  statusLabel: string;
  estimatedCbm: number | null;
}

export interface PortalClubGroupBuy {
  id: string;
  title: string;
  summary: string | null;
  closesAt: string | null;
  targetCbm: number | null;
  origin: string | null;
  destination: string | null;
  /** La participación de ESTE miembro en la ronda, o null si no participa. */
  myParticipation: PortalClubParticipation | null;
}

export interface PortalClub {
  /** Miembro = tiene una membresía viva (alta del Studio, SDD-0116 Slice A). */
  isMember: boolean;
  membership: PortalClubMembership | null;
  openGroupBuys: PortalClubGroupBuy[];
}

type MemberRow = { id: string; plan: string; status: string; joined_at: string };
type GroupBuyRow = {
  id: string;
  title: string;
  summary: string | null;
  closes_at: string | null;
  target_cbm: number | null;
  origin: string | null;
  destination: string | null;
};
type ParticipationRow = {
  group_buy_id: string;
  status: string;
  estimated_cbm: number | null;
};

/**
 * Estado del Club del miembro del portal: su membresía (plan + estado + alta), las
 * compras grupales abiertas que puede ver, y su participación en cada una. Todo
 * scope-ado por RLS de portal (0187). No-miembro / vacío ante error o sin sesión.
 */
export async function getPortalClub(supabase: SupabaseClient): Promise<PortalClub> {
  const { data: member } = await supabase
    .from("club_members")
    .select("id, plan, status, joined_at")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<MemberRow>();

  if (!member) return { isMember: false, membership: null, openGroupBuys: [] };

  const membership: PortalClubMembership = {
    plan: member.plan,
    status: member.status,
    joinedAt: member.joined_at,
  };

  // Rondas abiertas visibles (RLS: solo si es miembro ACTIVO) + mis participaciones.
  const [gbRes, partRes] = await Promise.all([
    supabase
      .from("club_group_buys")
      .select("id, title, summary, closes_at, target_cbm, origin, destination")
      .eq("status", "abierta")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("club_group_buy_participants")
      .select("group_buy_id, status, estimated_cbm")
      .is("deleted_at", null),
  ]);

  const myPartByGb = new Map<string, ParticipationRow>();
  for (const p of (partRes.data ?? []) as ParticipationRow[]) {
    myPartByGb.set(p.group_buy_id, p);
  }

  const openGroupBuys: PortalClubGroupBuy[] = ((gbRes.data ?? []) as GroupBuyRow[]).map(
    (g) => {
      const part = myPartByGb.get(g.id);
      return {
        id: g.id,
        title: g.title,
        summary: g.summary,
        closesAt: g.closes_at,
        targetCbm: g.target_cbm,
        origin: g.origin,
        destination: g.destination,
        myParticipation: part
          ? {
              status: part.status,
              statusLabel: PARTICIPANT_STATUS_LABEL[part.status] ?? part.status,
              estimatedCbm: part.estimated_cbm,
            }
          : null,
      };
    },
  );

  return { isMember: true, membership, openGroupBuys };
}

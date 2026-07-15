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
const EVENT_MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  online: "Online",
};
const REGISTRATION_STATUS_LABEL: Record<string, string> = {
  inscrito: "Inscrito",
  asistio: "Asististe",
  no_asistio: "No asististe",
};
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

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

export interface PortalClubEvent {
  id: string;
  name: string;
  summary: string | null;
  modalityLabel: string;
  place: string | null;
  startsAt: string | null;
  /** El estado de la inscripción de ESTE miembro, o null si no está inscrito. */
  myRegistrationLabel: string | null;
}

export interface PortalFeaturedSupplier {
  supplierName: string;
  periodLabel: string;
  category: string | null;
  blurb: string | null;
}

export interface PortalClub {
  /** Miembro = tiene una membresía viva (alta del Studio, SDD-0116 Slice A). */
  isMember: boolean;
  membership: PortalClubMembership | null;
  openGroupBuys: PortalClubGroupBuy[];
  /** Eventos del Club próximos/recientes visibles al miembro (Slice C.2 wiring). */
  events: PortalClubEvent[];
  /** Proveedor del mes publicado más reciente (Slice D), o null. */
  featuredSupplier: PortalFeaturedSupplier | null;
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
type EventRow = {
  id: string;
  name: string;
  summary: string | null;
  modality: string;
  place: string | null;
  starts_at: string | null;
};
type RegistrationRow = { event_id: string; status: string };
type SupplierRow = {
  supplier_name: string;
  period: string;
  category: string | null;
  blurb: string | null;
};

/** Etiqueta legible del período YYYY-MM (ej. "julio 2026"). */
function periodLabelLocal(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return period;
  return `${MESES_LARGOS[month - 1]} ${m[1]}`;
}

/**
 * Chequeo barato: ¿este cliente es miembro del Club? Solo para gatear la visibilidad
 * de "Club" en el nav del portal (founder 2026-07-01: Club NO es visible por defecto —
 * aparece solo si el cliente está habilitado). Selecciona una sola fila/columna; el
 * aislamiento lo fuerza RLS de portal (0187). false ante error o sin sesión (no lanza).
 * TODO(club-admin): sumar un flag de módulo activo por tenant cuando exista el admin del Club.
 */
export async function isPortalClubMember(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from("club_members")
    .select("id")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  return Boolean(data);
}

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

  if (!member) {
    return {
      isMember: false,
      membership: null,
      openGroupBuys: [],
      events: [],
      featuredSupplier: null,
    };
  }

  const membership: PortalClubMembership = {
    plan: member.plan,
    status: member.status,
    joinedAt: member.joined_at,
  };

  // Rondas abiertas visibles (RLS: solo si es miembro ACTIVO) + mis participaciones
  // + eventos del Club (0235) + mis inscripciones + proveedor del mes publicado.
  const [gbRes, partRes, evRes, regRes, supRes] = await Promise.all([
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
    supabase
      .from("academy_cohorts")
      .select("id, name, summary, modality, place, starts_at")
      .eq("context", "club")
      .neq("status", "completado")
      .is("deleted_at", null)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("club_event_registrations")
      .select("event_id, status")
      .is("deleted_at", null),
    supabase
      .from("club_featured_suppliers")
      .select("supplier_name, period, category, blurb")
      .eq("status", "publicado")
      .is("deleted_at", null)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle<SupplierRow>(),
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

  // Eventos + mi inscripción por evento (RLS: solo mis inscripciones).
  const myRegByEvent = new Map<string, string>();
  for (const r of (regRes.data ?? []) as RegistrationRow[]) {
    myRegByEvent.set(r.event_id, r.status);
  }
  const events: PortalClubEvent[] = ((evRes.data ?? []) as EventRow[]).map((e) => {
    const regStatus = myRegByEvent.get(e.id);
    return {
      id: e.id,
      name: e.name,
      summary: e.summary,
      modalityLabel: EVENT_MODALITY_LABEL[e.modality] ?? e.modality,
      place: e.place,
      startsAt: e.starts_at,
      myRegistrationLabel: regStatus ? REGISTRATION_STATUS_LABEL[regStatus] ?? regStatus : null,
    };
  });

  const sup = supRes.data;
  const featuredSupplier: PortalFeaturedSupplier | null = sup
    ? {
        supplierName: sup.supplier_name,
        periodLabel: periodLabelLocal(sup.period),
        category: sup.category,
        blurb: sup.blurb,
      }
    : null;

  return { isMember: true, membership, openGroupBuys, events, featuredSupplier };
}

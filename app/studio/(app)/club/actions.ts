"use server";

/**
 * Server actions del Club DTD (SDD-0116, Slice A · membresía).
 *
 * Patrón del Studio: "use server" + gate `moduleEditDenial` (backstop server-side
 * de RBAC, SDD-0085) + validación manual con los `validate*Input()` de
 * lib/studio/club/club-member-types (NO Zod) + resolución de tenant desde
 * user_tenants (RLS lo fuerza igual) + revalidatePath.
 *
 * La PERSONA del miembro se ubica/crea por cédula reusando el camino de la
 * Academia (SDD-0107: resolvePersonForEnrollment) — una sola identidad por cédula
 * en el repo. D1: ser miembro de la Academia es el gate de elegibilidad; acá NO
 * bloquea el alta (es un aviso al operador).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getStudioRole, moduleEditDenial } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import {
  findPersonByCedula,
  getPersonCargoMarkbox,
  resolvePersonForEnrollment,
} from "@/lib/studio/academia/queries";
import { isPersonAcademyMember } from "@/lib/studio/club/club-member-queries";
import {
  isValidStudentCi,
  normalizeCedula,
  validateClubMemberInput,
  validateClubMemberEditInput,
  type ClubMemberActionState,
  type ClubMemberEditInput,
  type ClubMemberInput,
} from "@/lib/studio/club/club-member-types";
import {
  GROUP_BUY_STATUSES,
  validateGroupBuyInput,
  validateParticipantInput,
  type GroupBuyActionState,
  type GroupBuyInput,
  type GroupBuyStatus,
  type ParticipantActionState,
  type ParticipantInput,
} from "@/lib/studio/club/group-buy-types";
import {
  validateClubEventInput,
  type ClubEventActionState,
  type ClubEventInput,
} from "@/lib/studio/club/club-event-types";

type Result = { ok?: boolean; error?: string };

const MODULE = "club";

function revalidate(): void {
  revalidatePath("/studio/club");
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

const ALREADY_MEMBER_MSG = "Esa persona ya es miembro del Club.";
const BAD_MARKBOX_MSG = "Ese Shipping Mark no es un cliente válido del tenant.";

// ════════════════════════════════════════════════════════════════
// Alta de miembro
// ════════════════════════════════════════════════════════════════

export async function createClubMemberAction(
  raw: Partial<ClubMemberInput>,
): Promise<ClubMemberActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateClubMemberInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos del miembro inválidos." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Ubicar o crear (lazy, deduplicado por cédula normalizada) la persona del
  // miembro. Sin persona anclable no hay membresía (D1: el miembro ES una persona).
  const resolved = await resolvePersonForEnrollment(supabase, tenantId, {
    studentCi: input.ci,
    studentName: input.name,
    studentEmail: input.email,
  });
  if (!resolved) {
    return { fieldErrors: { ci: "No se pudo anclar la cédula a una persona." } };
  }

  const isAcademyMember = await isPersonAcademyMember(supabase, resolved.personId);

  const { data: row, error } = await supabase
    .from("club_members")
    .insert({
      tenant_id: tenantId,
      person_id: resolved.personId,
      client_markbox: input.clientMarkbox,
      plan: input.plan,
      status: input.status,
      source: input.source,
      notes: input.notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !row) {
    if (error?.code === "23505") return { error: ALREADY_MEMBER_MSG };
    // El trigger same-tenant rechaza un client_markbox de otro tenant / inexistente.
    if (error?.code === "23514" || error?.message?.includes("client_markbox")) {
      return { fieldErrors: { clientMarkbox: BAD_MARKBOX_MSG } };
    }
    return { error: `No se pudo crear el miembro: ${error?.message ?? "desconocido"}` };
  }

  revalidate();
  return {
    ok: true,
    createdId: row.id,
    person: {
      created: resolved.created,
      name: resolved.name,
      cargoMarkbox: resolved.cargoMarkbox,
      isAcademyMember,
    },
  };
}

// ════════════════════════════════════════════════════════════════
// Edición (la persona no cambia)
// ════════════════════════════════════════════════════════════════

export async function updateClubMemberAction(
  memberId: string,
  raw: Partial<ClubMemberEditInput>,
): Promise<ClubMemberActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!memberId) return { error: "Falta el miembro a editar." };
  const { input, fieldErrors } = validateClubMemberEditInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos del miembro inválidos." };

  const { error } = await supabase
    .from("club_members")
    .update({
      plan: input.plan,
      status: input.status,
      client_markbox: input.clientMarkbox,
      source: input.source,
      notes: input.notes,
    })
    .eq("id", memberId)
    .is("deleted_at", null);

  if (error) {
    if (error.code === "23514" || error.message?.includes("client_markbox")) {
      return { fieldErrors: { clientMarkbox: BAD_MARKBOX_MSG } };
    }
    return { error: `No se pudo actualizar el miembro: ${error.message}` };
  }
  revalidate();
  return { ok: true, createdId: memberId };
}

// ════════════════════════════════════════════════════════════════
// Baja (soft delete)
// ════════════════════════════════════════════════════════════════

export async function softDeleteClubMemberAction(memberId: string): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!memberId) return { error: "Falta el miembro." };

  const { error } = await supabase
    .from("club_members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", memberId)
    .is("deleted_at", null);

  if (error) return { error: `No se pudo dar de baja al miembro: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════
// Lookup en vivo de la cédula (UX del drawer)
// ════════════════════════════════════════════════════════════════

/**
 * SDD-0107 (mejora UX): lookup en vivo de la cédula ANTES de dar de alta. El
 * drawer lo llama on-blur del campo cédula para avisar si ese humano ya está en
 * el sistema (ya es cliente DTD-NNNN / ya es alumno de Academia) o si será alta
 * nueva. SOLO LECTURA: no crea persona ni membresía.
 */
export async function lookupMemberCiAction(rawCi: string): Promise<{
  status: "invalid" | "empty" | "existing" | "new";
  /** Presente si status = "existing". */
  match?: {
    name: string;
    cargoMarkbox: string | null;
    isAcademyMember: boolean;
    normalized: string;
  };
  normalized?: string;
}> {
  const supabase = await createClient();
  const role = await getStudioRole(supabase);
  if (!canAccessModule(role, MODULE)) return { status: "empty" };

  const trimmed = (rawCi ?? "").trim();
  if (!trimmed) return { status: "empty" };
  if (!isValidStudentCi(trimmed)) return { status: "invalid" };

  const normalized = normalizeCedula(trimmed);
  const person = await findPersonByCedula(supabase, trimmed);
  if (!person) return { status: "new", normalized };

  const [cargoMarkbox, isAcademyMember] = await Promise.all([
    getPersonCargoMarkbox(supabase, person.id),
    isPersonAcademyMember(supabase, person.id),
  ]);
  return {
    status: "existing",
    normalized,
    match: { name: person.name, cargoMarkbox, isAcademyMember, normalized },
  };
}

// ════════════════════════════════════════════════════════════════
// Slice B · Compra grupal (rondas de consolidación comunitaria)
// ════════════════════════════════════════════════════════════════

const GB_SLUG_TAKEN_MSG = "Ya existe una compra grupal con ese slug. Usa otro.";

export async function createGroupBuyAction(
  raw: Partial<GroupBuyInput>,
): Promise<GroupBuyActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateGroupBuyInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos de la compra grupal inválidos." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: row, error } = await supabase
    .from("club_group_buys")
    .insert({
      tenant_id: tenantId,
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      status: input.status,
      closes_at: input.closesAt,
      target_cbm: input.targetCbm,
      origin: input.origin,
      destination: input.destination,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !row) {
    if (error?.code === "23505") return { fieldErrors: { slug: GB_SLUG_TAKEN_MSG } };
    return { error: `No se pudo crear la compra grupal: ${error?.message ?? "desconocido"}` };
  }
  revalidate();
  return { ok: true, createdId: row.id };
}

export async function updateGroupBuyAction(
  groupBuyId: string,
  raw: Partial<GroupBuyInput>,
): Promise<GroupBuyActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!groupBuyId) return { error: "Falta la compra grupal a editar." };
  const { input, fieldErrors } = validateGroupBuyInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos de la compra grupal inválidos." };

  const { error } = await supabase
    .from("club_group_buys")
    .update({
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      status: input.status,
      closes_at: input.closesAt,
      target_cbm: input.targetCbm,
      origin: input.origin,
      destination: input.destination,
    })
    .eq("id", groupBuyId)
    .is("deleted_at", null);

  if (error) {
    if (error.code === "23505") return { fieldErrors: { slug: GB_SLUG_TAKEN_MSG } };
    return { error: `No se pudo actualizar la compra grupal: ${error.message}` };
  }
  revalidate();
  return { ok: true, createdId: groupBuyId };
}

/**
 * Cambia el estado de la ronda y, opcionalmente, la liga a una consolidación real
 * (SDD-0047) al cerrarla (en_consolidacion). El trigger same-tenant valida que la
 * consolidación sea del mismo tenant; no movemos dinero acá (D7).
 */
export async function setGroupBuyStatusAction(args: {
  groupBuyId: string;
  status: GroupBuyStatus;
  consolidationId?: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  const { groupBuyId, status } = args;
  if (!groupBuyId) return { error: "Falta la compra grupal." };
  if (!GROUP_BUY_STATUSES.includes(status)) return { error: "Estado inválido." };

  const patch: Record<string, unknown> = { status };
  // Solo tocamos consolidation_id si viene en los args (undefined = no tocar).
  if (args.consolidationId !== undefined) {
    patch.consolidation_id = args.consolidationId || null;
  }

  const { error } = await supabase
    .from("club_group_buys")
    .update(patch)
    .eq("id", groupBuyId)
    .is("deleted_at", null);

  if (error) {
    if (error.code === "23514" || error.message?.includes("consolidation_id")) {
      return { error: "Esa consolidación no es válida para este tenant." };
    }
    return { error: `No se pudo cambiar el estado: ${error.message}` };
  }
  revalidate();
  return { ok: true };
}

export async function softDeleteGroupBuyAction(groupBuyId: string): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!groupBuyId) return { error: "Falta la compra grupal." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("club_group_buys")
    .update({ deleted_at: now })
    .eq("id", groupBuyId)
    .is("deleted_at", null);

  if (error) return { error: `No se pudo eliminar la compra grupal: ${error.message}` };

  // Propaga el soft-delete a los participantes vivos de la ronda (higiene de
  // datos: no dejar participaciones "vivas" colgando de una ronda muerta). RLS
  // scope-a por tenant; si falla, la ronda ya quedó dada de baja (no la mostramos).
  await supabase
    .from("club_group_buy_participants")
    .update({ deleted_at: now })
    .eq("group_buy_id", groupBuyId)
    .is("deleted_at", null);

  revalidate();
  return { ok: true };
}

// ── Participantes (intención de volumen · D5 solo miembros · D7 sin dinero) ──

const ALREADY_PARTICIPATING_MSG = "Ese miembro ya participa en esta compra grupal.";
const BAD_PARTICIPANT_REF_MSG =
  "El miembro o la compra grupal no son válidos para este tenant.";

export async function addParticipantAction(
  groupBuyId: string,
  raw: Partial<ParticipantInput>,
): Promise<ParticipantActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!groupBuyId) return { error: "Falta la compra grupal." };
  const { input, fieldErrors } = validateParticipantInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos del participante inválidos." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Solo se suman miembros a una ronda ABIERTA (no a cerrada/completada/cancelada).
  const { data: gb } = await supabase
    .from("club_group_buys")
    .select("status")
    .eq("id", groupBuyId)
    .is("deleted_at", null)
    .maybeSingle<{ status: string }>();
  if (!gb) return { error: "Esa compra grupal no existe o fue eliminada." };
  if (gb.status !== "abierta") {
    return { error: "Solo puedes sumar miembros a una ronda abierta." };
  }

  const { data: row, error } = await supabase
    .from("club_group_buy_participants")
    .insert({
      tenant_id: tenantId,
      group_buy_id: groupBuyId,
      member_id: input.memberId,
      estimated_cbm: input.estimatedCbm,
      estimated_value_usd: input.estimatedValueUsd,
      status: input.status,
      note: input.note,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !row) {
    if (error?.code === "23505") return { error: ALREADY_PARTICIPATING_MSG };
    if (error?.code === "23514" || error?.message?.includes("member_id") || error?.message?.includes("group_buy_id")) {
      return { error: BAD_PARTICIPANT_REF_MSG };
    }
    return { error: `No se pudo sumar al participante: ${error?.message ?? "desconocido"}` };
  }
  revalidate();
  return { ok: true, participantId: row.id };
}

export async function updateParticipantAction(
  participantId: string,
  raw: Partial<ParticipantInput>,
): Promise<ParticipantActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!participantId) return { error: "Falta el participante." };
  const { input, fieldErrors } = validateParticipantInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos del participante inválidos." };

  // member_id no se cambia en edición (cambiar de miembro = retirar + sumar otro).
  const { error } = await supabase
    .from("club_group_buy_participants")
    .update({
      estimated_cbm: input.estimatedCbm,
      estimated_value_usd: input.estimatedValueUsd,
      status: input.status,
      note: input.note,
    })
    .eq("id", participantId)
    .is("deleted_at", null);

  if (error) return { error: `No se pudo actualizar el participante: ${error.message}` };
  revalidate();
  return { ok: true, participantId };
}

export async function removeParticipantAction(participantId: string): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!participantId) return { error: "Falta el participante." };

  const { error } = await supabase
    .from("club_group_buy_participants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", participantId)
    .is("deleted_at", null);

  if (error) return { error: `No se pudo quitar al participante: ${error.message}` };
  revalidate();
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════
// Slice C · Eventos del Club (D9: reusan academy_cohorts, context='club')
// ════════════════════════════════════════════════════════════════
// Los eventos viven en academy_cohorts con context='club' y course_id=null. Las
// actions filtran context='club' al editar/borrar para NO tocar cohortes de curso.

export async function createClubEventAction(
  raw: Partial<ClubEventInput>,
): Promise<ClubEventActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateClubEventInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos del evento inválidos." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: row, error } = await supabase
    .from("academy_cohorts")
    .insert({
      tenant_id: tenantId,
      context: "club",
      course_id: null, // evento standalone del Club
      name: input.name,
      summary: input.summary,
      modality: input.modality,
      place: input.place,
      starts_at: input.startsAt,
      facilitator_name: input.facilitatorName,
      status: input.status,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !row) {
    return { error: `No se pudo crear el evento: ${error?.message ?? "desconocido"}` };
  }
  revalidate();
  return { ok: true, createdId: row.id };
}

export async function updateClubEventAction(
  eventId: string,
  raw: Partial<ClubEventInput>,
): Promise<ClubEventActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!eventId) return { error: "Falta el evento a editar." };
  const { input, fieldErrors } = validateClubEventInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos del evento inválidos." };

  // context='club' protege de tocar cohortes de Academia por id forjado.
  const { error } = await supabase
    .from("academy_cohorts")
    .update({
      name: input.name,
      summary: input.summary,
      modality: input.modality,
      place: input.place,
      starts_at: input.startsAt,
      facilitator_name: input.facilitatorName,
      status: input.status,
    })
    .eq("id", eventId)
    .eq("context", "club")
    .is("deleted_at", null);

  if (error) return { error: `No se pudo actualizar el evento: ${error.message}` };
  revalidate();
  return { ok: true, createdId: eventId };
}

export async function softDeleteClubEventAction(eventId: string): Promise<Result> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, MODULE);
  if (denial) return { error: denial };

  if (!eventId) return { error: "Falta el evento." };

  const { error } = await supabase
    .from("academy_cohorts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("context", "club")
    .is("deleted_at", null);

  if (error) return { error: `No se pudo eliminar el evento: ${error.message}` };
  revalidate();
  return { ok: true };
}

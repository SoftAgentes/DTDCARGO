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

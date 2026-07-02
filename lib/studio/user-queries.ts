/**
 * Queries del módulo Usuarios & Roles (SDD-0024 Fase 1).
 *
 * Solo LECTURA. Las mutaciones van por RPCs (studio_invite_user,
 * studio_accept_invitation, studio_change_user_role) que se llaman
 * desde server actions en Fase 2.
 *
 * RLS filtra automáticamente:
 *   - user_tenants: el user ve su row + (si es admin) ve todos del tenant
 *   - user_profiles: todos los authenticated ven todos los perfiles
 *   - user_invitations: por tenant
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InvitationStatus,
  StudioUserRole,
  TenantAdvisorOption,
  UserInvitation,
  UserKpis,
  UserMembershipWithProfile,
  UserProfile,
  UserTenantMembership,
} from "./user-types";

const EMPTY_KPIS: UserKpis = {
  totalMembers: 0,
  activeMembers: 0,
  pendingInvitations: 0,
  adminsCount: 0,
};

// ─── Members ────────────────────────────────────────────────

export interface ListMembersFilters {
  /**
   * Filter explícito por tenant_id. **Obligatorio**: el caller suele usar
   * service_role / admin client (que bypassea RLS y vería miembros de
   * TODOS los tenants). Volverlo requerido evita el footgun de omitirlo y
   * filtrar cross-tenant. Con el client regular RLS ya filtra, pero
   * pasarlo igual es defensa en profundidad.
   */
  tenantId: string;
  role?: StudioUserRole;
  includeDisabled?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Lista miembros del tenant del user logueado.
 *
 * Devuelve membership + profile embebido + email. El email viene de
 * `auth.users` que NO es accesible vía RLS estándar — se resuelve
 * por separado con `supabase.auth.admin.getUserById` (requiere
 * service_role) o se denormaliza en user_profiles si crece la demanda.
 *
 * V1: usamos el RPC interno o un VIEW. Para mantenerlo simple, V1
 * trae solo membership + profile, y el email se completa server-side
 * en la page con un fetch separado a auth.admin (cuando llegue Fase 2).
 *
 * Por ahora esta query devuelve los rows con `email = ''` placeholder
 * — la page de Fase 2 hace el join real.
 */
export async function listMembers(
  supabase: SupabaseClient,
  filters: ListMembersFilters,
): Promise<UserMembershipWithProfile[]> {
  let q = supabase
    .from("user_tenants")
    .select(
      "user_id, tenant_id, role, disabled_at, last_login_at, invited_by, created_at, profile:user_profiles(*)",
    )
    .order("created_at", { ascending: false });

  // Filtro por tenant SIEMPRE aplicado (tenantId es requerido). Con admin
  // client esto es lo único que evita ver miembros de otros tenants.
  q = q.eq("tenant_id", filters.tenantId);
  if (filters.role) q = q.eq("role", filters.role);
  if (!filters.includeDisabled) q = q.is("disabled_at", null);

  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) return [];

  // El email lo dejamos vacío en Fase 1; Fase 2 hace fetch a auth.admin
  // server-side y lo merge. El search en Fase 1 filtra solo por
  // first_name/last_name del profile.
  const rows = (data ?? []).map((r) => {
    const row = r as UserMembershipWithProfile & {
      profile: UserProfile | UserProfile[] | null;
    };
    // El embebido viene como objeto único o array según versión del cliente.
    const profile = Array.isArray(row.profile)
      ? (row.profile[0] ?? null)
      : (row.profile ?? null);
    return {
      ...row,
      profile,
      email: "", // resolved server-side in Fase 2
    } as UserMembershipWithProfile;
  });

  if (filters.search) {
    const term = filters.search.toLowerCase();
    return rows.filter((r) => {
      const name = `${r.profile?.first_name ?? ""} ${r.profile?.last_name ?? ""}`.toLowerCase();
      return name.includes(term);
    });
  }
  return rows;
}

/**
 * Asesores asignables a un cliente (ERP→Norte · clients.advisor_id). Todos los
 * miembros ACTIVOS del tenant — cualquier rol puede ser el asesor/account-director
 * de un cliente (el dueño admin atiende VIPs; un comercial, su cartera). Ordenados
 * por nombre. El caller pasa el admin client + tenant_id explícito (la RLS de
 * user_tenants tapa a los no-admin más allá de su propia fila, así que el listado
 * para el selector se resuelve server-side con admin, igual que el resto del módulo).
 */
export async function listTenantAdvisors(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TenantAdvisorOption[]> {
  const { data, error } = await supabase
    .from("user_tenants")
    .select(
      "user_id, role, profile:user_profiles(first_name, last_name, avatar_url, position_label)",
    )
    .eq("tenant_id", tenantId)
    .is("disabled_at", null);

  if (error || !data) return [];

  return data
    .map((r) => {
      const row = r as {
        user_id: string;
        role: StudioUserRole;
        profile: Partial<UserProfile> | Partial<UserProfile>[] | null;
      };
      const profile = Array.isArray(row.profile)
        ? (row.profile[0] ?? null)
        : (row.profile ?? null);
      const name = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        userId: row.user_id,
        name: name || null,
        role: row.role,
        avatarUrl: profile?.avatar_url ?? null,
        positionLabel: profile?.position_label ?? null,
      };
    })
    .sort((a, b) => (a.name ?? "￿").localeCompare(b.name ?? "￿"));
}

export async function getMember(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserMembershipWithProfile | null> {
  const { data, error } = await supabase
    .from("user_tenants")
    .select(
      "user_id, tenant_id, role, disabled_at, last_login_at, invited_by, created_at, profile:user_profiles(*)",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as UserMembershipWithProfile & {
    profile: UserProfile | UserProfile[] | null;
  };
  const profile = Array.isArray(row.profile)
    ? (row.profile[0] ?? null)
    : (row.profile ?? null);
  return { ...row, profile, email: "" };
}

// ─── Profiles ───────────────────────────────────────────────

export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserProfile>();
  if (error) return null;
  return data;
}

// ─── Invitations ────────────────────────────────────────────

export interface ListInvitationsFilters {
  status?: InvitationStatus;
  limit?: number;
  offset?: number;
}

export async function listInvitations(
  supabase: SupabaseClient,
  filters: ListInvitationsFilters = {},
): Promise<UserInvitation[]> {
  let q = supabase
    .from("user_invitations")
    .select("*")
    .order("created_at", { ascending: false });

  // Filtro de status se hace en SQL para los simples; expired
  // se calcula post-fetch porque depende de comparación con now().
  if (filters.status === "pending") {
    q = q.is("accepted_at", null).is("revoked_at", null).gte("expires_at", new Date().toISOString());
  } else if (filters.status === "accepted") {
    q = q.not("accepted_at", "is", null);
  } else if (filters.status === "revoked") {
    q = q.not("revoked_at", "is", null);
  }

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) return [];
  let rows = (data ?? []) as UserInvitation[];

  if (filters.status === "expired") {
    rows = rows.filter(
      (i) =>
        !i.accepted_at &&
        !i.revoked_at &&
        new Date(i.expires_at).getTime() < Date.now(),
    );
  }

  return rows;
}

/**
 * Lookup por token. Usado por el endpoint público /invitar/[token].
 * RLS lo permite porque la policy de SELECT es por tenant — desde el
 * endpoint usamos service_role para bypass y obtener la invitation
 * sin necesidad de saber el tenant todavía.
 */
export async function getInvitationByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<UserInvitation | null> {
  const { data, error } = await supabase
    .from("user_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle<UserInvitation>();
  if (error) return null;
  return data;
}

// ─── KPIs ───────────────────────────────────────────────────

/**
 * KPIs agregados del tenant. Defensivo: si alguna query rompe,
 * devuelve EMPTY_KPIS.
 */
export async function computeUserKpis(
  supabase: SupabaseClient,
  tenantId?: string,
): Promise<UserKpis> {
  const nowIso = new Date().toISOString();

  const total = supabase
    .from("user_tenants")
    .select("user_id", { count: "exact", head: true });
  const active = supabase
    .from("user_tenants")
    .select("user_id", { count: "exact", head: true })
    .is("disabled_at", null);
  const admins = supabase
    .from("user_tenants")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin")
    .is("disabled_at", null);
  const pending = supabase
    .from("user_invitations")
    .select("id", { count: "exact", head: true })
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gte("expires_at", nowIso);

  // Si el caller pasa tenantId, filtramos explícito (necesario cuando se
  // usa admin client que bypassea RLS).
  if (tenantId) {
    total.eq("tenant_id", tenantId);
    active.eq("tenant_id", tenantId);
    admins.eq("tenant_id", tenantId);
    pending.eq("tenant_id", tenantId);
  }

  const [totalResp, activeResp, adminsResp, pendingResp] = await Promise.all([
    total,
    active,
    admins,
    pending,
  ]);

  if (totalResp.error || activeResp.error || adminsResp.error || pendingResp.error) {
    return EMPTY_KPIS;
  }

  return {
    totalMembers: totalResp.count ?? 0,
    activeMembers: activeResp.count ?? 0,
    pendingInvitations: pendingResp.count ?? 0,
    adminsCount: adminsResp.count ?? 0,
  };
}

// ─── Helpers (wrappers de RPCs) ─────────────────────────────

/**
 * Wrapper del RPC studio_invite_user. Devuelve el token + invitation_id
 * o lanza si falla. Server actions llaman este wrapper.
 */
export async function inviteUserRPC(
  supabase: SupabaseClient,
  email: string,
  role: StudioUserRole,
  region: "ve" | "cn" = "ve",
): Promise<{ invitationId: string; token: string }> {
  const { data, error } = await supabase.rpc("studio_invite_user", {
    p_email: email,
    p_role: role,
    p_region: region,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    throw new Error(error?.message ?? "RPC studio_invite_user vacío");
  }
  const row = data[0] as { invitation_id: string; token: string };
  return { invitationId: row.invitation_id, token: row.token };
}

export async function acceptInvitationRPC(
  supabase: SupabaseClient,
  token: string,
  firstName?: string,
  lastName?: string,
): Promise<{ userId: string; tenantId: string; role: StudioUserRole }> {
  const { data, error } = await supabase.rpc("studio_accept_invitation", {
    p_token: token,
    p_first_name: firstName ?? null,
    p_last_name: lastName ?? null,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    throw new Error(error?.message ?? "RPC studio_accept_invitation vacío");
  }
  const row = data[0] as { user_id: string; tenant_id: string; role: StudioUserRole };
  return { userId: row.user_id, tenantId: row.tenant_id, role: row.role };
}

export async function changeUserRoleRPC(
  supabase: SupabaseClient,
  targetUserId: string,
  newRole: StudioUserRole,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("studio_change_user_role", {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * Wrapper del RPC studio_set_user_disabled (migr 0200). Desactiva/reactiva el
 * membership del target en el tenant del caller. El RPC valida admin activo +
 * anti-lockout (no desactivar al último admin) en la DB — el UPDATE directo a
 * user_tenants era un no-op silencioso (sin policy de UPDATE, RLS deny).
 */
export async function setUserDisabledRPC(
  supabase: SupabaseClient,
  targetUserId: string,
  disabled: boolean,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("studio_set_user_disabled", {
    p_target_user_id: targetUserId,
    p_disabled: disabled,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * Wrapper del RPC studio_revoke_invitation (migr 0200). El UPDATE directo a
 * user_invitations estaba bloqueado por `no_direct_update using(false)` →
 * no-op silencioso. El RPC valida admin activo + invitación del tenant.
 */
export async function revokeInvitationRPC(
  supabase: SupabaseClient,
  invitationId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("studio_revoke_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

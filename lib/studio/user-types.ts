/**
 * Types, enums, validators y helpers de label/badge para Usuarios & Roles
 * (SDD-0024 Fase 1). Match con migración 0019_users_roles.sql.
 *
 * Convenciones del proyecto:
 *   - Sin Zod — validate*Input() propios.
 *   - LABELS en castellano-VE.
 *   - badgeTone retorna los 6 tonos oficiales.
 */

// ─── Enums ───────────────────────────────────────────────────

export type StudioUserRole =
  | "admin"
  | "commercial"
  | "operations"
  | "accounting"
  | "warehouse"
  | "support";

export const STUDIO_USER_ROLES: StudioUserRole[] = [
  "admin",
  "commercial",
  "operations",
  "accounting",
  "warehouse",
  "support",
];

// ─── Entity types (match schema 0019) ────────────────────────

export interface UserProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  position_label: string | null;
  locale: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

/** Row de user_tenants — membership del user en el tenant. */
export interface UserTenantMembership {
  user_id: string;
  tenant_id: string;
  role: StudioUserRole;
  disabled_at: string | null;
  last_login_at: string | null;
  invited_by: string | null;
  created_at: string;
}

/**
 * Member con perfil + email embebido — shape para la tabla de Members.
 * Email viene de auth.users (join server-side).
 */
export interface UserMembershipWithProfile extends UserTenantMembership {
  email: string;
  profile: UserProfile | null;
}

export interface UserInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: StudioUserRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
}

// ─── KPIs (computed) ─────────────────────────────────────────

export interface UserKpis {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  adminsCount: number;
}

// ─── Inputs + Action states ──────────────────────────────────

export interface InviteUserInput {
  email: string;
  role: StudioUserRole;
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  phone?: string;
  position_label?: string;
  avatar_url?: string;
  locale?: string;
  timezone?: string;
}

export interface AcceptInvitationInput {
  token: string;
  first_name?: string;
  last_name?: string;
  password: string;
}

export type ActionFieldErrors = Partial<Record<string, string>>;

export interface UserActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: ActionFieldErrors;
  invitationId?: string;
  invitationLink?: string;
  userId?: string;
}

// ─── Validators (sin Zod) ────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export function validateInviteUserInput(
  partial: Partial<InviteUserInput>,
): { input?: InviteUserInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (!partial.email || !isValidEmail(partial.email)) {
    fieldErrors.email = "Email inválido";
  }
  if (!partial.role || !STUDIO_USER_ROLES.includes(partial.role as StudioUserRole)) {
    fieldErrors.role = "Rol inválido";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      email: partial.email!.trim().toLowerCase(),
      role: partial.role as StudioUserRole,
    },
  };
}

export function validateUpdateProfileInput(
  partial: Partial<UpdateProfileInput>,
): { input?: UpdateProfileInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};

  if (partial.first_name !== undefined && partial.first_name.trim().length > 60) {
    fieldErrors.first_name = "Nombre demasiado largo (max 60)";
  }
  if (partial.last_name !== undefined && partial.last_name.trim().length > 60) {
    fieldErrors.last_name = "Apellido demasiado largo (max 60)";
  }
  if (partial.phone !== undefined && partial.phone.trim().length > 30) {
    fieldErrors.phone = "Teléfono demasiado largo";
  }
  if (
    partial.position_label !== undefined &&
    partial.position_label.trim().length > 80
  ) {
    fieldErrors.position_label = "Cargo demasiado largo (max 80)";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      first_name: partial.first_name?.trim() || undefined,
      last_name: partial.last_name?.trim() || undefined,
      phone: partial.phone?.trim() || undefined,
      position_label: partial.position_label?.trim() || undefined,
      avatar_url: partial.avatar_url?.trim() || undefined,
      locale: partial.locale?.trim() || undefined,
      timezone: partial.timezone?.trim() || undefined,
    },
  };
}

export function validateAcceptInvitationInput(
  partial: Partial<AcceptInvitationInput>,
): { input?: AcceptInvitationInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (!partial.token || partial.token.trim().length < 16) {
    fieldErrors.token = "Token inválido";
  }
  if (!partial.password || partial.password.length < 10) {
    fieldErrors.password = "Password mínimo 10 caracteres";
  }
  if (partial.first_name !== undefined && partial.first_name.trim().length > 60) {
    fieldErrors.first_name = "Nombre muy largo";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      token: partial.token!.trim(),
      password: partial.password!,
      first_name: partial.first_name?.trim() || undefined,
      last_name: partial.last_name?.trim() || undefined,
    },
  };
}

// ─── Label helpers (castellano-VE) ───────────────────────────

export const ROLE_LABELS: Record<StudioUserRole, string> = {
  admin: "Admin",
  commercial: "Comercial",
  operations: "Operaciones",
  accounting: "Contabilidad",
  warehouse: "Bodeguero",
  support: "Soporte",
};

export function roleLabel(r: StudioUserRole): string {
  return ROLE_LABELS[r];
}

export const ROLE_DESCRIPTIONS: Record<StudioUserRole, string> = {
  admin: "Acceso total al Studio. Puede invitar / desactivar usuarios y cambiar roles.",
  commercial: "Cotizador, clientes, embarques, CRM. Sin acceso a finanzas ni admin.",
  operations: "Almacén CN/VE, tracking, calendario, TMS, SENIAT. Operación day-to-day.",
  accounting: "Facturación, costing, reportes financieros. Read en operativo.",
  warehouse: "Acceso al almacén asignado (CN o VE). Recepción y despacho.",
  support: "Lectura amplia + crear tickets. Sin permisos de edición V1.",
};

export function roleDescription(r: StudioUserRole): string {
  return ROLE_DESCRIPTIONS[r];
}

// ─── Badge tone (6 tonos oficiales) ──────────────────────────

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

export function roleBadgeTone(r: StudioUserRole): BadgeTone {
  if (r === "admin") return "wine";
  if (r === "commercial") return "info";
  if (r === "operations") return "warning";
  if (r === "accounting") return "success";
  return "neutral"; // warehouse + support
}

// ─── Helpers ─────────────────────────────────────────────────

/** Nombre display: "First Last" o "first.last@email.com" si sin perfil. */
export function userDisplayName(
  profile: UserProfile | null,
  email: string,
): string {
  if (profile?.first_name || profile?.last_name) {
    return [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  }
  return email;
}

/** Iniciales para Avatar component. Max 2 caracteres. */
export function userInitials(
  profile: UserProfile | null,
  email: string,
): string {
  if (profile?.first_name && profile?.last_name) {
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  }
  if (profile?.first_name) {
    return profile.first_name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/** Last login formatted como "hace 2h" / "12 may 14:30" si >24h / "Nunca". */
export function formatLastLogin(iso: string | null): string {
  if (!iso) return "Nunca";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Estado: active / disabled / pending (si es invitation). */
export type MemberStatus = "active" | "disabled";

export function memberStatusBadgeTone(s: MemberStatus): BadgeTone {
  return s === "active" ? "success" : "neutral";
}

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Activo",
  disabled: "Desactivado",
};

export function memberStatusLabel(s: MemberStatus): string {
  return MEMBER_STATUS_LABELS[s];
}

export function memberStatus(m: UserTenantMembership): MemberStatus {
  return m.disabled_at ? "disabled" : "active";
}

// ─── Invitation status ──────────────────────────────────────

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export function invitationStatus(inv: UserInvitation): InvitationStatus {
  if (inv.accepted_at) return "accepted";
  if (inv.revoked_at) return "revoked";
  if (new Date(inv.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  revoked: "Revocada",
  expired: "Expirada",
};

export function invitationStatusLabel(s: InvitationStatus): string {
  return INVITATION_STATUS_LABELS[s];
}

export function invitationStatusBadgeTone(s: InvitationStatus): BadgeTone {
  if (s === "accepted") return "success";
  if (s === "pending") return "warning";
  return "neutral";  // revoked + expired
}

/** Acceptance URL relativa al token. El dominio se prepende en UI. */
export function invitationAcceptPath(token: string): string {
  return `/invitar/${encodeURIComponent(token)}`;
}

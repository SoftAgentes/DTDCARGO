"use server";

/**
 * Server actions de Usuarios & Roles (SDD-0024 Fase 2).
 *
 * Wraps RPCs ya existentes (studio_invite_user, studio_change_user_role)
 * + mutaciones directas para disable / enable / revoke invitation.
 *
 * Pattern useActionState con UserActionState shape.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { sendEmail } from "@/lib/studio/mail/send-email";
import {
  changeUserRoleRPC,
  inviteUserRPC,
  tenantHasOtherAdmins,
} from "@/lib/studio/user-queries";
import {
  ROLE_LABELS,
  invitationAcceptPath,
  validateInviteUserInput,
  type StudioUserRole,
  type UserActionState,
} from "@/lib/studio/user-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ─────────────────────────────────────────────────────────────
// inviteUserAction · crea invitation + devuelve link copy/paste
// ─────────────────────────────────────────────────────────────

export async function inviteUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const partial = {
    email: (formData.get("email") as string | null) ?? undefined,
    role: (formData.get("role") as StudioUserRole | null) ?? undefined,
  };

  const { input, fieldErrors } = validateInviteUserInput(partial);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  try {
    const { invitationId, token } = await inviteUserRPC(
      supabase,
      input.email,
      input.role,
    );
    const link = `${SITE_URL}${invitationAcceptPath(token)}`;

    // SDD-0026 F2: intentar mandar email automáticamente. Si no hay
    // RESEND_API_KEY o falla, NO rompemos la invitación · el admin tiene
    // el link de fallback en la UI para copy/paste manual.
    // Errores se loggean a console.error para ser visibles en Vercel runtime
    // logs sin contaminar el UX del modal.
    try {
      const { data: link2 } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .maybeSingle<{ tenant_id: string }>();
      if (link2?.tenant_id) {
        const supabaseAdmin = createAdminClient();
        const [{ data: inviterProfile }, { data: tenant }] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("first_name, last_name")
            .eq("user_id", userResp.user.id)
            .maybeSingle<{ first_name: string | null; last_name: string | null }>(),
          supabase
            .from("tenants")
            .select("display_name")
            .eq("id", link2.tenant_id)
            .maybeSingle<{ display_name: string }>(),
        ]);
        const inviterName =
          [inviterProfile?.first_name, inviterProfile?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || userResp.user.email || "Un admin";
        const tenantName = tenant?.display_name ?? "DTD-Cargo";

        const sendResult = await sendEmail(supabaseAdmin, link2.tenant_id, {
          templateSlug: "team_invitation",
          to: input.email,
          vars: {
            inviter_name: inviterName,
            tenant_name: tenantName,
            role_label: ROLE_LABELS[input.role],
            invitation_link: link,
            expires_in_days: "7",
          },
          metadata: { source: "inviteUserAction", invitation_id: invitationId },
        });
        if (!sendResult.ok) {
          console.error("[inviteUserAction] sendEmail failed:", sendResult.error);
        }
      }
    } catch (err) {
      console.error("[inviteUserAction] sendEmail exception:", err);
    }

    revalidatePath("/studio/usuarios");
    return {
      ok: true,
      invitationId,
      invitationLink: link,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `No se pudo crear la invitación: ${msg}` };
  }
}

// ─────────────────────────────────────────────────────────────
// changeUserRoleAction · solo admin · anti-lockout en RPC
// ─────────────────────────────────────────────────────────────

export async function changeUserRoleAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  const newRole = formData.get("new_role") as StudioUserRole | null;

  if (!targetUserId) return { error: "Falta el usuario." };
  if (!newRole) return { error: "Falta el rol nuevo." };

  const supabase = await createClient();
  try {
    await changeUserRoleRPC(supabase, targetUserId, newRole);
    revalidatePath("/studio/usuarios");
    return { ok: true, userId: targetUserId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

// ─────────────────────────────────────────────────────────────
// disableUserAction · soft disable (set disabled_at)
// ─────────────────────────────────────────────────────────────

export async function disableUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  if (!targetUserId) return { error: "Falta el usuario." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  // Anti-lockout client-side: no podés desactivarte a vos mismo si sos
  // el último admin. El RPC studio_change_user_role tiene este check; acá
  // lo replicamos para disable (que es semántica distinta).
  if (targetUserId === userResp.user.id) {
    const hasOthers = await tenantHasOtherAdmins(supabase, userResp.user.id);
    if (!hasOthers) {
      return {
        error: "No te podés desactivar a vos mismo si sos el último admin.",
      };
    }
  }

  const { error } = await supabase
    .from("user_tenants")
    .update({ disabled_at: new Date().toISOString() })
    .eq("user_id", targetUserId);

  if (error) {
    if (error.code === "42501") {
      return { error: "Solo admins pueden desactivar usuarios." };
    }
    return { error: error.message };
  }

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: targetUserId };
}

// ─────────────────────────────────────────────────────────────
// enableUserAction · reactivar usuario desactivado
// ─────────────────────────────────────────────────────────────

export async function enableUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  if (!targetUserId) return { error: "Falta el usuario." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_tenants")
    .update({ disabled_at: null })
    .eq("user_id", targetUserId);

  if (error) {
    if (error.code === "42501") {
      return { error: "Solo admins pueden reactivar usuarios." };
    }
    return { error: error.message };
  }

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: targetUserId };
}

// ─────────────────────────────────────────────────────────────
// revokeInvitationAction · marca invitation como revoked
// ─────────────────────────────────────────────────────────────

export async function revokeInvitationAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const invitationId = (formData.get("invitation_id") as string | null)?.trim();
  if (!invitationId) return { error: "Falta el ID de la invitación." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  const { error } = await supabase
    .from("user_invitations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: userResp.user.id,
    })
    .eq("id", invitationId);

  if (error) {
    if (error.code === "42501") {
      return { error: "Solo admins pueden revocar invitaciones." };
    }
    return { error: error.message };
  }

  revalidatePath("/studio/usuarios");
  return { ok: true };
}

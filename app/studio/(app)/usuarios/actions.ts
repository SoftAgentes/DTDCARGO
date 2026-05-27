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
import { generateTelegramLinkCode } from "@/lib/studio/telegram/link-code";
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

// ─────────────────────────────────────────────────────────────
// updateMyProfileAction · UPSERT del user_profile del logueado
//
// Permite que el user de la sesión actualice su first_name + last_name
// + phone. Estos campos aparecen en emails enviados — "Hola Sam Maan"
// en lugar de "Hola hailuway.com@gmail.com". UPSERT por user_id porque
// la row puede no existir si el user nunca tocó su perfil.
// ─────────────────────────────────────────────────────────────

export async function updateMyProfileAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const firstName = ((formData.get("first_name") as string | null) ?? "").trim();
  const lastName = ((formData.get("last_name") as string | null) ?? "").trim();
  const phone = ((formData.get("phone") as string | null) ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (firstName.length > 80) {
    fieldErrors.first_name = "Máximo 80 caracteres";
  }
  if (lastName.length > 80) {
    fieldErrors.last_name = "Máximo 80 caracteres";
  }
  if (phone.length > 40) {
    fieldErrors.phone = "Máximo 40 caracteres";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  // UPDATE (no upsert): row siempre existe por trigger handle_new_user del
  // auth.users → public.user_profiles. Policy user_profiles_no_direct_insert
  // bloquea INSERT desde authenticated, y .upsert() evalúa WITH CHECK del
  // INSERT branch aunque el row exista (Supabase/PostgREST 2026-05).
  const { error } = await supabase
    .from("user_profiles")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userResp.user.id);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: userResp.user.id };
}

// ─────────────────────────────────────────────────────────────
// updateMyPreferencesAction · locale + timezone
//
// Tab Preferencias del ProfileModal. user_profiles ya tiene
// las columnas; solo wireamos.
// ─────────────────────────────────────────────────────────────

const VALID_LOCALES = ["es-VE", "es", "en", "zh"] as const;
type Locale = (typeof VALID_LOCALES)[number];

function parseGeoOrInvalid(raw: string | null): number | null | "invalid" {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return "invalid";
  return n;
}

export async function updateMyPreferencesAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const localeRaw = (formData.get("locale") as string | null) ?? "es-VE";
  const timezone = ((formData.get("timezone") as string | null) ?? "").trim();

  const locale: Locale = (VALID_LOCALES as readonly string[]).includes(localeRaw)
    ? (localeRaw as Locale)
    : "es-VE";

  const fieldErrors: Record<string, string> = {};

  if (timezone.length > 80) {
    fieldErrors.timezone = "Máximo 80 caracteres";
  }

  const latRaw = parseGeoOrInvalid(formData.get("operating_lat") as string | null);
  const lngRaw = parseGeoOrInvalid(formData.get("operating_lng") as string | null);

  if (latRaw === "invalid") {
    fieldErrors.operating_lat = "Latitud inválida.";
  } else if (typeof latRaw === "number" && (latRaw < -90 || latRaw > 90)) {
    fieldErrors.operating_lat = "Latitud fuera de rango (-90..90).";
  }
  if (lngRaw === "invalid") {
    fieldErrors.operating_lng = "Longitud inválida.";
  } else if (typeof lngRaw === "number" && (lngRaw < -180 || lngRaw > 180)) {
    fieldErrors.operating_lng = "Longitud fuera de rango (-180..180).";
  }
  const lat = latRaw === "invalid" ? null : latRaw;
  const lng = lngRaw === "invalid" ? null : lngRaw;
  if ((lat === null) !== (lng === null)) {
    fieldErrors.operating_lat ??= "Cargá lat y lng juntos.";
    fieldErrors.operating_lng ??= "Cargá lat y lng juntos.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  // UPDATE (no upsert): mismo patrón que updateMyProfileAction para evitar
  // el INSERT branch bloqueado por user_profiles_no_direct_insert.
  const { error } = await supabase
    .from("user_profiles")
    .update({
      locale,
      timezone: timezone || "America/Caracas",
      operating_lat: lat,
      operating_lng: lng,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userResp.user.id);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  return { ok: true, userId: userResp.user.id };
}

// ─────────────────────────────────────────────────────────────
// Telegram link flow (SDD-0036 Fase 5 follow-up)
//
// 1. User toca "Conectar Telegram" → linkTelegramAccountAction()
//    genera link_code random, lo guarda en user_profile, devuelve el code
// 2. UI muestra "t.me/{BOT_USERNAME}?start={code}"
// 3. User abre el link · webhook /api/telegram/webhook recibe /start {code}
//    → setea telegram_chat_id + telegram_username + clear link_code
// 4. unlinkTelegramAccountAction() borra el chat_id (canal apagado)
// ─────────────────────────────────────────────────────────────

export async function linkTelegramAccountAction(): Promise<{
  ok?: boolean;
  linkCode?: string;
  botUsername?: string | null;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  // Generar code unique (retry hasta 5x si choca con índice unique)
  let linkCode: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTelegramLinkCode();
    const { error } = await supabase
      .from("user_profiles")
      .update({
        telegram_link_code: candidate,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userResp.user.id);
    if (!error) {
      linkCode = candidate;
      break;
    }
    if (!error || !String(error.message).includes("duplicate")) {
      // Otro tipo de error · no es colisión de code
      return { error: `No se pudo generar el código: ${error.message}` };
    }
    // Colisión · reintentar
  }

  if (!linkCode) {
    return { error: "No se pudo generar un código único. Reintentá." };
  }

  return {
    ok: true,
    linkCode,
    botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null,
  };
}

export async function unlinkTelegramAccountAction(): Promise<{
  ok?: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  const { error } = await supabase
    .from("user_profiles")
    .update({
      telegram_chat_id: null,
      telegram_username: null,
      telegram_link_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userResp.user.id);

  if (error) {
    return { error: `No se pudo desconectar: ${error.message}` };
  }

  revalidatePath("/studio");
  return { ok: true };
}

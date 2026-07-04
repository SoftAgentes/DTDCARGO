"use server";

/**
 * Server actions de Usuarios & Roles (SDD-0024 Fase 2 · hardening 0200).
 *
 * TODAS las mutaciones de membership van por RPCs security definer
 * (studio_invite_user, studio_change_user_role, studio_set_user_disabled,
 * studio_revoke_invitation): user_tenants/user_invitations NO tienen policies
 * de escritura para authenticated, así que un UPDATE directo con el client del
 * user era un no-op silencioso (0 filas, sin error) — hallazgo auditoría
 * 2026-07-02.
 *
 * Pattern useActionState con UserActionState shape.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { generateTelegramLinkCode } from "@/lib/studio/telegram/link-code";
import {
  changeUserRoleRPC,
  inviteUserRPC,
  revokeInvitationRPC,
  setUserDisabledRPC,
  setUserWarehouseScopeRPC,
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
  // Region (oficina): la única decisión que toma el admin para derivar
  // locale + timezone + moneda del invitee. Default 've'. Valida el RPC.
  const regionRaw = (formData.get("region") as string | null) ?? "ve";
  const region: "ve" | "cn" = regionRaw === "cn" ? "cn" : "ve";

  const { input, fieldErrors } = validateInviteUserInput(partial);
  if (fieldErrors) return { fieldErrors, errorCode: "field_errors_present" };
  if (!input) return { errorCode: "invalid_input" };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "user_signin_required" };

  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };

  // Guard: si el email ya es miembro del tenant (activo o desactivado), la
  // invitación es un callejón sin salida — el accept no puede completarse con
  // un auth user existente (y menos baneado). El camino es Reactivar / cambiar
  // rol en la tabla (hallazgo review 2026-07-02). Best-effort: sin admin client
  // se sigue y el RPC valida lo que puede.
  try {
    const { data: myLink } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .maybeSingle<{ tenant_id: string }>();
    if (myLink?.tenant_id) {
      const admin = createAdminClient();
      const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
      const existing = authUsers?.users.find(
        (u) => u.email?.toLowerCase() === input.email,
      );
      if (existing) {
        const { data: membership } = await admin
          .from("user_tenants")
          .select("disabled_at")
          .eq("user_id", existing.id)
          .eq("tenant_id", myLink.tenant_id)
          .maybeSingle<{ disabled_at: string | null }>();
        if (membership) {
          return {
            error: membership.disabled_at
              ? "Ese email pertenece a un usuario desactivado. Usa «Reactivar» en la tabla — una invitación nueva no puede completarse."
              : "Ese email ya es miembro del equipo. Cambia su rol en la tabla si hace falta.",
          };
        }
      }
    }
  } catch (err) {
    console.error("[inviteUserAction] member-guard skipped:", err);
  }

  try {
    const { invitationId, token } = await inviteUserRPC(
      supabase,
      input.email,
      input.role,
      region,
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
        const tenantName = tenant?.display_name ?? "DTD Cargo";

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

  if (!targetUserId) return { errorCode: "invalid_input" };
  if (!newRole) return { errorCode: "user_role_invalid" };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };
  try {
    await changeUserRoleRPC(supabase, targetUserId, newRole);
    revalidatePath("/studio/usuarios");
    return { ok: true, userId: targetUserId };
  } catch (err) {
    // Errores del RPC (anti-lockout, permisos, etc.) vienen como string ya
    // formateado en Postgres. Los pasamos como `error` legacy en lugar de
    // intentar mapearlos a errorCode — son contextuales.
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

// ─────────────────────────────────────────────────────────────
// changeWarehouseScopeAction · vía RPC studio_set_user_warehouse_scope
// (migr 0202 · SDD-0139). Asigna el lado de la operación (cn | ve | all)
// que ve el usuario — solo restringe módulos de almacén para no-admin.
// ─────────────────────────────────────────────────────────────

export async function changeWarehouseScopeAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  const scopeRaw = (formData.get("new_scope") as string | null)?.trim();

  if (!targetUserId) return { errorCode: "invalid_input" };
  if (scopeRaw !== "cn" && scopeRaw !== "ve" && scopeRaw !== "all") {
    return { errorCode: "invalid_input" };
  }

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };

  try {
    await setUserWarehouseScopeRPC(supabase, targetUserId, scopeRaw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: targetUserId };
}

// ─────────────────────────────────────────────────────────────
// disableUserAction / enableUserAction · vía RPC studio_set_user_disabled
// (migr 0200) + ban/unban en Supabase Auth.
//
// El RPC valida admin activo + anti-lockout (no desactivar al último admin,
// cubre auto-desactivación) EN LA DB. El ban en Auth mata la sesión viva del
// desactivado (el corte de data ya lo garantiza la RLS vía get_user_tenant_id
// con filtro disabled_at); si el admin client no está disponible, se loggea y
// se sigue — el ban es cinturón, la RLS es el freno.
// ─────────────────────────────────────────────────────────────

/** Duración de ban ≈ permanente (GoTrue parsea Go durations; 100 años). */
const BAN_FOREVER = "876000h";

/** true si el ban/unban quedó aplicado en Auth. Nunca lanza. */
async function setAuthBan(targetUserId: string, banned: boolean): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: banned ? BAN_FOREVER : "none",
    });
    if (error) {
      console.error("[setAuthBan] updateUserById failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[setAuthBan] admin client unavailable:", err);
    return false;
  }
}

export async function disableUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  if (!targetUserId) return { errorCode: "invalid_input" };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "user_signin_required" };

  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };

  try {
    await setUserDisabledRPC(supabase, targetUserId, true);
  } catch (err) {
    // Errores del RPC (anti-lockout, permisos) vienen formateados de Postgres.
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }

  await setAuthBan(targetUserId, true);

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: targetUserId };
}

export async function enableUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  if (!targetUserId) return { errorCode: "invalid_input" };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };

  // Al REACTIVAR el orden se invierte respecto a disable: el unban es REQUISITO
  // (sin él, el usuario queda "Activo" en DB pero baneado 100 años en Auth y la
  // UI mentiría con "ok" — hallazgo review 2026-07-02). Unban primero: si falla,
  // no tocamos la DB y el admin reintenta desde un estado consistente. Si el
  // unban pasa y el RPC falla, el user sigue disabled en DB → RLS lo frena.
  const unbanned = await setAuthBan(targetUserId, false);
  if (!unbanned) {
    return {
      error:
        "No se pudo quitar el bloqueo de inicio de sesión (Auth). No se reactivó nada — reintenta.",
    };
  }

  try {
    await setUserDisabledRPC(supabase, targetUserId, false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: targetUserId };
}

// ─────────────────────────────────────────────────────────────
// revokeInvitationAction · vía RPC studio_revoke_invitation (migr 0200).
// El UPDATE directo estaba bloqueado por `no_direct_update using(false)` →
// no-op silencioso que la UI reportaba como éxito.
// ─────────────────────────────────────────────────────────────

export async function revokeInvitationAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const invitationId = (formData.get("invitation_id") as string | null)?.trim();
  if (!invitationId) return { error: "Falta el ID de la invitación." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };

  try {
    await revokeInvitationRPC(supabase, invitationId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
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
  if (!userResp.user) return { error: "Inicia sesión primero." };

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
    fieldErrors.operating_lat ??= "Carga lat y lng juntos.";
    fieldErrors.operating_lng ??= "Carga lat y lng juntos.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

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

  // Preferencias de notificación (SDD-0036 Fase 5) · upsert de la fila del
  // user SOLO si el form incluyó la sección (hidden `notif_section`). Se
  // upsertean únicamente las columnas que maneja esta pantalla — los
  // channel_push/push_subscription/telegram_chat_id los administran sus
  // propias secciones y se preservan on-conflict (no van en el SET).
  if (formData.has("notif_section")) {
    const on = (k: string) => formData.get(k) !== null;
    const { error: prefErr } = await supabase
      .from("user_notification_prefs")
      .upsert(
        {
          user_id: userResp.user.id,
          channel_inapp: on("channel_inapp"),
          channel_email: on("channel_email"),
          channel_telegram: on("channel_telegram"),
          notify_on_state_change: on("notify_on_state_change"),
          notify_on_admin_reply: on("notify_on_admin_reply"),
          notify_on_resolved: on("notify_on_resolved"),
          notify_on_critical: on("notify_on_critical"),
          sound_enabled: on("sound_enabled"),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (prefErr) {
      return {
        error: `No se pudieron guardar las notificaciones: ${prefErr.message}`,
      };
    }
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
  if (!userResp.user) return { error: "Inicia sesión primero." };

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
    return { error: "No se pudo generar un código único. Reintenta." };
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
  if (!userResp.user) return { error: "Inicia sesión primero." };

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

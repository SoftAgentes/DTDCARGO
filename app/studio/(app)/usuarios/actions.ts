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
import {
  d1Reason,
  executeD1Operation,
} from "@/lib/studio/audit/d1-access-config-adapters";
import { executeAuthLifecycle } from "@/lib/studio/audit/auth-lifecycle-adapter";
import {
  beginD5ExternalEffect,
  finishD5ExternalEffect,
} from "@/lib/studio/audit/external-effect-adapter";
import { randomBytes } from "node:crypto";
import {
  accessTokenExpiry,
  accessTokenPath,
} from "@/lib/studio/access-token";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { generateTelegramLinkCode } from "@/lib/studio/telegram/link-code";
import {
  ROLE_LABELS,
  invitationAcceptPath,
  isValidEmail,
  validateInviteUserInput,
  type StudioUserRole,
  type UserActionState,
} from "@/lib/studio/user-types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Secreto del enlace de acceso (SDD-0250 · migr 0354). 24 bytes = 192 bits →
 * 48 caracteres hex, dentro del CHECK de la tabla.
 *
 * Vive ACÁ y no en `lib/studio/access-token.ts` porque ese módulo lo importa un
 * componente cliente, y `node:crypto` en el bundle del navegador rompe el build
 * entero ("Reading from node:crypto is not handled by plugins"). Este archivo
 * es "use server", así que acá sí corresponde.
 */
function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

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
    const operation = await executeD1Operation(supabase, {
      operationType: "membership.invite",
      input: {
        email: input.email,
        role: input.role,
        region,
      },
    });
    if (!operation.invitation_id || !operation.token) {
      return { error: "La invitación no devolvió su comprobante." };
    }
    const invitationId = operation.invitation_id;
    const token = operation.token;
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
    await executeD1Operation(supabase, {
      operationType: "membership.role_change",
      targetId: targetUserId,
      input: { role: newRole },
    });
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
    await executeD1Operation(supabase, {
      operationType: "membership.scope_change",
      targetId: targetUserId,
      input: { scope: scopeRaw },
    });
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

  const result = await executeAuthLifecycle(
    supabase,
    createAdminClient().auth.admin,
    {
      targetUserId,
      disabled: true,
      reason: d1Reason(
        formData.get("reason"),
        "Suspensión solicitada desde Usuarios",
      ),
    },
  );
  if (!result.ok) {
    return {
      error:
        result.code === "auth_retryable"
          ? "Auth no respondió. La intención quedó registrada para reintento."
          : result.code === "compensated"
            ? "Auth cambió, pero la confirmación falló y el cambio fue compensado."
            : result.code === "reconciliation_required"
              ? "El estado quedó incierto y requiere reconciliación administrativa."
              : "No se pudo completar la suspensión.",
    };
  }

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

  const result = await executeAuthLifecycle(
    supabase,
    createAdminClient().auth.admin,
    {
      targetUserId,
      disabled: false,
      reason: d1Reason(
        formData.get("reason"),
        "Reactivación solicitada desde Usuarios",
      ),
    },
  );
  if (!result.ok) {
    return {
      error:
        result.code === "auth_retryable"
          ? "Auth no respondió. La intención quedó registrada para reintento."
          : result.code === "compensated"
            ? "Auth cambió, pero la confirmación falló y el cambio fue compensado."
            : result.code === "reconciliation_required"
              ? "El estado quedó incierto y requiere reconciliación administrativa."
              : "No se pudo completar la reactivación.",
    };
  }

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: targetUserId };
}

// ─────────────────────────────────────────────────────────────
// sendAccessLinkAction · repone el acceso de un miembro que YA existe
// (SDD-0250 · migr 0350).
//
// Cubre el hueco que dejaba fuera a 5 de 7 usuarios: `inviteUserAction`
// rechaza a propósito a quien ya es miembro (una invitación sobre un auth
// user existente es un callejón sin salida), y no había ninguna otra vía —
// la única era un UPDATE a mano sobre auth.users.
//
// Va por el carril D5 de EFECTOS EXTERNOS y no por el D1 de mutaciones:
// esto no escribe nada en `public`, genera un enlace contra Supabase Auth y
// manda un correo.
//
// `generateLink` NO envía el correo, devuelve el enlace — lo mandamos
// nosotros con sendEmail para que pase por las plantillas del tenant,
// mail_logs y Resend (el correo nativo de Supabase tiene plantillas aparte
// y límites de envío bajos). Y devolvemos el link a la UI para copiar a
// mano si el correo no llega, igual que hace la invitación.
// ─────────────────────────────────────────────────────────────

export async function sendAccessLinkAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  if (!targetUserId) return { errorCode: "invalid_input" };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "user_signin_required" };

  // Gate REAL: `users` es admin-only (matriz []). Va antes de tocar el admin
  // client — una server action es invocable como endpoint desde cualquier ruta.
  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };

  const { data: myLink } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!myLink?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const admin = createAdminClient();

  // El destinatario tiene que ser miembro ACTIVO de MI tenant. Sin esto, un
  // admin podría dispararle un enlace a un usuario de otro tenant pasando su
  // id — el admin client no filtra por RLS.
  const { data: membership } = await admin
    .from("user_tenants")
    .select("disabled_at")
    .eq("user_id", targetUserId)
    .eq("tenant_id", myLink.tenant_id)
    .maybeSingle<{ disabled_at: string | null }>();
  if (!membership) {
    return { error: "Esa persona no es miembro de este equipo." };
  }
  if (membership.disabled_at) {
    return {
      error:
        "Ese usuario está desactivado. Reactívalo primero — un enlace de acceso no lo dejaría entrar.",
    };
  }

  const { data: targetUser } = await admin.auth.admin.getUserById(targetUserId);
  const targetEmail = targetUser?.user?.email;
  if (!targetEmail) {
    return { error: "Ese usuario no tiene correo cargado en su cuenta." };
  }

  let operationId: string;
  try {
    operationId = await beginD5ExternalEffect(
      supabase,
      "studio.access_link",
      targetUserId,
    );
  } catch {
    return { error: "No se pudo registrar la operación. Reintenta." };
  }

  // Token PROPIO (migr 0354), no el de recuperación de Supabase.
  //
  // El de Supabase se canjea al ABRIR el enlace, y eso lo mataba siempre: el
  // escáner de correo del destinatario abre los enlaces del mensaje apenas
  // llega y consumía el token de un solo uso antes de que la persona hiciera
  // clic. Medido el 2026-08-06: con envío de correo el token moría en menos de
  // 37 s sin que nadie lo tocara; sin envío seguía vivo.
  //
  // El nuestro se consume en el POST del formulario (`/acceso/[token]`), así
  // que abrirlo mil veces no le hace nada. Va en la RUTA, no en la query, para
  // sobrevivir el copiar/pegar y WhatsApp.
  //
  // NO anulamos los enlaces anteriores del usuario a propósito: con el de
  // Supabase, generar uno nuevo mataba el viejo en silencio y el admin mandaba
  // dos que ya no servían. Todos los vigentes funcionan hasta usarse o vencer.
  const token = generateAccessToken();
  const { error: tokenErr } = await admin.from("studio_access_tokens").insert({
    tenant_id: myLink.tenant_id,
    user_id: targetUserId,
    token,
    created_by: userResp.user.id,
    expires_at: accessTokenExpiry(),
  });

  if (tokenErr) {
    await finishD5ExternalEffect(supabase, operationId, {
      ok: false,
      errorCode: "token_insert_failed",
    });
    console.error("[sendAccessLinkAction] insert token:", tokenErr.message);
    return { error: "No se pudo generar el enlace de acceso. Reintenta." };
  }

  const accessLink = `${SITE_URL}${accessTokenPath(token)}`;

  // El correo es best-effort: si falla, el admin tiene el enlace en pantalla
  // para pasarlo por otro canal. Por eso el efecto se cierra como OK — el
  // enlace SÍ se generó y es utilizable.
  try {
    const [{ data: senderProfile }, { data: targetProfile }, { data: tenant }] =
      await Promise.all([
        supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("user_id", userResp.user.id)
          .maybeSingle<{ first_name: string | null; last_name: string | null }>(),
        admin
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("user_id", targetUserId)
          .maybeSingle<{ first_name: string | null; last_name: string | null }>(),
        supabase
          .from("tenants")
          .select("display_name")
          .eq("id", myLink.tenant_id)
          .maybeSingle<{ display_name: string }>(),
      ]);

    const senderName =
      [senderProfile?.first_name, senderProfile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || userResp.user.email || "Un admin";
    const targetName =
      [targetProfile?.first_name, targetProfile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || targetEmail;

    const sendResult = await sendEmail(admin, myLink.tenant_id, {
      templateSlug: "studio_access_link",
      to: targetEmail,
      vars: {
        user_name: targetName,
        tenant_name: tenant?.display_name ?? "DTD Cargo",
        access_link: accessLink,
        sender_name: senderName,
      },
      metadata: { source: "sendAccessLinkAction", target_user_id: targetUserId },
    });
    if (!sendResult.ok) {
      console.error("[sendAccessLinkAction] sendEmail failed:", sendResult.error);
    }
  } catch (err) {
    console.error("[sendAccessLinkAction] sendEmail exception:", err);
  }

  await finishD5ExternalEffect(supabase, operationId, { ok: true });

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: targetUserId, accessLink };
}

// ─────────────────────────────────────────────────────────────
// updateMemberProfileAction · un admin edita la ficha de OTRA persona
// (SDD-0250 · ficha de usuario).
//
// Distinto de updateMyProfileAction, que sólo toca el perfil de quien está
// logueado. Sin esto no había forma de cargarle el cargo a nadie: los 8
// miembros del equipo tienen `position_label` vacío desde el alta, y por eso
// "gerente" no figura en ningún lado del sistema.
//
// Va por el admin client porque las policies de user_profiles no le dan a
// `authenticated` un UPDATE sobre filas ajenas (y está bien que no se lo den).
// El gate real es moduleEditDenial sobre `users`, que es admin-only.
// ─────────────────────────────────────────────────────────────

export async function updateMemberProfileAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  if (!targetUserId) return { errorCode: "invalid_input" };

  const firstName = ((formData.get("first_name") as string | null) ?? "").trim();
  const lastName = ((formData.get("last_name") as string | null) ?? "").trim();
  const phone = ((formData.get("phone") as string | null) ?? "").trim();
  const positionLabel = ((formData.get("position_label") as string | null) ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (firstName.length > 80) fieldErrors.first_name = "Máximo 80 caracteres";
  if (lastName.length > 80) fieldErrors.last_name = "Máximo 80 caracteres";
  if (phone.length > 40) fieldErrors.phone = "Máximo 40 caracteres";
  if (positionLabel.length > 80) fieldErrors.position_label = "Máximo 80 caracteres";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "user_signin_required" };

  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };

  const { data: myLink } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!myLink?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const admin = createAdminClient();

  // El objetivo tiene que ser miembro de MI tenant. El admin client no filtra
  // por RLS, así que sin este chequeo un admin podría editarle el perfil a
  // alguien de otro tenant pasando su id (mismo criterio que sendAccessLink).
  const { data: membership } = await admin
    .from("user_tenants")
    .select("user_id")
    .eq("user_id", targetUserId)
    .eq("tenant_id", myLink.tenant_id)
    .maybeSingle<{ user_id: string }>();
  if (!membership) {
    return { error: "Esa persona no es miembro de este equipo." };
  }

  const { error } = await admin
    .from("user_profiles")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      position_label: positionLabel || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", targetUserId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/studio/usuarios");
  return { ok: true, userId: targetUserId };
}

// ─────────────────────────────────────────────────────────────
// changeMemberEmailAction · un admin CORRIGE el correo de otra persona
//
// SDD-0272 · migr 0387. Es la corrección de una dirección mal cargada, NO la
// sucesión de un puesto: el `user_id` NO cambia, así que todo lo que ya está
// registrado sigue siendo de la MISMA persona.
//
// ⚠️ SI SE VA ALEJANDRO Y ENTRA PEDRO, ESTE NO ES EL GESTO. Todo el rastro del
// ERP se guarda contra `user_id` (append_audit_event, created_by de facturas y
// embarques), no contra el correo. Reescribirle el correo a la fila haría que
// cada factura y cada evento que registró Alejandro apareciera, hacia atrás y
// en silencio, como hecho por Pedro. La sucesión es: desactivar a quien se va +
// invitar a quien llega; lo que se hereda es el rol y el alcance, que con
// SDD-0252 viven por rol y no por persona. Ver §Sucesión de la spec.
//
// "Desactivar el correo anterior" = revocar lo que ese buzón todavía podría
// usar para FABRICAR una sesión nueva: enlaces de acceso vigentes (migr 0354) e
// invitaciones pendientes (migr 0019). Las sesiones YA abiertas no se tumban:
// `admin.signOut` de @supabase/auth-js exige el JWT de la persona, que un admin
// no tiene (medido 2026-08-19 sobre 2.106.1). Para cortar sesiones existe
// "Suspender acceso", que sí banea. Ver §"Lo que NO revoca" de la spec.
// ─────────────────────────────────────────────────────────────

export async function changeMemberEmailAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const targetUserId = (formData.get("target_user_id") as string | null)?.trim();
  if (!targetUserId) return { errorCode: "invalid_input" };

  const nuevoEmail = ((formData.get("new_email") as string | null) ?? "")
    .trim()
    .toLowerCase();
  if (!isValidEmail(nuevoEmail)) {
    return { fieldErrors: { new_email: "Correo inválido" } };
  }

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "user_signin_required" };

  // Gate REAL antes de tocar el admin client: `users` es admin-only (matriz
  // []), y una server action es invocable como endpoint desde cualquier ruta.
  const denial = await moduleEditDenial(supabase, "users");
  if (denial) return { error: denial };

  const { data: myLink } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!myLink?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const admin = createAdminClient();

  // La persona objetivo tiene que ser miembro de MI tenant — el admin client no
  // filtra por RLS (mismo criterio que sendAccessLink y updateMemberProfile).
  const { data: membership } = await admin
    .from("user_tenants")
    .select("user_id")
    .eq("user_id", targetUserId)
    .eq("tenant_id", myLink.tenant_id)
    .maybeSingle<{ user_id: string }>();
  if (!membership) {
    return { error: "Esa persona no es miembro de este equipo." };
  }

  const { data: targetUser } = await admin.auth.admin.getUserById(targetUserId);
  const emailAnterior = targetUser?.user?.email?.toLowerCase() ?? null;
  if (!emailAnterior) {
    return { error: "Ese usuario no tiene correo cargado en su cuenta." };
  }

  // Sin cambio real → no se toca nada. Revocarle los enlaces a alguien por
  // guardar el formulario sin editarlo sería un corte de acceso gratis.
  if (emailAnterior === nuevoEmail) {
    return { ok: true, userId: targetUserId };
  }

  let operationId: string;
  try {
    operationId = await beginD5ExternalEffect(
      supabase,
      "studio.email_change",
      targetUserId,
    );
  } catch {
    return { error: "No se pudo registrar la operación. Reintenta." };
  }

  // 1. El cambio va PRIMERO. Si Auth lo rechaza no se revocó nada y la persona
  //    sigue entrando con lo que tenía.
  const { error: authErr } = await admin.auth.admin.updateUserById(
    targetUserId,
    // `email_confirm: true` deja el correo usable de una: sin esto Supabase
    // abre un cambio PENDIENTE que exige confirmar desde el buzón, y el buzón
    // nuevo puede no ser accesible todavía (o el viejo ya no serlo).
    { email: nuevoEmail, email_confirm: true },
  );

  if (authErr) {
    await finishD5ExternalEffect(supabase, operationId, {
      ok: false,
      errorCode: "auth_update_failed",
    });
    const msg = authErr.message ?? "";
    if (/already|registered|exists|duplicate/i.test(msg)) {
      return {
        error:
          "Ese correo ya pertenece a otra cuenta. Si es la misma persona duplicada, desactiva la cuenta vieja antes de reusar el correo.",
      };
    }
    return { error: `No se pudo cambiar el correo: ${msg}` };
  }

  // 2 y 3. Revocar lo que el buzón ANTERIOR todavía podría canjear. Best-effort
  //    con log: el correo ya cambió (que es lo que el admin pidió) y volver
  //    atrás sería peor que dejar el rastro del fallo parcial.
  const ahora = new Date().toISOString();

  const { error: tokenErr } = await admin
    .from("studio_access_tokens")
    .update({ revoked_at: ahora })
    .eq("user_id", targetUserId)
    .is("used_at", null)
    .is("revoked_at", null);
  if (tokenErr) {
    console.error("[changeMemberEmailAction] revocar tokens falló:", tokenErr);
  }

  const { error: inviteErr } = await admin
    .from("user_invitations")
    .update({ revoked_at: ahora, revoked_by: userResp.user.id })
    .eq("tenant_id", myLink.tenant_id)
    .eq("email", emailAnterior)
    .is("accepted_at", null)
    .is("revoked_at", null);
  if (inviteErr) {
    console.error(
      "[changeMemberEmailAction] revocar invitaciones falló:",
      inviteErr,
    );
  }

  await finishD5ExternalEffect(supabase, operationId, { ok: true });

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
    await executeD1Operation(supabase, {
      operationType: "membership.invitation_revoke",
      targetId: invitationId,
      reason: d1Reason(
        formData.get("reason"),
        "Revocación solicitada desde Usuarios",
      ),
    });
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
          notify_on_portal_message: on("notify_on_portal_message"),
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
    try {
      await executeD1Operation(supabase, {
        operationType: "notification_channel.link",
        targetId: userResp.user.id,
        input: { link_code: candidate },
      });
      linkCode = candidate;
      break;
    } catch {
      // Una colisión del código o fallo transitorio revierte toda la operación.
      // Reintentamos con un valor nuevo sin persistir el código en auditoría.
    }
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

  try {
    await executeD1Operation(supabase, {
      operationType: "notification_channel.unlink",
      targetId: userResp.user.id,
    });
  } catch {
    return { error: "No se pudo desconectar Telegram." };
  }

  revalidatePath("/studio");
  return { ok: true };
}

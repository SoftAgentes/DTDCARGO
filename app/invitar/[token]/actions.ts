"use server";

/**
 * Server action de aceptación de invitación (SDD-0024 Fase 2).
 *
 * Flujo:
 *   1. Validar inputs (token + password + nombre opcional)
 *   2. Resolver invitation con admin client (bypass RLS)
 *   3. Crear user en auth.users con email_confirm=true (admin)
 *   4. Sign in con la nueva cuenta (server client con cookies)
 *   5. Llamar studio_accept_invitation RPC para asignar al tenant
 *   6. Retornar OK → page redirige a /studio/dashboard
 *
 * Errores manejados:
 *   - email ya existe en auth → "ya tenés cuenta, andá a /studio/login"
 *   - invitation no encontrada/aceptada/revocada/expirada
 *   - tu propio invite no podés aceptar (anti auto-aceptación · RPC checkea)
 */

import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { emailIlikePattern, sameEmail } from "@/lib/shared/email-literal";
import {
  validateAcceptInvitationInput,
  type UserActionState,
} from "@/lib/studio/user-types";

export async function acceptInvitationFormAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const partial = {
    token: (formData.get("token") as string | null) ?? undefined,
    password: (formData.get("password") as string | null) ?? undefined,
    first_name: (formData.get("first_name") as string | null) ?? undefined,
    last_name: (formData.get("last_name") as string | null) ?? undefined,
  };

  const { input, fieldErrors } = validateAcceptInvitationInput(partial);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return {
      error: "Servicio no disponible · admin client no configurado.",
    };
  }

  // 1. Resolver invitation
  const { data: invitation } = await supabaseAdmin
    .from("user_invitations")
    .select("id, email, role, accepted_at, revoked_at, expires_at, invited_by, tenant_id")
    .eq("token", input.token)
    .maybeSingle<{
      id: string;
      email: string;
      role: string;
      accepted_at: string | null;
      revoked_at: string | null;
      expires_at: string;
      invited_by: string;
      tenant_id: string;
    }>();

  if (!invitation) {
    return { error: "Invitación no encontrada." };
  }
  if (invitation.accepted_at) {
    return { error: "Esta invitación ya fue aceptada." };
  }
  if (invitation.revoked_at) {
    return { error: "Esta invitación fue revocada." };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { error: "Esta invitación expiró." };
  }

  // 2. Crear el user en auth (con email_confirm=true para evitar paso extra)
  const { data: createResp, error: createErr } =
    await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        tenant: "dtd-cargo", // para que el trigger de vault auto-cree row si aplica
      },
    });

  // Email puede ya existir (user que se invita a sí mismo, o ya tiene cuenta)
  if (createErr) {
    const msg = createErr.message ?? String(createErr);
    if (msg.toLowerCase().includes("already") || msg.includes("registered")) {
      return {
        error:
          "Ese email ya tiene cuenta. Inicia sesión en /studio/login y un admin te puede dar acceso manualmente.",
      };
    }
    return { error: `No se pudo crear la cuenta: ${msg}` };
  }
  if (!createResp?.user) {
    return { error: "No se pudo crear la cuenta (sin error pero sin user)." };
  }

  // 3. Sign in con la nueva cuenta para tener sesión cookie
  const supabaseUser = await createClient();
  const { error: signInErr } = await supabaseUser.auth.signInWithPassword({
    email: invitation.email,
    password: input.password,
  });
  if (signInErr) {
    return {
      error: `Cuenta creada pero login automático falló: ${signInErr.message}. Intenta login manual.`,
    };
  }

  // 4. Aceptar la invitation via RPC (con cliente autenticado)
  const { error: acceptErr } = await supabaseUser.rpc("studio_accept_invitation", {
    p_token: input.token,
    p_first_name: input.first_name ?? null,
    p_last_name: input.last_name ?? null,
  });
  if (acceptErr) {
    return {
      error: `Cuenta creada pero no se pudo asignar al tenant: ${acceptErr.message}. Contacta al admin.`,
    };
  }

  // 5. SDD-0140: si esta persona también tiene ficha de empleado en el mismo
  // tenant (alta unificada desde Nómina), enlaza su login recién creado con la
  // ficha (nomina_employees.auth_user_id). Best-effort: solo rellena cuando aún
  // no hay enlace y el email coincide — nunca pisa uno existente. No rompe el
  // accept si falla (el vínculo es conveniencia, no requisito del acceso).
  //
  // SDD-0600 · se leen primero las filas: un `.update` con `.ilike` enlazaba también a
  // un parecido (`a_b@` alcanza a `a.b@`), y `app/m/emp` le abre a quien queda enlazado
  // los recibos de esa ficha. `*` no se puede escapar (ver `email-literal.ts`).
  try {
    const { data: fichas } = await supabaseAdmin
      .from("nomina_employees")
      .select("id, email")
      .eq("tenant_id", invitation.tenant_id)
      .is("auth_user_id", null)
      .is("deleted_at", null)
      .ilike("email", emailIlikePattern(invitation.email));
    const ids = (fichas ?? [])
      .filter((ficha) => sameEmail(ficha.email, invitation.email))
      .map((ficha) => ficha.id);
    if (ids.length > 0) {
      await supabaseAdmin
        .from("nomina_employees")
        .update({ auth_user_id: createResp.user.id })
        .eq("tenant_id", invitation.tenant_id)
        .is("auth_user_id", null)
        .in("id", ids);
    }
  } catch (err) {
    console.error("[acceptInvitation] employee link skipped:", err);
  }

  return { ok: true, userId: createResp.user.id };
}

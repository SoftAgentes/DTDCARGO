"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { lookupEmailByMarkbox } from "@/lib/portal/portal-queries";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export type PortalLoginState = {
  error?: string;
  sent?: boolean;
  /** Email al que se mandó el enlace (para el mensaje de confirmación). */
  email?: string;
};

/**
 * Pide un magic-link de Supabase Auth para entrar al portal.
 *
 * Pre-check (best-effort, con service_role): solo mandamos el enlace a emails
 * que ya tienen el portal habilitado (`client_users` invited/active). Así NO
 * creamos auth.users de cualquiera y damos un mensaje claro a quien no está
 * habilitado. Si el service_role no está disponible, seguimos igual — el
 * callback (`portal_bind_session`) valida el vínculo de todos modos.
 */
export async function requestMagicLink(
  _prev: PortalLoginState,
  formData: FormData,
): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length < 5) {
    return { error: "Ingresá un email válido." };
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("client_users")
      .select("id")
      .ilike("email", email)
      .in("status", ["invited", "active"])
      .limit(1)
      .maybeSingle();
    if (!data) {
      return {
        error:
          "Ese email todavía no tiene el portal habilitado. Pídele a tu asesor que te invite — o regístrate si eres nuevo.",
      };
    }
  } catch {
    // sin SUPABASE_SERVICE_ROLE_KEY → saltamos el pre-check (degradación elegante)
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${SITE_URL}/portal/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { error: "No pudimos enviar el enlace ahora. Probá de nuevo en un rato." };
  }

  return { sent: true, email };
}

// ── Login MARKBOX + contraseña (SDD-0042 Fase 6 · slice 10.2, método primario) ──

export type PortalPasswordLoginState = {
  error?: string;
  /** Se pidió reset de contraseña con éxito (mensaje "revisa tu correo"). */
  resetSent?: boolean;
};

/**
 * Resuelve el email del cliente a partir de su MARKBOX (admin client, bypass RLS:
 * el lookup es pre-sesión). Delega en la query pura `lookupEmailByMarkbox`. Si el
 * admin client no está configurado, devuelve null → error genérico.
 */
async function emailForMarkbox(markbox: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    return await lookupEmailByMarkbox(admin, markbox);
  } catch {
    return null;
  }
}

/**
 * Login con MARKBOX + contraseña. Lookup email por markbox → signInWithPassword
 * (setea las cookies SSR vía el server client, igual que el resto del portal).
 * Errores GENÉRICOS: no revelamos si el MARKBOX existe ni si la clave es la que
 * falla. La página redirige a `/portal` cuando `ok`.
 */
export async function loginWithMarkbox(
  _prev: PortalPasswordLoginState,
  formData: FormData,
): Promise<PortalPasswordLoginState> {
  const markbox = String(formData.get("markbox") ?? "").trim().toUpperCase();
  const password = String(formData.get("password") ?? "");

  if (!markbox || !password) {
    return { error: "Ingresá tu MARKBOX y tu contraseña." };
  }

  const email = await emailForMarkbox(markbox);
  // Mensaje único para "no existe" y "clave incorrecta" (anti-enumeración).
  const GENERIC = "MARKBOX o contraseña incorrectos.";
  if (!email) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: GENERIC };

  // Éxito: cookies SSR seteadas → al portal. `redirect` lanza NEXT_REDIRECT
  // (lo maneja el framework; no es un error de la action).
  redirect("/portal");
}

/**
 * "¿Olvidaste tu contraseña?" — manda un email de recuperación al correo del
 * MARKBOX. Responde SIEMPRE con éxito (no revela si el MARKBOX existe); si no hay
 * match, simplemente no se manda nada.
 */
export async function resetPasswordByMarkbox(
  _prev: PortalPasswordLoginState,
  formData: FormData,
): Promise<PortalPasswordLoginState> {
  const markbox = String(formData.get("markbox") ?? "").trim().toUpperCase();
  if (!markbox) {
    return { error: "Ingresá tu MARKBOX para recuperar la contraseña." };
  }

  const email = await emailForMarkbox(markbox);
  if (email) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/portal/callback`,
    });
  }
  // Siempre "enviado" — no revelamos si el MARKBOX existe.
  return { resetSent: true };
}

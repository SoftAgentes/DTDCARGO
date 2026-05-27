"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

export type SignInState = {
  error?: string;
};

/**
 * Login del back. Server action gating-fuerte:
 *
 * 1. Valida campos no vacíos.
 * 2. Intenta signInWithPassword contra Supabase Auth.
 * 3. Si la auth es OK, verifica que el user tenga al menos 1 rol back en
 *    su tenant. Si no tiene rol → signOut + error. Esto previene que un
 *    user válido del Studio (sin rol back) reciba una cookie de sesión y
 *    pueda navegar /back creyendo que está autorizado.
 * 4. Si todo OK → redirect a /back (dashboard).
 *
 * No revelamos en el error si el email existe o no, para no facilitar
 * enumeration attacks.
 */
export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios." };
  }

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return { error: "Credenciales incorrectas o cuenta no autorizada." };
  }

  // Sesión OK. Ahora verificar rol back ANTES de dejar entrar.
  const { data: rolesData } = await supabase
    .from("back_user_roles")
    .select("role");

  if (!rolesData || rolesData.length === 0) {
    // User válido pero sin rol back → cerrar la sesión para no dejar
    // cookie zombie. Mostrar mensaje claro.
    await supabase.auth.signOut();
    return {
      error:
        "Tu cuenta no tiene roles asignados en el back. Pedile al admin que te asigne uno.",
    };
  }

  redirect("/back");
}

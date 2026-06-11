/**
 * Server actions para el login del Studio.
 *
 * signIn(): autentica al operador contra Supabase Auth.
 * Si OK → redirect al `?next=` validado (o /studio/resumen por default).
 * Si error → devuelve el mensaje para mostrar en el form.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export type SignInState = {
  error?: string;
};

/**
 * Solo permitimos redirect a rutas internas del propio sitio. Debe empezar con
 * "/" pero NO con "//" ni "/\" (eso sería un host externo → open-redirect).
 */
function safeNext(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? "");
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return v;
  return "/studio/resumen";
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Completa email y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensajes amigables (no exponer detalles internos de Supabase)
    if (error.message.toLowerCase().includes("invalid")) {
      return { error: "Email o contraseña incorrectos." };
    }
    return { error: "No pudimos iniciarte sesión. Intentá de nuevo." };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

/**
 * Server actions para el login del Studio.
 *
 * signIn(): autentica al operador contra Supabase Auth.
 * Si OK → redirect a /studio/resumen.
 * Si error → devuelve el mensaje para mostrar en el form.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export type SignInState = {
  error?: string;
};

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
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
  redirect("/studio/resumen");
}

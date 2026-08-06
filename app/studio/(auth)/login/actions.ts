/**
 * Server actions para el login del Studio.
 *
 * signIn(): autentica al operador contra Supabase Auth y exige membresía
 * ACTIVA en `user_tenants` (SDD-0251) — autenticarse no es tener acceso: el
 * portal cliente comparte el mismo Supabase Auth.
 * Si OK → redirect al `?next=` validado (o /studio/resumen por default).
 * Si es cliente del portal → redirect a /portal (su sesión es válida, su casa
 * es otra). Si no es ni lo uno ni lo otro → signOut + mensaje en el form.
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Mensajes amigables (no exponer detalles internos de Supabase)
    if (error.message.toLowerCase().includes("invalid")) {
      return { error: "Email o contraseña incorrectos." };
    }
    return { error: "No pudimos iniciarte sesión. Intenta de nuevo." };
  }

  // ── Gate de membresía (SDD-0251) ──────────────────────────────────────
  // El portal cliente comparte el mismo Supabase Auth. Sin esto, un cliente
  // teclea sus credenciales acá, el login le dice que sí, y recién el layout
  // del Studio lo rebota — se vive como "entré al ERP" y el 2026-08-06 llegó
  // como reporte de incidente. El candado de verdad sigue estando en
  // app/studio/(app)/layout.tsx; esto sólo evita el portazo silencioso.
  const userId = data.user?.id;
  const { data: link } = userId
    ? await supabase
        .from("user_tenants")
        .select("user_id")
        .eq("user_id", userId)
        .is("disabled_at", null)
        .limit(1)
        .maybeSingle<{ user_id: string }>()
    : { data: null };

  if (!link) {
    const { data: portalClientId } = await supabase.rpc("get_portal_client_id");
    if (portalClientId) {
      // Su sesión es legítima, sólo que su casa es el portal.
      revalidatePath("/", "layout");
      redirect("/portal");
    }
    // Sesión sin lugar en el Studio (p. ej. usuario desactivado): no dejamos
    // una sesión colgando en el navegador.
    await supabase.auth.signOut();
    return {
      error: "Esta cuenta no tiene acceso al Studio. Habla con un admin.",
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

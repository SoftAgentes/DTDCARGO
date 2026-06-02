"use server";

import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";

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
          "Ese email todavía no tiene el portal habilitado. Pedile a tu asesor que te invite — o registrate si sos nuevo.",
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

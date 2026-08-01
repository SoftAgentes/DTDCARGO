"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
const THROTTLE_TABLE = "portal_registro_throttle";
const THROTTLE_PREFIX = "portal-login:";
const THROTTLE_LIMIT = 8;
const THROTTLE_WINDOW_MINUTES = 60;

export type PortalLoginState = {
  error?: string;
  sent?: boolean;
  /** Email al que se mandó el enlace (para el mensaje de confirmación). */
  email?: string;
};

function genericSuccess(email: string): PortalLoginState {
  return { sent: true, email };
}

/**
 * Pide un magic-link de Supabase Auth para entrar al portal. Método ÚNICO de
 * acceso (SDD-0094): el cliente entra con su email, no con su Shipping Mark.
 *
 * Solo envía a emails habilitados, pero responde de forma indistinguible para
 * impedir enumeración. El login nunca crea auth.users.
 */
export async function requestMagicLink(
  _prev: PortalLoginState,
  formData: FormData,
): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length < 5) {
    return { error: "Ingresa un email válido." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return genericSuccess(email);
  }

  const ipHash = createHash("sha256").update(await getRequestIp()).digest("hex");
  const ip = `${THROTTLE_PREFIX}${ipHash}`;
  const windowStart = new Date(
    Date.now() - THROTTLE_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error: throttleError } = await admin
    .from(THROTTLE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if (throttleError || (count ?? 0) >= THROTTLE_LIMIT) {
    return genericSuccess(email);
  }
  const { error: throttleInsertError } = await admin.from(THROTTLE_TABLE).insert({ ip });
  if (throttleInsertError) return genericSuccess(email);

  const { data: clientUser, error: clientUserError } = await admin
    .from("client_users")
    .select("id")
    .ilike("email", email)
    .in("status", ["invited", "active"])
    .limit(1)
    .maybeSingle();
  if (clientUserError || !clientUser) return genericSuccess(email);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${SITE_URL}/portal/callback`,
      shouldCreateUser: false,
    },
  });

  // Una falla del proveedor tampoco debe convertirse en oráculo de existencia.
  if (error) return genericSuccess(email);
  return genericSuccess(email);
}

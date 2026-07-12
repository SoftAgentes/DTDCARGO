/**
 * Resolución de email/nombre de un user a partir de su id (auth.admin +
 * user_profiles). Extraído de bug-email-notify.ts para que tanto el dispatch
 * inline como el drain del outbox (bug-notif-outbox.ts) lo compartan sin
 * import circular entre ambos módulos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveUserEmail(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

export async function resolveUserDisplayName(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle<{ first_name: string | null; last_name: string | null }>();
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (name) return name;

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  return userData?.user?.email ?? "Usuario";
}

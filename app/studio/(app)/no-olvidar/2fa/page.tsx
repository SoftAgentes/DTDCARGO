/**
 * Gate 2FA del No-Olvidar (SDD-0025). Segundo login en adelante: /studio/no-olvidar
 * redirige acá si la sesión de unlock expiró. Verifica setup y si el user
 * configuró master password para pintar (o no) ese campo.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { TwoFactorGate } from "../_components/TwoFactorGate";

export const metadata = { title: "No-Olvidar · Desbloquear" };

export default async function NoOlvidarTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/studio");

  const { data: keys } = await supabase
    .from("no_olvidar_user_keys")
    .select("has_master_password, setup_completed")
    .eq("user_id", auth.user.id)
    .maybeSingle<{ has_master_password: boolean; setup_completed: boolean }>();

  if (!keys || !keys.setup_completed) redirect("/studio/no-olvidar/setup");

  // Solo permitimos next dentro del propio módulo (evita open-redirect).
  const safeNext = next && next.startsWith("/studio/no-olvidar") ? next : "/studio/no-olvidar";

  return (
    <div style={{ padding: "48px 16px" }}>
      <TwoFactorGate hasMasterPassword={keys.has_master_password} nextPath={safeNext} />
    </div>
  );
}

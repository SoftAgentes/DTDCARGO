/**
 * Wizard de primer uso del No-Olvidar (SDD-0025 §4.12). Genera el secret TOTP y
 * su URI server-side (para el QR) y los pasa al wizard. Si el user ya completó
 * el setup, redirige al No-Olvidar.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { generateTotpSecret, buildTotpUri } from "@/lib/studio/no-olvidar/totp";
import { SetupWizard } from "../_components/SetupWizard";

export const metadata = { title: "No-Olvidar · Configuración" };

export default async function NoOlvidarSetupPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/studio");

  const { data: keys } = await supabase
    .from("no_olvidar_user_keys")
    .select("setup_completed")
    .eq("user_id", auth.user.id)
    .maybeSingle<{ setup_completed: boolean }>();

  // Sin fila = el trigger no corrió (user no es de dtd-cargo) → no hay No-Olvidar.
  if (!keys) redirect("/studio");
  if (keys.setup_completed) redirect("/studio/no-olvidar");

  const totpSecret = generateTotpSecret();
  const totpUri = buildTotpUri(totpSecret, auth.user.email ?? "empleado@dtdcargo.com");

  return (
    <div style={{ padding: "48px 16px" }}>
      <SetupWizard totpSecret={totpSecret} totpUri={totpUri} />
    </div>
  );
}

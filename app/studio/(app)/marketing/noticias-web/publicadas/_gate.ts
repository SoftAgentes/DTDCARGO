/**
 * SDD-0625 · Puerta de las páginas «Publicadas», «Editar» y «Retirar».
 *
 * Igual que la página del generador: sesión, admin ACTIVO (tenantAdminGate mira
 * `disabled_at`, las policies de 0055 no) y el flag `marketing_news`. Las
 * actions vuelven a comprobar admin por su cuenta: esta puerta es la de la
 * pantalla, no la de los datos.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { tenantAdminGate } from "@/lib/studio/rbac-guard";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";

export async function puertaNoticiasAdmin() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const gate = await tenantAdminGate(supabase);
  if (!gate.ok) redirect("/studio/dashboard");

  const flags = await listFeatureFlags(supabase);
  if (!flags.marketing_news) redirect("/studio/dashboard");

  return { supabase, tenantId: gate.tenantId };
}

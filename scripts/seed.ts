/**
 * Seed master del Studio.
 *
 * Corre todos los seeds de catálogos que viven como "fuente de verdad
 * en código, proyección a DB":
 *
 *   - seedAgents          (SDD-0020) → public.skills global
 *   - seedMailTemplates   (SDD-0026) → public.mail_templates por tenant
 *
 * NO siembra data de tenants individuales (clientes, embarques, etc).
 * Esos van por flows operativos normales (drawer, import CSV).
 *
 * Uso:
 *   pnpm seed
 *
 * Requiere:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (necesario para UPSERT en tablas con RLS)
 */

import { createClient } from "@supabase/supabase-js";
import { seedAgents } from "./seed-agents";
import { seedMailTemplates } from "./seed-mail-templates";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.");
  }
  if (!serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. El seed necesita service_role para escribir en tablas con RLS.",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[seed] Iniciando…");
  await seedAgents(supabase);
  await seedMailTemplates(supabase);
  console.log("[seed] Terminado.");
}

main().catch((err) => {
  console.error("[seed] Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});

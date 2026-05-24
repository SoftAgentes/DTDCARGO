/**
 * Seed master del Studio (SDD-0020 Fase 2E).
 *
 * Corre todos los seeds de catálogos globales que viven en código:
 *  - seedAgents → sincroniza public.skills con SKILLS_BY_SLUG
 *
 * Futuros seeds van acá: catálogos de hubs TMS, plantillas de mailing,
 * etc. — todo lo que sea "fuente de verdad en código, proyección a DB".
 *
 * NO siembra data de tenants individuales (clientes, embarques, etc).
 * Esos van por flows operativos normales (drawer, import CSV, etc).
 *
 * Uso:
 *   pnpm seed
 *
 * Requiere:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (necesario para UPSERT en skills sin RLS)
 */

import { createClient } from "@supabase/supabase-js";
import { seedAgents } from "./seed-agents";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.");
  }
  if (!serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. El seed necesita service_role para escribir en skills.",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[seed] Iniciando…");
  await seedAgents(supabase);
  console.log("[seed] Terminado.");
}

main().catch((err) => {
  console.error("[seed] Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});

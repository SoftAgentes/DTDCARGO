/**
 * Cliente Supabase con `service_role` — bypasea RLS.
 *
 * USO RESTRINGIDO: solo para audit append-only (insert en `agent_runs`,
 * `agent_approvals`) y RPCs administrativas. Las tools de agentes
 * SIEMPRE usan el cliente regular (`lib/db/server.ts`) con el JWT
 * del usuario que disparó el run — así RLS preserva tenant boundaries
 * y un bug en una tool no puede leer datos de otro tenant.
 *
 * No usar desde Server Components, páginas, ni desde el browser.
 * Solo desde Route Handlers / Server Actions / lib/studio/agents/runtime/.
 *
 * Si la env var falta, throwea explícito — preferimos romper que
 * silenciosamente bypasear RLS con un cliente mal configurado.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL no está configurada — admin client requiere URL del proyecto.",
    );
  }
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada — admin client requiere service_role para audit del orchestrator.",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

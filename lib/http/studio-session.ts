/**
 * Guard de sesión para los route handlers de `/api/studio/*`.
 *
 * El patrón ya vivía copiado a mano en varias rutas (`bugs`, `agents/run`…):
 * `auth.getUser()` → 401, después `user_tenants` → 403. Otras cuatro
 * **decían en su docblock** "Auth: sesión Supabase válida obligatoria" y no
 * verificaban nada: se apoyaban sólo en RLS.
 *
 * RLS es la defensa real y no filtraba datos —un anónimo veía cero filas—
 * pero dejaba dos agujeros feos:
 *
 *  - Un `update ... .eq("id", …)` que RLS bloquea afecta 0 filas **sin
 *    devolver error**: el DELETE de un envío le respondía `{ok: true}` a un
 *    llamador sin sesión. Una API que miente sobre lo que hizo.
 *  - Cero defensa en profundidad. Si una policy regresa, no queda nada
 *    detrás.
 *
 * Devuelve `NextResponse` cuando hay que cortar, o el `{ supabase, user,
 * tenantId, role }` cuando la sesión es buena.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/server";

export interface StudioSession {
  supabase: SupabaseClient;
  user: User;
  tenantId: string;
  role: string;
}

/**
 * Uso:
 * ```ts
 * const sesion = await requireStudioSession();
 * if (sesion instanceof NextResponse) return sesion;
 * const { supabase, tenantId } = sesion;
 * ```
 */
export async function requireStudioSession(): Promise<StudioSession | NextResponse> {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return NextResponse.json({ error: "Sin tenant." }, { status: 403 });
  }

  return {
    supabase,
    user: userResp.user,
    tenantId: link.tenant_id,
    role: link.role,
  };
}

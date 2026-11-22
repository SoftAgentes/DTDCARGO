/**
 * Control de acceso a la ficha del empleado (SDD-0652 F1, §2.2 y §F1 punto 1).
 *
 * `requireModuleView("nomina")` no alcanza para decidir quién ve una ficha:
 *
 *   - un **acceso extra** a `nomina` (SDD-0635) pasa esa puerta
 *     (`rbac-guard.ts`, `canAccessModule` mira los extras);
 *   - la policy de **lectura propia** de la 0181 deja a cualquier usuario
 *     enlazado leer su propia ficha, tenga el rol que tenga;
 *   - `nomina_can_access()` (0160) mira el rol en **cualquier** tenant.
 *
 * Por eso la ficha pregunta aquí, antes de leer nada: ¿la persona tiene rol
 * `admin` o `accounting`, con la membresía activa? El tenant que devuelve es el
 * de esa misma membresía, y la ficha se busca filtrando por él.
 *
 * Server-only: usa `getStudioAccess`, que lee la sesión.
 */

import type { createClient } from "@/lib/db/server";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { nivelDeFicha, type NivelFicha } from "./ficha-empleado";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

export type FichaEmpleadoAccess =
  | { ok: true; nivel: NivelFicha; tenantId: string; userId: string }
  | { ok: false };

export async function getFichaEmpleadoAccess(
  supabase: StudioClient,
): Promise<FichaEmpleadoAccess> {
  const access = await getStudioAccess(supabase);
  const nivel = nivelDeFicha(access.role);
  if (!nivel || !access.tenantId || !access.userId) return { ok: false };
  return { ok: true, nivel, tenantId: access.tenantId, userId: access.userId };
}

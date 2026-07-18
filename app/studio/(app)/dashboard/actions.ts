"use server";

/**
 * Server Actions del dashboard configurable (SDD-0114 · Slice A).
 *
 * `saveDashboardConfigAction` — upsert de la config del usuario (una fila por
 * tenant+user). Valida la forma con `validateDashboardConfigInput` (manual, NO
 * Zod) FILTRANDO por RBAC: aunque el cliente mande un KPI de un módulo que no ve,
 * la action lo descarta antes de persistir (defensa además de la RLS).
 *
 * `resetDashboardConfigAction` — borra la fila del usuario → al recargar vuelve
 * al DEFAULT_CONFIG filtrado por RBAC.
 *
 * No hace `revalidatePath`: la config es estado optimista del cliente (ya la
 * aplicó en pantalla) y los VALORES de los KPIs no cambian al reordenar/togglear
 * — se refetchean en el próximo full-load. Evitar el revalidate ahorra un round
 * completo de queries en cada auto-guardado del drag.
 */

import { createClient } from "@/lib/db/server";
import { canAccessModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import {
  validateDashboardConfigInput,
  type DashboardConfig,
} from "@/lib/studio/dashboard/dashboard-types";

export type SaveDashboardState = {
  ok?: boolean;
  error?: string;
  savedAt?: number;
};

type OwnerCtx = { userId: string; tenantId: string; role: StudioUserRole | null };

async function resolveOwner(): Promise<
  { ctx: OwnerCtx; supabase: Awaited<ReturnType<typeof createClient>> } | { error: string }
> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string | null }>();
  if (!link?.tenant_id) return { error: "Sin tenant asignado." };

  return {
    supabase,
    ctx: {
      userId: userResp.user.id,
      tenantId: link.tenant_id,
      role: (link.role as StudioUserRole | null) ?? null,
    },
  };
}

export async function saveDashboardConfigAction(
  _prev: SaveDashboardState,
  formData: FormData,
): Promise<SaveDashboardState> {
  const raw = formData.get("config");
  if (typeof raw !== "string") return { error: "Config ausente." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Config inválida (JSON)." };
  }

  const resolved = await resolveOwner();
  if ("error" in resolved) return { error: resolved.error };
  const { ctx, supabase } = resolved;

  const canAccess = (moduleId: string | null) =>
    moduleId === null ? true : canAccessModule(ctx.role, moduleId);

  const config: DashboardConfig = validateDashboardConfigInput(parsed, canAccess);

  const { error } = await supabase.from("user_dashboard_prefs").upsert(
    {
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,user_id" },
  );

  if (error) {
    if (error.code === "42501") return { error: "RLS bloqueó el guardado." };
    return { error: `No se pudo guardar: ${error.message}` };
  }

  return { ok: true, savedAt: Date.now() };
}

export async function resetDashboardConfigAction(
  _prev: SaveDashboardState,
  _formData: FormData,
): Promise<SaveDashboardState> {
  const resolved = await resolveOwner();
  if ("error" in resolved) return { error: resolved.error };
  const { ctx, supabase } = resolved;

  const { error } = await supabase
    .from("user_dashboard_prefs")
    .delete()
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.userId);

  if (error) return { error: `No se pudo restaurar: ${error.message}` };
  return { ok: true, savedAt: Date.now() };
}

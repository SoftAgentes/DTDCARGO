"use server";

/**
 * Server actions del módulo Marketing — "Reportar fricción" (SDD-0119
 * Slice 1).
 *
 *  - createFrictionReportAction · cualquiera con acceso de EDICIÓN al módulo
 *    (admin/marketing/commercial) reporta algo que le quita tiempo.
 *  - resolveFrictionReportAction · SOLO admin marca un reporte como resuelto.
 *
 * "use server" + parsing manual + validate*Input (sin Zod) + revalidatePath.
 * Backstop RBAC real: moduleEditDenial(supabase, "marketing") en ambas — la
 * RLS de 0234_marketing_friction_reports.sql es la defensa de fondo (admin-only
 * en UPDATE), esto evita que la UI escondida sea la única barrera.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getStudioAccess, moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateFrictionReportInput,
  type FrictionReportActionState,
} from "@/lib/studio/marketing/friction-types";

const MARKETING_PATH = "/studio/marketing";

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

/**
 * Reporta algo que quita tiempo o no gusta hacer en el área de marketing
 * (SDD-0119 §Reportar fricción — "lo que a Fiorella le quita tiempo... se
 * pasa a Sam para automatizarlo con IA en el ERP"). Entra a la bandeja del
 * módulo con status 'open'.
 */
export async function createFrictionReportAction(
  _prevState: FrictionReportActionState,
  formData: FormData,
): Promise<FrictionReportActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "marketing");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateFrictionReportInput({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (fieldErrors) return { fieldErrors };

  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp.user?.id;
  if (!userId) return { error: "Necesitas iniciar sesión de nuevo." };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver tu tenant." };

  const { error } = await supabase.from("marketing_friction_reports").insert({
    tenant_id: tenantId,
    reporter_user_id: userId,
    title: input!.title,
    description: input!.description,
    status: "open",
  });

  if (error) {
    return { error: "No se pudo guardar el reporte. Intenta de nuevo." };
  }

  revalidatePath(MARKETING_PATH);
  return { ok: true };
}

/**
 * Admin marca un reporte de fricción como resuelto. `moduleEditDenial` deja
 * pasar también a marketing/commercial (edición del módulo en general), así
 * que acá se suma un chequeo de rol explícito — solo `admin` puede resolver
 * (espejo de la policy UPDATE en 0234, que es admin-only en DB).
 */
export async function resolveFrictionReportAction(
  reportId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "marketing");
  if (denial) return { error: denial };

  const { role } = await getStudioAccess(supabase);
  if (role !== "admin") {
    return { error: "Solo un admin puede marcar un reporte como resuelto." };
  }

  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp.user?.id ?? null;

  const { error } = await supabase
    .from("marketing_friction_reports")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq("id", reportId);

  if (error) {
    return { error: "No se pudo marcar como resuelto. Intenta de nuevo." };
  }

  revalidatePath(MARKETING_PATH);
  return {};
}

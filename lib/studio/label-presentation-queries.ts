import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LABEL_PRESENTATION, parseLabelPresentation } from "@/lib/shared/label-presentation";

export async function getLabelPresentation(db: SupabaseClient, tenantId: string) {
  const { data, error } = await db.from("shipping_label_versions").select("version,settings")
    .eq("tenant_id", tenantId).order("version", { ascending: false }).limit(1).maybeSingle();
  return {
    settings: parseLabelPresentation(data?.settings) ?? DEFAULT_LABEL_PRESENTATION,
    version: Number(data?.version ?? 0),
    available: !error,
  };
}

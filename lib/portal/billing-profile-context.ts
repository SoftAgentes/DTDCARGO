import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBillingProfile, type BillingProfile } from "@/lib/portal/billing-identity";

export type PortalBillingContext = {
  /** false si la RPC de 0466 no responde: el Portal oculta empresa y facturación. */
  available: boolean;
  profile: BillingProfile | null;
};

/**
 * SDD-0487 · Perfil de facturación del propio cliente. La RPC resuelve el
 * cliente por sesión y no recibe ids. Sin 0466 (PGRST202) o ante cualquier
 * fallo, el bloque «Mi empresa» y «Facturar a nombre de» no se muestra: la
 * migración va antes que el código (migrate-first).
 */
export async function getPortalBillingContext(db: SupabaseClient): Promise<PortalBillingContext> {
  try {
    const { data, error } = await db.rpc("portal_get_my_billing_profile");
    if (error) return { available: false, profile: null };
    const profile = parseBillingProfile(data);
    return { available: profile != null, profile };
  } catch {
    return { available: false, profile: null };
  }
}

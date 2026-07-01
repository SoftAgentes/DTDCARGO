/**
 * Numeración & legal (SDD-0122) — queries server-side.
 *
 * `getNumberingOverview(supabase)` arma la sección: formatos de correlativo
 * (con "próximo" en vivo solo para Facturas/Estimados vía RPCs read-only que
 * NO consumen) + las leyendas legales guardadas en `tenants`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NUMBERING_CATALOG,
  type NumberingFormat,
  type NumberingOverview,
} from "./numbering-types";

async function resolveTenantId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

export async function getNumberingOverview(
  supabase: SupabaseClient,
): Promise<NumberingOverview> {
  const tenantId = await resolveTenantId(supabase);

  const empty: NumberingOverview = {
    formats: NUMBERING_CATALOG.map((c) => ({
      label: c.label,
      format: c.format,
      next: null,
      source: c.source,
    })),
    legends: { footer: "", terms: "" },
  };
  if (!tenantId) return empty;

  // Previews en vivo (seguros: SELECT max+1, no consumen correlativo) +
  // leyendas del tenant, en paralelo.
  const [invoiceRes, quoteRes, tenantRes] = await Promise.all([
    supabase.rpc("next_invoice_code", { p_tenant_id: tenantId }),
    supabase.rpc("next_quote_code", { p_tenant_id: tenantId }),
    supabase
      .from("tenants")
      .select("invoice_footer_text, invoice_terms_text")
      .eq("id", tenantId)
      .maybeSingle<{ invoice_footer_text: string | null; invoice_terms_text: string | null }>(),
  ]);

  const liveNext: Record<string, string | null> = {
    Facturas: typeof invoiceRes.data === "string" ? invoiceRes.data : null,
    Estimados: typeof quoteRes.data === "string" ? quoteRes.data : null,
  };

  const formats: NumberingFormat[] = NUMBERING_CATALOG.map((c) => ({
    label: c.label,
    format: c.format,
    next: c.live ? (liveNext[c.label] ?? null) : null,
    source: c.source,
  }));

  return {
    formats,
    legends: {
      footer: tenantRes.data?.invoice_footer_text ?? "",
      terms: tenantRes.data?.invoice_terms_text ?? "",
    },
  };
}

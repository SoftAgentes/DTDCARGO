/**
 * Fiscal · SENIAT (SDD-0073) — módulo configurable.
 *
 * Server component: lee ?tab=config|ventas|compras (default ventas) + ?period=
 * YYYY-MM (default mes actual). Carga SIEMPRE la config (la consumen los libros)
 * y, según el tab activo, el Libro de Ventas o el de Compras (no ambos). Delega
 * la UI a FiscalClient.
 *
 * Capa de presentación sobre tablas existentes (invoices 0021, supplier_bills
 * 0044) + 1 tabla de config (fiscal_settings 0126). NUNCA fabrica valores
 * fiscales (§3.2). El tab Configuración es admin-only para guardar (la action y
 * la RLS también lo gatean); todos pueden ver.
 *
 * Frontera RSC: de FiscalClient importamos SOLO el componente (JSX). Los tipos/
 * helpers compartidos viven en lib/studio/fiscal/{types,config-types}.ts
 * (server-safe). El paso `rsc-boundary` del gate debe pasar.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  getFiscalSettings,
  purchaseBook,
  salesBook,
} from "@/lib/studio/fiscal/queries";
import { asPeriod } from "@/lib/studio/fiscal/types";
import { FiscalClient, type FiscalTab } from "./_components/FiscalClient";

export const metadata = { title: "Fiscal · SENIAT" };
export const dynamic = "force-dynamic";

function asTab(raw: unknown): FiscalTab {
  return raw === "config" || raw === "compras" ? raw : "ventas";
}

export default async function FiscalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const single = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const tab = asTab(single("tab"));
  const period = asPeriod(single("period"));

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  // Resolver tenant + rol (filtrando por user_id, post-0040). Sin tenant → el
  // módulo no aplica; lo mandamos al dashboard.
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .eq("user_id", userResp.user.id)
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) redirect("/studio/dashboard");
  const canEditConfig = link.role === "admin";

  // La config alimenta los libros → siempre se carga.
  const settings = await getFiscalSettings(supabase);

  if (tab === "ventas") {
    const sales = await salesBook(supabase, period, settings);
    return (
      <FiscalClient
        tab="ventas"
        period={period}
        settings={settings}
        canEditConfig={canEditConfig}
        sales={sales.rows}
        currencies={sales.currencies}
      />
    );
  }

  if (tab === "compras") {
    const purchases = await purchaseBook(supabase, period, settings);
    return (
      <FiscalClient
        tab="compras"
        period={period}
        settings={settings}
        canEditConfig={canEditConfig}
        purchases={purchases.rows}
        currencies={purchases.currencies}
      />
    );
  }

  // Configuración (admin-only para guardar; todos ven).
  return (
    <FiscalClient
      tab="config"
      period={period}
      settings={settings}
      canEditConfig={canEditConfig}
    />
  );
}

/**
 * Fiscal · SENIAT (SDD-0073 + SDD-0104) — módulo configurable.
 *
 * Server component: lee ?tab=config|ventas|compras|retenciones (default ventas)
 * + ?period=YYYY-MM (default mes actual). Carga SIEMPRE la config (la consumen
 * los libros) y, según el tab activo, el Libro de Ventas/Compras (vivo + el
 * snapshot asentado vigente, SDD-0104) o las Retenciones del período. Delega la
 * UI a FiscalClient.
 *
 * Capa de presentación sobre tablas existentes (invoices 0021, supplier_bills
 * 0044) + config (fiscal_settings 0126) + libros asentados (fiscal_books 0165) +
 * retenciones (tax_withholdings 0166). NUNCA fabrica valores fiscales (§3.2). El
 * tab Configuración es admin-only para guardar; asentar/anular libros y crear/
 * anular retenciones es accounting/admin (la action y la RLS también lo gatean).
 *
 * Frontera RSC: de FiscalClient importamos SOLO el componente (JSX). Los tipos/
 * helpers compartidos viven en lib/studio/fiscal/* (server-safe). El paso
 * `rsc-boundary` del gate debe pasar.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { canEditModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import {
  getFiscalSettings,
  purchaseBook,
  salesBook,
} from "@/lib/studio/fiscal/queries";
import { getPostedBook } from "@/lib/studio/fiscal/books-queries";
import { listWithholdings } from "@/lib/studio/fiscal/withholding-queries";
import { asPeriod } from "@/lib/studio/fiscal/types";
import { FiscalClient, type FiscalTab } from "./_components/FiscalClient";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export const metadata = { title: "Fiscal · SENIAT" };
export const dynamic = "force-dynamic";

function asTab(raw: unknown): FiscalTab {
  return raw === "config" ||
    raw === "compras" ||
    raw === "retenciones"
    ? raw
    : "ventas";
}

export default async function FiscalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // SDD-0624: el gate va también en la página, no sólo en el layout: un
  // layout compartido no se vuelve a ejecutar en la navegación parcial.
  await requireModuleView("fiscal");

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
    .maybeSingle<{ tenant_id: string; role: StudioUserRole }>();
  if (!link?.tenant_id) redirect("/studio/dashboard");
  const canEditConfig = link.role === "admin";
  // Asentar/anular libros + retenciones = accounting/admin (gate también en DB).
  const canPost = canEditModule(link.role, "fiscal");

  // La config alimenta los libros → siempre se carga.
  const settings = await getFiscalSettings(supabase);

  if (tab === "ventas") {
    const [sales, posted] = await Promise.all([
      salesBook(supabase, period, settings),
      getPostedBook(supabase, period, "ventas"),
    ]);
    return (
      <FiscalClient
        tab="ventas"
        period={period}
        settings={settings}
        canEditConfig={canEditConfig}
        canPost={canPost}
        sales={sales.rows}
        currencies={sales.currencies}
        postedBook={posted}
      />
    );
  }

  if (tab === "compras") {
    const [purchases, posted] = await Promise.all([
      purchaseBook(supabase, period, settings),
      getPostedBook(supabase, period, "compras"),
    ]);
    return (
      <FiscalClient
        tab="compras"
        period={period}
        settings={settings}
        canEditConfig={canEditConfig}
        canPost={canPost}
        purchases={purchases.rows}
        currencies={purchases.currencies}
        postedBook={posted}
      />
    );
  }

  if (tab === "retenciones") {
    const withholdings = await listWithholdings(supabase, period);
    return (
      <FiscalClient
        tab="retenciones"
        period={period}
        settings={settings}
        canEditConfig={canEditConfig}
        canPost={canPost}
        withholdings={withholdings}
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
      canPost={canPost}
    />
  );
}

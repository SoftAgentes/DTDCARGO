/**
 * /studio/gastos — Gastos CN (SDD-0039 · Parte B).
 *
 * Server component. Resuelve locale + region, fetchea gastos del scope
 * activo + KPIs del mes + shipments para el picker + último fx por par,
 * y delega la UI interactiva a GastosClient.
 *
 * El equipo CN (warehouse/operations/accounting) y accounting VE lo usan;
 * RLS (policies expenses_cn_team / expenses_ve_accounting de 0074) decide
 * qué ve cada rol.
 */

import { createClient } from "@/lib/db/server";
import {
  listTenantExpenses,
  computeExpenseKpis,
  listShipmentsForPicker,
  getLastFxRate,
} from "@/lib/studio/expense-queries";
import { listActiveAlerts } from "@/lib/studio/expense-alerts-queries";
import type { ExpenseScope } from "@/lib/studio/expense-types";
import { resolveLocale } from "@/lib/i18n/resolve-server";
import { t } from "@/lib/i18n";
import { GastosClient } from "./_components/GastosClient";
import { GastosKpis } from "./_components/GastosKpis";
import { attachmentsPilotState } from "@/lib/studio/attachments/pilot-gate";
import { canSpecial } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export const metadata = { title: "Gastos" };

function parseScope(v: string | string[] | undefined): ExpenseScope {
  return v === "external" ? "external" : "shipment";
}
function asString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // SDD-0624: el gate va también en la página, no sólo en el layout: un
  // layout compartido no se vuelve a ejecutar en la navegación parcial.
  await requireModuleView("expenses");

  const rawParams = await searchParams;
  const scope = parseScope(rawParams.scope);
  const month = asString(rawParams.month);
  const search = asString(rawParams.q);
  const openShipmentId = asString(rawParams.new_expense);

  const supabase = await createClient();

  // Locale + region del user logueado (region maneja default de moneda en el drawer).
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const [{ data: prof }, { data: ut }] = await Promise.all([
    userId
      ? supabase
          .from("user_profiles")
          .select("locale")
          .eq("user_id", userId)
          .maybeSingle<{ locale: string | null }>()
      : Promise.resolve({ data: null }),
    userId
      ? supabase
          .from("user_tenants")
          .select("region, tenant_id, role")
          .eq("user_id", userId)
          .maybeSingle<{
            region: string | null;
            tenant_id: string;
            role: StudioUserRole;
          }>()
      : Promise.resolve({ data: null }),
  ]);
  const { locale } = await resolveLocale({
    userProfileLocale: prof?.locale ?? null,
    userTenantRegion: ut?.region ?? null,
  });

  const [expenses, kpis, shipments, fxCny, fxVes, activeAlerts] =
    await Promise.all([
      listTenantExpenses(supabase, { scope, month, search }),
      computeExpenseKpis(supabase, month),
      listShipmentsForPicker(supabase),
      getLastFxRate(supabase, "CNY/USD"),
      getLastFxRate(supabase, "VES/USD"),
      listActiveAlerts(supabase),
    ]);

  const fxPrefill: Record<string, { rate: number; setAt: string }> = {};
  if (fxCny) fxPrefill["CNY/USD"] = fxCny;
  if (fxVes) fxPrefill["VES/USD"] = fxVes;

  return (
    <div style={{ maxWidth: 1480 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">{t(locale, "expenses.page.eyebrow")}</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
        >
          {t(locale, "expenses.page.title")}
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "70ch",
          }}
        >
          {t(locale, "expenses.page.subtitle")}
        </p>
      </div>

      {/* KPIs del mes */}
      <GastosKpis kpis={kpis} locale={locale} />

      {/* Toolbar + tabs + tabla + drawer */}
      <GastosClient
        expenses={expenses}
        shipments={shipments}
        scope={scope}
        month={month}
        search={search}
        fxPrefill={fxPrefill}
        activeAlerts={activeAlerts}
        openShipmentId={openShipmentId}
        attachmentsPilotEnabled={attachmentsPilotState().enabled}
        attachmentOwnerKey={userId && ut?.tenant_id ? `${ut.tenant_id}:${userId}` : undefined}
        canVoidExpense={canSpecial(ut?.role, "void_expense")}
      />
    </div>
  );
}

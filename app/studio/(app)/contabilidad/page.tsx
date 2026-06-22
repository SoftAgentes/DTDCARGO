/**
 * Contabilidad (SDD-0040) — plan de cuentas + libro diario + libro mayor +
 * reportes (P&L / Balance) + conciliación bancaria + activos fijos (SDD-0105).
 *
 * Server component: fetchea cuentas, saldos (con rollup), asientos y el libro
 * mayor de la cuenta seleccionada, y delega la UI a ContabilidadClient. Las
 * sub-pestañas de conciliación / activos fetchean su data de forma condicional
 * por tab (no se paga el costo si no estás en esa pestaña).
 */

import { createClient } from "@/lib/db/server";
import {
  accountBalances,
  listAccounts,
} from "@/lib/studio/account-queries";
import { listEntries } from "@/lib/studio/journal-queries";
import { ledgerForAccount } from "@/lib/studio/journal-queries";
import { profitAndLoss, balanceSheet } from "@/lib/studio/accounting/reports";
import { getAccountingSettings } from "@/lib/studio/accounting/period-queries";
import {
  listStatements,
  statementWithLines,
  listEntryCandidates,
} from "@/lib/studio/accounting/bank-statement-queries";
import { listAssets } from "@/lib/studio/accounting/fixed-asset-queries";
import type { BankStatement } from "@/lib/studio/accounting/bank-statement-types";
import type { EntryCandidate } from "@/lib/studio/accounting/bank-statement-queries";
import type { FixedAsset } from "@/lib/studio/accounting/fixed-asset-types";
import { ContabilidadClient } from "./_components/ContabilidadClient";

export const metadata = { title: "Contabilidad" };

type Tab = "plan" | "diario" | "mayor" | "reportes" | "conciliacion" | "activos";

export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const single = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const tabRaw = single("tab");
  const tab: Tab =
    tabRaw === "diario" ||
    tabRaw === "mayor" ||
    tabRaw === "reportes" ||
    tabRaw === "conciliacion" ||
    tabRaw === "activos"
      ? tabRaw
      : "plan";
  const ledgerAccountId = single("cuenta") ?? null;
  const statementId = single("extracto") ?? null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const [accounts, balances, entries, accSettings] = await Promise.all([
    listAccounts(supabase),
    accountBalances(supabase),
    listEntries(supabase, {}),
    getAccountingSettings(supabase),
  ]);

  // ¿El usuario es admin? (puede fijar el cierre de período · SDD-0080).
  let canEditClosing = false;
  let tenantId: string | null = null;
  if (auth.user) {
    const { data: roleRow } = await supabase
      .from("user_tenants")
      .select("tenant_id, role")
      .eq("user_id", auth.user.id)
      .maybeSingle<{ tenant_id: string; role: string }>();
    canEditClosing = roleRow?.role === "admin";
    tenantId = roleRow?.tenant_id ?? null;
  }

  // Libro mayor de la cuenta seleccionada (si hay una y existe).
  const ledger =
    tab === "mayor" && ledgerAccountId
      ? await ledgerForAccount(supabase, ledgerAccountId)
      : null;

  const pnl = profitAndLoss(accounts, balances);
  const bs = balanceSheet(accounts, balances);

  // ── Conciliación (SDD-0105): solo si estamos en esa pestaña ──
  let statements: BankStatement[] = [];
  let activeStatement: BankStatement | null = null;
  let candidates: EntryCandidate[] = [];
  if (tab === "conciliacion") {
    statements = await listStatements(supabase);
    if (statementId) {
      activeStatement = await statementWithLines(supabase, statementId);
    }
    // Candidatos del diario para la cuenta-banco del extracto activo.
    if (activeStatement && tenantId) {
      candidates = await listEntryCandidates(supabase, {
        accountId: activeStatement.account_id,
        tenantId,
      });
    }
  }

  // ── Activos fijos (SDD-0105): solo si estamos en esa pestaña ──
  let assets: FixedAsset[] = [];
  if (tab === "activos") {
    assets = await listAssets(supabase);
  }

  return (
    <ContabilidadClient
      tab={tab}
      accounts={accounts}
      balances={balances}
      entries={entries}
      ledger={ledger}
      ledgerAccountId={ledgerAccountId}
      pnl={pnl}
      balanceSheet={bs}
      closingDate={accSettings.closing_date}
      canEditClosing={canEditClosing}
      statements={statements}
      activeStatement={activeStatement}
      candidates={candidates}
      assets={assets}
    />
  );
}

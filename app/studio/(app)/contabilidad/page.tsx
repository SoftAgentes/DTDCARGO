/**
 * Contabilidad (SDD-0040) — plan de cuentas + libro diario + libro mayor +
 * reportes (P&L / Balance).
 *
 * Server component: fetchea cuentas, saldos (con rollup), asientos y el libro
 * mayor de la cuenta seleccionada, y delega la UI a ContabilidadClient.
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
import { ContabilidadClient } from "./_components/ContabilidadClient";

export const metadata = { title: "Contabilidad" };

type Tab = "plan" | "diario" | "mayor" | "reportes";

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
    tabRaw === "diario" || tabRaw === "mayor" || tabRaw === "reportes"
      ? tabRaw
      : "plan";
  const ledgerAccountId = single("cuenta") ?? null;

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
  if (auth.user) {
    const { data: roleRow } = await supabase
      .from("user_tenants")
      .select("role")
      .eq("user_id", auth.user.id)
      .maybeSingle<{ role: string }>();
    canEditClosing = roleRow?.role === "admin";
  }

  // Libro mayor de la cuenta seleccionada (si hay una y existe).
  const ledger = ledgerAccountId
    ? await ledgerForAccount(supabase, ledgerAccountId)
    : null;

  const pnl = profitAndLoss(accounts, balances);
  const bs = balanceSheet(accounts, balances);

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
    />
  );
}

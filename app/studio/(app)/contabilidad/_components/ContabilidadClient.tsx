"use client";

/**
 * Orquestador client del módulo Contabilidad (SDD-0040).
 *
 * Header + 4 tabs (Plan de cuentas · Libro diario · Libro mayor · Reportes).
 * El tab activo y la cuenta del mayor van por URL (?tab=, ?cuenta=) para que
 * sean linkeables y sobrevivan a un refresh. Cada tab delega a su componente.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Account } from "@/lib/studio/account-types";
import type { AccountBalanceMap } from "@/lib/studio/account-queries";
import type { JournalEntry } from "@/lib/studio/journal-types";
import type { AccountLedger } from "@/lib/studio/journal-queries";
import type { ProfitAndLoss, BalanceSheet } from "@/lib/studio/accounting/reports";
import { PlanCuentasTab } from "./PlanCuentasTab";
import { LibroDiarioTab } from "./LibroDiarioTab";
import { LibroMayorTab } from "./LibroMayorTab";
import { ReportesTab } from "./ReportesTab";

type Tab = "plan" | "diario" | "mayor" | "reportes";

const TABS: { value: Tab; label: string }[] = [
  { value: "plan", label: "Plan de cuentas" },
  { value: "diario", label: "Libro diario" },
  { value: "mayor", label: "Libro mayor" },
  { value: "reportes", label: "Reportes" },
];

export function ContabilidadClient({
  tab,
  accounts,
  balances,
  entries,
  ledger,
  ledgerAccountId,
  pnl,
  balanceSheet,
}: {
  tab: Tab;
  accounts: Account[];
  balances: AccountBalanceMap;
  entries: JournalEntry[];
  ledger: AccountLedger | null;
  ledgerAccountId: string | null;
  pnl: ProfitAndLoss;
  balanceSheet: BalanceSheet;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showCreateEntry, setShowCreateEntry] = useState(false);

  const goToTab = (next: Tab) => {
    const s = new URLSearchParams();
    if (next !== "plan") s.set("tab", next);
    // Preservar la cuenta del mayor solo si seguimos en mayor.
    if (next === "mayor") {
      const cuenta = params.get("cuenta");
      if (cuenta) s.set("cuenta", cuenta);
    }
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/contabilidad?${qs}` : "/studio/contabilidad");
    });
  };

  const postableAccounts = accounts.filter((a) => a.is_postable);
  const asentados = entries.filter((e) => e.status === "asentado").length;

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación financiera</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Contabilidad.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "64ch",
            }}
          >
            Plan de cuentas, libro diario por doble partida, libro mayor por
            cuenta y reportes P&amp;L / Balance. Libros en USD. Las facturas
            emitidas generan su asiento automático.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {tab === "plan" && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowCreateAccount(true)}
            >
              + Cuenta
            </button>
          )}
          {tab === "diario" && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowCreateEntry(true)}
            >
              + Nuevo asiento
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.12s",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => goToTab(t.value)}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${active ? "var(--wine)" : "transparent"}`,
                font: `${active ? "700" : "500"} 12.5px/1 var(--f-sans)`,
                color: active ? "var(--wine)" : "var(--ink-soft)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "plan" && (
        <PlanCuentasTab
          accounts={accounts}
          balances={balances}
          showCreate={showCreateAccount}
          onOpenCreate={() => setShowCreateAccount(true)}
          onCloseCreate={() => setShowCreateAccount(false)}
        />
      )}
      {tab === "diario" && (
        <LibroDiarioTab
          entries={entries}
          postableAccounts={postableAccounts}
          accountsCount={accounts.length}
          asentadosCount={asentados}
          showCreate={showCreateEntry}
          onOpenCreate={() => setShowCreateEntry(true)}
          onCloseCreate={() => setShowCreateEntry(false)}
        />
      )}
      {tab === "mayor" && (
        <LibroMayorTab
          accounts={accounts}
          balances={balances}
          ledger={ledger}
          ledgerAccountId={ledgerAccountId}
        />
      )}
      {tab === "reportes" && (
        <ReportesTab pnl={pnl} balanceSheet={balanceSheet} />
      )}
    </div>
  );
}

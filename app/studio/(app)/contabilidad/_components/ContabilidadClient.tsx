"use client";

/**
 * Orquestador client del módulo Contabilidad (SDD-0040 + SDD-0105).
 *
 * Header + 7 tabs (Plan de cuentas · Libro diario · Libro mayor · Reportes ·
 * Por contabilizar · Conciliación · Activos fijos). El tab activo y la cuenta del mayor / extracto
 * van por URL (?tab=, ?cuenta=, ?extracto=) para que sean linkeables y
 * sobrevivan a un refresh. Cada tab delega a su componente.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Account } from "@/lib/studio/account-types";
import type { AccountBalanceMap } from "@/lib/studio/account-queries";
import type { JournalEntry } from "@/lib/studio/journal-types";
import type { AccountLedger } from "@/lib/studio/journal-queries";
import type {
  CuadreDelLibro,
  FiltroReportes,
  ReportesDelLibro,
} from "@/lib/studio/accounting/libro-control";
import type {
  BankStatement,
} from "@/lib/studio/accounting/bank-statement-types";
import type { EntryCandidate } from "@/lib/studio/accounting/bank-statement-queries";
import type { FixedAsset } from "@/lib/studio/accounting/fixed-asset-types";
import { PlanCuentasTab } from "./PlanCuentasTab";
import { LibroDiarioTab } from "./LibroDiarioTab";
import { LibroMayorTab } from "./LibroMayorTab";
import { ReportesTab } from "./ReportesTab";
import { PorContabilizarTab } from "./PorContabilizarTab";
import { ConciliacionTab } from "./ConciliacionTab";
import { ActivosFijosTab } from "./ActivosFijosTab";
import { ClosingDateDrawer } from "./ClosingDateDrawer";
import { ExcepcionesCierreTab } from "./ExcepcionesCierreTab";
import type { AvisoCierre, EventoDelCierre, ExcepcionAlCierre } from "@/lib/studio/accounting/cierre-excepciones";
import type { EstadoCierre } from "@/lib/studio/accounting/cierre-queries";

type Tab =
  | "plan"
  | "diario"
  | "mayor"
  | "reportes"
  | "subdiario"
  | "conciliacion"
  | "activos"
  | "excepciones";

const TABS: { value: Tab; label: string }[] = [
  { value: "plan", label: "Plan de cuentas" },
  { value: "diario", label: "Libro diario" },
  { value: "mayor", label: "Libro mayor" },
  { value: "reportes", label: "Reportes" },
  { value: "subdiario", label: "Por contabilizar" },
  { value: "conciliacion", label: "Conciliación" },
  { value: "activos", label: "Activos fijos" },
  { value: "excepciones", label: "Excepciones al cierre" },
];

/** Cuentas de banco / caja postables (para cargar extractos): qbo_type Bank o code 1.1.1.x. */
function bankAccountsFrom(accounts: Account[]): Account[] {
  return accounts.filter(
    (a) =>
      a.is_postable &&
      (a.qbo_type === "Bank" ||
        a.subtype === "banco_caja" ||
        a.code.startsWith("1.1.1.")),
  );
}

/** Cuentas de activo fijo postables: qbo_type Fixed Assets o code 1.2.x (excluye la contra 1.2.9). */
function assetAccountsFrom(accounts: Account[]): Account[] {
  return accounts.filter(
    (a) =>
      a.is_postable &&
      a.code !== "1.2.9" &&
      (a.qbo_type === "Fixed Assets" ||
        a.subtype === "activo_fijo" ||
        a.code.startsWith("1.2.")),
  );
}

export function ContabilidadClient({
  tab,
  accounts,
  balances,
  entries,
  conteoDiario,
  ledger,
  ledgerAccountId,
  reportes,
  filtroReportes,
  cuadre,
  closingDate,
  canEditClosing,
  statements,
  activeStatement,
  candidates,
  assets,
  estadoCierre = null,
  excepciones = [],
  historialCierre = [],
}: {
  tab: Tab;
  accounts: Account[];
  balances: AccountBalanceMap;
  entries: JournalEntry[];
  /** Totales reales del diario (solo en la pestaña Libro diario). */
  conteoDiario: { total: number; asentados: number } | null;
  ledger: AccountLedger | null;
  ledgerAccountId: string | null;
  reportes: ReportesDelLibro | null;
  filtroReportes: FiltroReportes | null;
  cuadre: CuadreDelLibro | null;
  closingDate: string | null;
  canEditClosing: boolean;
  statements: BankStatement[];
  activeStatement: BankStatement | null;
  candidates: EntryCandidate[];
  assets: FixedAsset[];
  /** SDD-0566: el cierre con superclave. null sin la 0493: sin excepción ni reporte. */
  estadoCierre?: EstadoCierre | null;
  excepciones?: ExcepcionAlCierre[];
  historialCierre?: EventoDelCierre[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showCreateEntry, setShowCreateEntry] = useState(false);
  const [showSetClosing, setShowSetClosing] = useState(false);
  const [showCreateStatement, setShowCreateStatement] = useState(false);
  const [showCreateAsset, setShowCreateAsset] = useState(false);
  // SDD-0566: el aviso del cierre para los asientos de período cerrado.
  const avisoCierre: AvisoCierre | null = estadoCierre?.closingDate
    ? { closingDate: estadoCierre.closingDate, modo: estadoCierre.modo, superclaveDefinida: estadoCierre.superclaveDefinida }
    : null;

  const goToTab = (next: Tab) => {
    const s = new URLSearchParams();
    if (next !== "plan") s.set("tab", next);
    // Preservar la cuenta del mayor solo si seguimos en mayor.
    if (next === "mayor") {
      const cuenta = params.get("cuenta");
      if (cuenta) s.set("cuenta", cuenta);
    }
    // Preservar el extracto activo solo si seguimos en conciliación.
    if (next === "conciliacion") {
      const extracto = params.get("extracto");
      if (extracto) s.set("extracto", extracto);
    }
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/contabilidad?${qs}` : "/studio/contabilidad");
    });
  };

  const postableAccounts = accounts.filter((a) => a.is_postable);
  const bankAccounts = bankAccountsFrom(accounts);
  const assetAccounts = assetAccountsFrom(accounts);

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
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
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
            cuenta y reportes del período: P&amp;L, balance general y balance de
            comprobación. El cuadre del libro contra facturas y CxP, conciliación
            bancaria y activos fijos con su depreciación. Libros en USD.
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
          {tab === "diario" && canEditClosing && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={() => setShowSetClosing(true)}
              title="Cierre de período contable (admin)"
            >
              {closingDate ? `Cierre: ${closingDate}` : "Cerrar período"}
            </button>
          )}
          {tab === "diario" && !canEditClosing && closingDate && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0 12px",
                font: "600 11.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
              }}
            >
              Cerrado hasta {closingDate}
            </span>
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
          {tab === "conciliacion" && bankAccounts.length > 0 && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowCreateStatement(true)}
            >
              + Cargar extracto
            </button>
          )}
          {tab === "activos" && assetAccounts.length > 0 && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowCreateAsset(true)}
            >
              + Activo
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
          transition: "opacity var(--dur-fast) var(--ease)",
        }}
      >
        {TABS.filter((t) => t.value !== "excepciones" || estadoCierre).map((t) => {
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
      {tab === "diario" && conteoDiario && (
        <LibroDiarioTab
          avisoCierre={avisoCierre}
          entries={entries}
          totalEntries={conteoDiario.total}
          postableAccounts={postableAccounts}
          accountsCount={accounts.length}
          asentadosCount={conteoDiario.asentados}
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
      {tab === "reportes" && filtroReportes && (
        <ReportesTab reportes={reportes} filtro={filtroReportes} />
      )}
      {tab === "subdiario" && cuadre && <PorContabilizarTab cuadre={cuadre} />}
      {tab === "conciliacion" && (
        <ConciliacionTab
          statements={statements}
          activeStatement={activeStatement}
          bankAccounts={bankAccounts}
          candidates={candidates}
          showCreate={showCreateStatement}
          onCloseCreate={() => setShowCreateStatement(false)}
        />
      )}
      {tab === "activos" && (
        <ActivosFijosTab
          assets={assets}
          assetAccounts={assetAccounts}
          closingDate={closingDate}
          showCreate={showCreateAsset}
          onCloseCreate={() => setShowCreateAsset(false)}
        />
      )}

      {tab === "excepciones" && estadoCierre && (
        <ExcepcionesCierreTab excepciones={excepciones} historial={historialCierre} />
      )}

      {showSetClosing && (
        <ClosingDateDrawer
          currentClosingDate={closingDate}
          estadoCierre={estadoCierre}
          onClose={() => setShowSetClosing(false)}
        />
      )}
    </div>
  );
}

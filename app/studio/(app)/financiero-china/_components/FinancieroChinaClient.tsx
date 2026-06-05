"use client";

/**
 * Orquestador client del módulo Financiero con el Socio China
 * (SDD-0059 · Slice B2).
 *
 * Header + selector de socio + 3 tabs:
 *   1. Reconciliación · cola de estados de cuenta + resolución línea por línea
 *      (el dolor de mayor ROI). Diseño anclado a conciliacion.jsx.
 *   2. Cuenta corriente · saldo neto USD/RMB + libro mayor con runBalance.
 *      Diseño anclado a estado-cuenta.jsx.
 *   3. Cargos · lista con net_amount + nota de crédito + disputar/cancelar.
 *
 * Todo con primitivas del sistema + tokens var(--*). El cambio de socio
 * recarga cuenta corriente + cargos vía getSupplierFinance (server action).
 */

import { useState, useTransition } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type {
  PartnerBalance,
  PartnerLedgerEntry,
  PartnerStatement,
  SupplierChargeWithNet,
} from "@/lib/studio/partner-finance/types";
import { getSupplierFinance } from "../actions";
import { ReconciliationTab } from "./ReconciliationTab";
import { LedgerTab } from "./LedgerTab";
import { ChargesTab } from "./ChargesTab";

export type SupplierOption = {
  id: string;
  code: string;
  name: string;
  name_cn: string | null;
};

type Tab = "reconciliacion" | "cuenta" | "cargos";

export function FinancieroChinaClient({
  suppliers,
  defaultSupplierId,
  statements,
  charges: initialCharges,
  ledgerEntries: initialEntries,
  balance: initialBalance,
}: {
  suppliers: SupplierOption[];
  defaultSupplierId: string | null;
  statements: PartnerStatement[];
  charges: SupplierChargeWithNet[];
  ledgerEntries: PartnerLedgerEntry[];
  balance: PartnerBalance;
}) {
  const [tab, setTab] = useState<Tab>("reconciliacion");
  const [supplierId, setSupplierId] = useState<string | null>(defaultSupplierId);

  // Datos del socio seleccionado (cuenta corriente + cargos). Arrancan con los
  // del socio por defecto y se recargan al cambiar de socio.
  const [balance, setBalance] = useState(initialBalance);
  const [ledgerEntries, setLedgerEntries] = useState(initialEntries);
  const [charges, setCharges] = useState(initialCharges);
  const [loading, startLoading] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  const onSupplierChange = (id: string) => {
    setSupplierId(id);
    setLoadError(null);
    startLoading(async () => {
      const res = await getSupplierFinance(id);
      if (res.ok) {
        setBalance(res.balance);
        setLedgerEntries(res.ledgerEntries);
        setCharges(res.charges);
      } else {
        setLoadError(res.error);
      }
    });
  };

  const selectedSupplier =
    suppliers.find((s) => s.id === supplierId) ?? null;

  const TABS: { value: Tab; label: string; count?: number }[] = [
    {
      value: "reconciliacion",
      label: "Reconciliación",
      count: statements.filter((s) => s.status !== "cerrado").length,
    },
    { value: "cuenta", label: "Cuenta corriente" },
    { value: "cargos", label: "Cargos y notas", count: charges.length },
  ];

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Finanzas · Socio logístico China</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Financiero China.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "64ch",
            }}
          >
            Cuenta corriente bilateral (USD + RMB) con el socio, reconciliación
            de su estado de cuenta línea por línea y el modelo de cargos /
            notas de crédito que evita el pago duplicado.
          </p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          eyebrow="Sin socio"
          title="No hay proveedores de China cargados todavía."
          description="Cargá el Socio Logístico China en Proveedores CN (país CN) para empezar a llevar su cuenta corriente y reconciliar su estado de cuenta."
        />
      ) : (
        <>
          {/* Tabs */}
          <div
            role="tablist"
            style={{
              display: "flex",
              gap: 4,
              borderBottom: "1px solid var(--border)",
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            {TABS.map((tEntry) => {
              const active = tab === tEntry.value;
              return (
                <button
                  key={tEntry.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(tEntry.value)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderBottom: active
                      ? "2px solid var(--wine)"
                      : "2px solid transparent",
                    color: active ? "var(--ink)" : "var(--ink-soft)",
                    font: `${active ? 700 : 600} 13px/1 var(--f-sans)`,
                    cursor: "pointer",
                    marginBottom: -1,
                  }}
                >
                  {tEntry.label}
                  {typeof tEntry.count === "number" && tEntry.count > 0 && (
                    <span
                      style={{
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 9,
                        background: active ? "var(--wine-tint)" : "var(--neutral-bg)",
                        color: active ? "var(--wine)" : "var(--ink-soft)",
                        font: "800 10px/1 var(--f-mono)",
                      }}
                    >
                      {tEntry.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === "reconciliacion" && (
            <ReconciliationTab
              suppliers={suppliers}
              statements={statements}
              defaultSupplierId={supplierId}
            />
          )}

          {tab === "cuenta" && (
            <LedgerTab
              suppliers={suppliers}
              selectedSupplier={selectedSupplier}
              supplierId={supplierId}
              onSupplierChange={onSupplierChange}
              balance={balance}
              ledgerEntries={ledgerEntries}
              loading={loading}
              loadError={loadError}
            />
          )}

          {tab === "cargos" && (
            <ChargesTab
              suppliers={suppliers}
              selectedSupplier={selectedSupplier}
              supplierId={supplierId}
              onSupplierChange={onSupplierChange}
              charges={charges}
              loading={loading}
              loadError={loadError}
            />
          )}
        </>
      )}
    </div>
  );
}

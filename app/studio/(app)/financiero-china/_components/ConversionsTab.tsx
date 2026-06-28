"use client";

/**
 * Tab "Conversiones" del Financiero China (SDD-0115 Slice C · feature 4.6).
 * Expone lo que ya vivía en lib: registrar una conversión de divisa y ver el
 * spread/comisión captada como REVENUE (KPI). El asiento contable lo cabla la
 * action (syncConversionJournalEntry · SDD-0110). Solo-lectura + un drawer de alta.
 */

import { useState } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type { CurrencyConversion } from "@/lib/studio/partner-finance/types";
import { ConversionDrawer } from "./ConversionDrawer";

function usd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number | null): string {
  return n == null ? "—" : `${(n * 100).toFixed(2)}%`;
}

export function ConversionsTab({
  conversions,
  forexRevenue,
}: {
  conversions: CurrencyConversion[];
  forexRevenue: { total_commission: number; count: number };
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <KpiCard
            label="Revenue forex (comisión)"
            value={usd(forexRevenue.total_commission)}
            sub={`${forexRevenue.count} conversión${forexRevenue.count === 1 ? "" : "es"}`}
          />
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={() => setDrawerOpen(true)}
        >
          + Registrar conversión
        </button>
      </div>

      {conversions.length === 0 ? (
        <EmptyState
          eyebrow="Conversiones"
          title="Todavía no hay conversiones registradas"
          description="Registra una conversión de divisa del socio China para capturar el spread como revenue."
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-soft)", borderBottom: "1.5px solid var(--border)" }}>
                <th style={{ padding: "8px 10px", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fecha</th>
                <th style={{ padding: "8px 10px", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Conversión</th>
                <th style={{ padding: "8px 10px", textAlign: "right", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Origen</th>
                <th style={{ padding: "8px 10px", textAlign: "right", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Destino</th>
                <th style={{ padding: "8px 10px", textAlign: "right", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Spread</th>
                <th style={{ padding: "8px 10px", textAlign: "right", font: "700 10px/1 var(--f-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Comisión</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 10px", color: "var(--ink-soft)" }}>
                    {c.converted_on ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", fontFamily: "var(--f-mono)" }}>
                    {c.from_currency} → {c.to_currency}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--f-mono)" }}>
                    {c.from_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--f-mono)" }}>
                    {c.to_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{pct(c.spread_pct)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--f-mono)", color: "var(--success)" }}>
                    {usd(c.commission_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawerOpen && <ConversionDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

"use client";

/**
 * Proyección de salidas · 4 semanas (SDD-0048 · decisión founder §7.1).
 *
 * Versión simple: CxP venciendo por semana (derivada de supplier_bills.due_date).
 * Barras verticales con altura proporcional al máximo de la ventana. La semana
 * en curso usa var(--wine); las siguientes var(--wine-soft). Solo tokens var(--*).
 *
 * Forecast con ingresos esperados = V2 (fuera de scope §8).
 */

import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import { fmtUsd, type ForecastWeek } from "@/lib/studio/direccion/queries";

export function ForecastCard({ forecast }: { forecast: ForecastWeek[] }) {
  const maxUsd = Math.max(...forecast.map((w) => w.usd), 1);
  const hasData = forecast.some((w) => w.usd > 0);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5) var(--s-5)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "var(--s-4)",
        }}
      >
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Proyección de salidas · 4 semanas
        </span>
        <Link
          href="/studio/tesoreria"
          style={{
            font: "600 11.5px/1 var(--f-sans)",
            color: "var(--wine-text)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-1)",
            textDecoration: "none",
          }}
        >
          Tesorería {Icon.arrowR(11)}
        </Link>
      </div>

      {hasData ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "var(--s-4)",
            height: 150,
          }}
        >
          {forecast.map((w, i) => {
            const h = (w.usd / maxUsd) * 120;
            return (
              <div
                key={w.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <div
                  style={{
                    font: "800 10.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  {w.usd > 0 ? fmtUsd(w.usd) : "—"}
                </div>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 56,
                    height: Math.max(h, 4),
                    borderRadius: "var(--r-sm) var(--r-sm) 0 0",
                    background: i === 0 ? "var(--wine)" : "var(--wine-soft)",
                    transition: "height var(--dur-slow) var(--ease)",
                  }}
                />
                <div
                  style={{
                    font: "600 9.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    textAlign: "center",
                  }}
                >
                  {w.label}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            padding: "var(--s-6) 0",
          }}
        >
          Sin CxP venciendo en las próximas 4 semanas.
        </div>
      )}
    </div>
  );
}

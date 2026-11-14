"use client";

/**
 * Salud financiera (SDD-0048) — CxC / CxP / vencido + barra de cobertura.
 *
 * Cada fila deep-linkea al módulo de origen (Cobranzas / Tesorería). La barra
 * de cobertura reusa el patrón de UtilizationBar de Naviera (div track + fill
 * con color por TOKEN): success cuando ≥ 100% (caja cubre la CxP), warning si no.
 *
 * Solo tokens var(--*) — cero hex.
 */

import Link from "next/link";
import type { FinanceHealth } from "@/lib/studio/direccion/queries";
import { fmtUsd } from "@/lib/money";

function FinRow({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--s-2) 0",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "var(--r-pill)",
            background: `var(--${tone})`,
            flexShrink: 0,
          }}
        />
        <span style={{ font: "600 12.5px/1 var(--f-sans)", color: "var(--ink)" }}>
          {label}
        </span>
      </span>
      <span style={{ font: "800 13.5px/1 var(--f-mono)", color: "var(--ink)" }}>
        {value}
      </span>
    </Link>
  );
}

export function FinanceHealthCard({ health }: { health: FinanceHealth }) {
  const coverage = health.coberturaPct;
  const coverTone = coverage >= 100 ? "var(--success)" : "var(--warning)";
  const barWidth = Math.min(100, Math.max(0, coverage));

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
          font: "700 10px/1 var(--f-sans)",
          color: "var(--wine-text)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "var(--s-3)",
        }}
      >
        Salud financiera
      </div>

      <FinRow
        label="Por cobrar (CxC)"
        value={fmtUsd(health.cxc)}
        tone="success"
        href="/studio/cobranzas"
      />
      <FinRow
        label="Por pagar (CxP)"
        value={fmtUsd(health.cxp)}
        tone="warning"
        href="/studio/tesoreria"
      />
      <FinRow
        label="Vencido"
        value={fmtUsd(health.vencido)}
        tone={health.vencido > 0 ? "danger" : "neutral"}
        href="/studio/tesoreria"
      />
      {(health.sinTasa ?? 0) > 0 && (
        <p
          data-testid="salud-sin-tasa"
          style={{ margin: "var(--s-2) 0 0", font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}
        >
          {`${health.sinTasa} documento(s) sin tasa no suman aquí. Cárgala en Contabilidad › Tasas de cambio.`}
        </p>
      )}

      <div
        style={{
          marginTop: "var(--s-4)",
          paddingTop: "var(--s-4)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              font: "600 11.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Cobertura de pagos con caja
          </span>
          <span
            style={{
              font: "800 13px/1 var(--f-mono)",
              color: coverTone,
            }}
          >
            {coverage.toFixed(0)}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(coverage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Cobertura de pagos con caja"
          style={{
            width: "100%",
            height: 8,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-pill)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${barWidth}%`,
              height: "100%",
              background: coverTone,
              borderRadius: "var(--r-pill)",
              transition: "width var(--dur) var(--ease)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * Alertas · requieren atención (SDD-0048) — lista derivada (deriveAlerts), no
 * persistida (§4.4). Cada alerta deep-linkea a su módulo de origen; si no hay
 * nada → "Todo en orden" (sin link). Solo tokens var(--*).
 *
 * El tono mapea a los pares de tokens del Studio: var(--<tone>) + var(--<tone>-bg).
 */

import Link from "next/link";
import { Icon, type IconName } from "@/app/studio/_components/icons";
import type { DireccionAlert } from "@/lib/studio/direccion/queries";

/** Resuelve el método del set Icon por nombre (con fallback a check). */
function renderIcon(name: string): React.ReactNode {
  const key = name as IconName;
  const fn = Icon[key] ?? Icon.check;
  return fn(15);
}

function AlertRow({ alert, first }: { alert: DireccionAlert; first: boolean }) {
  const inner = (
    <>
      <span
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: "var(--r-md)",
          background: `var(--${alert.tone}-bg)`,
          color: `var(--${alert.tone})`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {renderIcon(alert.icon)}
      </span>
      <span
        style={{
          flex: 1,
          font: "600 12.5px/1.4 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {alert.text}
      </span>
      {alert.href && (
        <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
          {Icon.arrowR(13)}
        </span>
      )}
    </>
  );

  const baseStyle = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "var(--s-3)",
    padding: "var(--s-3) var(--s-5)",
    borderTop: first ? "none" : "1px solid var(--border)",
    textDecoration: "none",
    color: "inherit",
  };

  if (alert.href) {
    return (
      <Link href={alert.href} style={baseStyle}>
        {inner}
      </Link>
    );
  }
  return <div style={baseStyle}>{inner}</div>;
}

export function AlertsCard({ alerts }: { alerts: DireccionAlert[] }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "var(--s-4) var(--s-5) var(--s-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Alertas · requieren atención
        </span>
      </div>
      <div>
        {alerts.map((a, i) => (
          <AlertRow key={`${a.tone}-${i}`} alert={a} first={i === 0} />
        ))}
      </div>
    </div>
  );
}

/**
 * MobileHeader — header sticky reutilizable para todas las pantallas
 * del namespace `/m/*` (operario CN, bodeguero, VE).
 *
 * Slots opcionales: back button a la izquierda, action a la derecha.
 * Respeta safe-area-inset-top de iOS.
 */

import type { ReactNode } from "react";

export function MobileHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        padding:
          "calc(env(safe-area-inset-top) + 12px) var(--s-4) var(--s-3)",
        display: "grid",
        gridTemplateColumns: "44px 1fr 44px",
        gap: "var(--s-2)",
        alignItems: "center",
      }}
    >
      <div>{back ?? null}</div>
      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div
          style={{
            font: "900 16px/1.1 var(--f-display)",
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              font: "500 11px/1.2 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {right ?? null}
      </div>
    </header>
  );
}

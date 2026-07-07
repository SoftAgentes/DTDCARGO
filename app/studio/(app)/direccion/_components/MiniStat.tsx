"use client";

/**
 * MiniStat (SDD-0048) — celda compacta de las tarjetas Operación / Comercial.
 *
 * Icono + label uppercase + valor display + sub. Si tiene `href` es un Link
 * (deep-link al módulo). Solo tokens var(--*), cero hex.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function MiniStat({
  label,
  value,
  sub,
  icon,
  tone = "wine",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
  tone?: "wine" | "success" | "warning" | "danger";
  href?: string;
}) {
  const body = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: "var(--s-2)" }}>
        <span style={{ color: `var(--${tone})`, display: "inline-flex" }}>
          {icon}
        </span>
        <span
          style={{
            font: "700 9.5px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          font: "900 19px/1 var(--f-display)",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            font: "500 10.5px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: "var(--s-1)",
          }}
        >
          {sub}
        </div>
      )}
    </>
  );

  const baseStyle = {
    display: "block",
    textAlign: "left" as const,
    padding: "var(--s-3) var(--s-4)",
    borderRadius: "var(--r-md)",
    background: "var(--bg-elevated)",
    textDecoration: "none",
    color: "inherit",
  };

  if (href) {
    return (
      <Link href={href} style={baseStyle}>
        {body}
      </Link>
    );
  }
  return <div style={baseStyle}>{body}</div>;
}

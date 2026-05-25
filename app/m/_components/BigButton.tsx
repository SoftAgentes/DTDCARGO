/**
 * BigButton — CTA grande del mobile (height 56). 3 variantes:
 *  - primary (default): fondo wine, texto blanco
 *  - secondary: fondo elevated, texto ink
 *  - ghost: transparente, texto ink
 *
 * Tap target generoso, font Archivo black, sentence case.
 */

"use client";

import type { CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const STYLES: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: "var(--wine)", fg: "#FFFFFF" },
  secondary: {
    bg: "var(--bg-elevated)",
    fg: "var(--ink)",
    border: "1px solid var(--border)",
  },
  ghost: { bg: "transparent", fg: "var(--ink)" },
};

export function BigButton({
  label,
  onClick,
  disabled,
  icon,
  iconRight,
  variant = "primary",
  type = "button",
  style,
}: {
  label: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  variant?: Variant;
  type?: "button" | "submit";
  style?: CSSProperties;
}) {
  const v = STYLES[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: 56,
        background: v.bg,
        color: v.fg,
        border: v.border ?? 0,
        borderRadius: "var(--r-md)",
        font: "800 16px/1 var(--f-sans)",
        letterSpacing: "-0.01em",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform var(--dur-fast) var(--ease)",
        ...style,
      }}
      onTouchStart={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "scale(0.98)";
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {icon}
      {label}
      {iconRight}
    </button>
  );
}

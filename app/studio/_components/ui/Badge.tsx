/**
 * Badge primitive · DTD Studio
 *
 * Pill con tono (success/warning/danger/info/wine/neutral) y opcional dot.
 * Diseño (Norte): docs/design/studio/_norte/erp/components.jsx
 *
 * BRAND-SYNC v4.6 (BD-018, completado 2026-07-12): success/warning/info/wine
 * fallan AA como texto directo sobre su -bg en algún tema (success light 3.83 ·
 * info light 4.20 · warning light 2.79 · wine dark 2.79) → texto `--ink` (o
 * `--wine-text`) + dot semántico. danger (5.61) y neutral (4.68) sí pasan como
 * texto directo, quedan igual.
 */

import type { CSSProperties, ReactNode } from "react";

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

export type BadgeSize = "sm" | "md";

interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

const TONES: Record<BadgeTone, { bg: string; fg: string; dot?: string }> = {
  success: { bg: "var(--success-bg)", fg: "var(--ink)", dot: "var(--success)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--ink)", dot: "var(--warning)" },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger)" },
  info: { bg: "var(--info-bg)", fg: "var(--ink)", dot: "var(--info)" },
  wine: { bg: "var(--wine-tint)", fg: "var(--ink)", dot: "var(--wine-text)" },
  neutral: { bg: "var(--neutral-bg)", fg: "var(--ink-soft)" },
};

const SIZES: Record<BadgeSize, { h: number; px: number; fs: number }> = {
  sm: { h: 18, px: 6, fs: 10.5 },
  md: { h: 22, px: 8, fs: 11.5 },
};

export function Badge({
  tone = "neutral",
  size = "md",
  dot = false,
  children,
  style,
}: BadgeProps) {
  const { bg, fg, dot: toneDot } = TONES[tone];
  const { h, px, fs } = SIZES[size];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: h,
        padding: `0 ${px}px`,
        background: bg,
        color: fg,
        borderRadius: "var(--r-sm)",
        font: `700 ${fs}px/1 var(--f-sans)`,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {(dot || toneDot) && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: toneDot || fg,
          }}
        />
      )}
      {children}
    </span>
  );
}

/** Estados: texto neutro y señal semántica localizada · SDD-0441. */
import type { CSSProperties, ReactNode } from "react";
import { StatusIcon } from "@/components/StatusIcon";

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

export type BadgeSize = "xs" | "sm" | "md";

interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

const TONES: Record<BadgeTone, { bg: string; fg: string; dot?: string }> = {
  success: { bg: "var(--neutral-bg)", fg: "var(--ink)", dot: "var(--success)" },
  warning: { bg: "var(--bg-surface)", fg: "var(--ink)", dot: "var(--warning)" },
  danger: { bg: "var(--neutral-bg)", fg: "var(--ink)", dot: "var(--danger-text)" },
  info: { bg: "var(--info-bg)", fg: "var(--ink)", dot: "var(--info)" },
  wine: { bg: "var(--wine-tint)", fg: "var(--ink)", dot: "var(--wine-text)" },
  neutral: { bg: "var(--neutral-bg)", fg: "var(--ink)" },
};

const SIZES: Record<BadgeSize, { h: number; px: number; fs: number }> = {
  xs: { h: 16, px: 5, fs: 9.5 },
  sm: { h: 18, px: 6, fs: 10.5 },
  md: { h: 22, px: 8, fs: 11.5 },
};

export function Badge({
  tone = "neutral",
  size = "md",
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
      <StatusIcon tone={tone} size={fs + 2} style={{ color: toneDot || fg }} />
      {children}
    </span>
  );
}

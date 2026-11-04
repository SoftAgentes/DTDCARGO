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

const SIZES: Record<BadgeSize, { fs: number }> = {
  xs: { fs: 12 },
  sm: { fs: 12.5 },
  md: { fs: 13.5 },
};

export function Badge({
  tone = "neutral",
  size = "md",
  children,
  style,
}: BadgeProps) {
  const { fg, dot: toneDot } = TONES[tone];
  const { fs } = SIZES[size];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: fg,
        font: `500 ${fs}px/1.2 var(--f-sans)`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <StatusIcon tone={tone} size={fs + 2} style={{ color: toneDot || fg }} />
      {children}
    </span>
  );
}

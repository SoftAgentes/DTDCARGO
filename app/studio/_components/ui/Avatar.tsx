/**
 * Avatar primitive · DTD Studio
 *
 * Initials en círculo con tono de color (info/success/warning/neutral).
 *
 * Por defecto, `neutral`: tinta sobre gris. Las iniciales de una persona no son
 * identidad de marca; el vino queda para el logo (BD-076; decisión de Sam del
 * 2026-11-21, SDD-0686 grupo 8). En `neutral` las iniciales van en `--ink`:
 * con `--ink-soft` daban 4,15:1 sobre `--bg-elevated` en claro.
 * Diseño (Norte): docs/design/studio/_norte/erp/components.jsx
 */

import type { CSSProperties } from "react";

export type AvatarColor = "info" | "success" | "warning" | "neutral";

interface AvatarProps {
  initials: string;
  color?: AvatarColor;
  size?: number;
  style?: CSSProperties;
}

const COLORS: Record<AvatarColor, { bg: string; fg: string }> = {
  info: { bg: "var(--info-bg)", fg: "var(--info)" },
  success: { bg: "var(--success-bg)", fg: "var(--success)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning)" },
  neutral: { bg: "var(--neutral-bg)", fg: "var(--ink)" },
};

export function Avatar({
  initials,
  color = "neutral",
  size = 32,
  style,
}: AvatarProps) {
  const { bg, fg } = COLORS[color];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r-pill)",
        background: bg,
        color: fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        font: `800 ${Math.round(size * 0.4)}px/1 var(--f-display)`,
        letterSpacing: "-0.01em",
        flexShrink: 0,
        ...style,
      }}
    >
      {initials}
    </div>
  );
}

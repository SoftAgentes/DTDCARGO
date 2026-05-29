/**
 * Avatar primitive · DTD Studio
 *
 * Initials en círculo con tono de color (wine/info/success/warning/neutral).
 * Diseño (v1.7): docs/design/studio/v1.7-claude-design/project/erp/components.jsx
 */

import type { CSSProperties } from "react";

export type AvatarColor = "wine" | "info" | "success" | "warning" | "neutral";

interface AvatarProps {
  initials: string;
  color?: AvatarColor;
  size?: number;
  style?: CSSProperties;
}

const COLORS: Record<AvatarColor, { bg: string; fg: string }> = {
  wine: { bg: "var(--wine-tint)", fg: "var(--wine)" },
  info: { bg: "var(--info-bg)", fg: "var(--info)" },
  success: { bg: "var(--success-bg)", fg: "var(--success)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning)" },
  neutral: { bg: "var(--neutral-bg)", fg: "var(--ink-soft)" },
};

export function Avatar({
  initials,
  color = "wine",
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

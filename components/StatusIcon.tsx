import type { CSSProperties } from "react";

/** Señal redundante al texto: la forma distingue el estado sin depender del color. */
export function StatusIcon({ tone, size = 14, style }: {
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "wine";
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      {tone === "warning" ? <path d="M12 3 2 21h20L12 3Zm0 6v5m0 3h.01" /> : <>
        <circle cx={12} cy={12} r={9} />
        <path d={tone === "success" ? "m7 12 3 3 7-7" : tone === "danger" ? "m8 8 8 8m0-8-8 8" : tone === "neutral" ? "M12 7v5l3 2" : "M12 11v6m0-10h.01"} />
      </>}
    </svg>
  );
}

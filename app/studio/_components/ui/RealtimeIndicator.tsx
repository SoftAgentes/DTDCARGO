"use client";

/**
 * RealtimeIndicator — dot pulsante + label que muestra el status del
 * channel Supabase Realtime. Usado en el header de vistas que dependen
 * del bridge (Despacho, Bodeguero, Camionero).
 *
 * Estados:
 *   - connected  · wine dot pulsante · "En vivo"
 *   - connecting · neutral dot · "Conectando…"
 *   - error      · danger dot · "Sin conexión live · refrescá"
 *   - closed     · neutral dot · "Desconectado"
 *   - idle       · oculto
 */

import type { RealtimeStatus } from "@/lib/studio/hooks/use-realtime-table";

interface Props {
  status: RealtimeStatus;
}

const STATUS_META: Record<
  RealtimeStatus,
  { label: string; tone: string; pulse: boolean; show: boolean }
> = {
  idle: { label: "", tone: "var(--ink-mute)", pulse: false, show: false },
  connecting: {
    label: "Conectando…",
    tone: "var(--ink-soft)",
    pulse: false,
    show: true,
  },
  connected: {
    label: "En vivo",
    tone: "var(--wine)",
    pulse: true,
    show: true,
  },
  error: {
    label: "Sin conexión live · refrescá la página",
    tone: "var(--danger)",
    pulse: false,
    show: true,
  },
  closed: {
    label: "Desconectado",
    tone: "var(--ink-mute)",
    pulse: false,
    show: true,
  },
};

export function RealtimeIndicator({ status }: Props) {
  const meta = STATUS_META[status];
  if (!meta.show) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-pill)",
        font: "600 11.5px/1 var(--f-sans)",
        color: meta.tone,
        letterSpacing: "0.02em",
      }}
      role="status"
      aria-live="polite"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: meta.tone,
          flexShrink: 0,
          animation: meta.pulse
            ? "dtd-realtime-pulse 1.6s ease-in-out infinite"
            : "none",
        }}
      />
      <span>{meta.label}</span>
    </div>
  );
}

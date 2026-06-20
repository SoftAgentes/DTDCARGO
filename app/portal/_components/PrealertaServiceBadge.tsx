import { psrStatusLabel, psrStatusTone } from "@/lib/studio/prealertas/addons";
import type { BadgeTone } from "@/lib/studio/prealertas/types";

/**
 * Badge de estado de una SOLICITUD de servicio (SDD-0098). Mismo lenguaje visual
 * que `PrealertaStatusBadge` (chip con punto + texto, tokens `var(--*)`). Estados:
 * Solicitada / En proceso / Atendida / Descartada / Inválida.
 */
const TONE_COLOR: Record<BadgeTone, string> = {
  success: "var(--color-status-success)",
  warning: "var(--color-status-warning)",
  danger: "var(--color-status-danger)",
  info: "var(--color-ink)",
  wine: "var(--color-wine)",
  neutral: "var(--color-grey-500)",
};

export function PrealertaServiceBadge({ status }: { status: string }) {
  const label = psrStatusLabel(status);
  const color = TONE_COLOR[psrStatusTone(status)];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

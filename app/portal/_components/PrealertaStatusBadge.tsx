import { StatusIcon } from "@/components/StatusIcon";
import {
  prealertaStatusLabel,
  prealertaStatusTone,
  type BadgeTone,
} from "@/lib/studio/prealertas/types";

/** SDD-0441: estado con texto neutro e icono semántico, sin cambiar etiquetas de negocio. */
const TONE_COLOR: Record<BadgeTone, string> = {
  success: "var(--color-status-success)",
  warning: "var(--color-status-warning)",
  danger: "var(--color-status-danger)",
  info: "var(--color-ink)",
  wine: "var(--color-wine)",
  neutral: "var(--color-grey-500)",
};

export function PrealertaStatusBadge({ status }: { status: string }) {
  const label = prealertaStatusLabel(status);
  const color = TONE_COLOR[prealertaStatusTone(status)];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap"
      style={{
        color: "var(--color-ink)",
        background: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      <StatusIcon tone={prealertaStatusTone(status)} style={{ color }} />
      {label}
    </span>
  );
}

import {
  prealertaStatusLabel,
  prealertaStatusTone,
  type BadgeTone,
} from "@/lib/studio/prealertas/types";

/**
 * Badge de estado de una compra (prealerta) en el Portal. Mapea el `tone` del
 * dominio a un color de marca (tokens `var(--*)`), con el mismo lenguaje visual
 * que `StatusBadge` de envíos (chip con punto + texto). De cara al cliente el
 * estado es "Anunciada / En camino / Recibida en CN / Consolidada / Cancelada".
 *
 * ⚠️ EL TEXTO NO VA EN EL COLOR DEL TONO (SDD-0176). Medido sobre el tinte 8%
 * en tema CLARO: `warning` **2.91:1**, `success` **3.93:1** — los dos bajo el
 * umbral de body. El color queda en el **punto, el borde y el fondo**; el texto
 * va en `--color-ink` (15.25 claro / 11.54 oscuro). Es el patrón que BRAND §♿
 * ya prescribe para el badge warning y el que `components.jsx` del Norte
 * implementa. En oscuro el par original sí pasaba: el bug era sólo en claro.
 */
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

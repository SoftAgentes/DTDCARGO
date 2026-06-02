import {
  STATUS_COLORS,
  STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/portal/portal-types";

/**
 * Badge de estado de envío — reusa los colores/labels de
 * `lib/shared/shipment-public.ts` (fuente única público↔ERP), así el portal
 * muestra el mismo estado/color que el tracking público y el Studio.
 */
export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap"
      style={{
        color,
        background: `${color}14`, // ~8% alpha (hex8)
        border: `1px solid ${color}33`, // ~20% alpha
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

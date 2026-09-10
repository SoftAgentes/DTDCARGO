import { STATUS_LABELS, STATUS_TONES, type ShipmentStatus } from "@/lib/shared/shipment-public";
import { StatusIcon } from "@/components/StatusIcon";

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const tone = STATUS_TONES[status];
  return (
    <span className={`badge-status badge-status-${tone}`}>
      <StatusIcon tone={tone} />
      {STATUS_LABELS[status]}
    </span>
  );
}

import { STATUS_LABELS, STATUS_TONES, type ShipmentStatus } from "@/lib/shared/shipment-public";
import { Badge } from "@/app/studio/_components/ui/Badge";

/** Una misma semántica que Portal, con los tokens adaptables del Studio. */
export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return <Badge tone={STATUS_TONES[status]} size="sm">{STATUS_LABELS[status]}</Badge>;
}

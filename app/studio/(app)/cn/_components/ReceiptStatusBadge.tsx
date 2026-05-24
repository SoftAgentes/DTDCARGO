/**
 * ReceiptStatusBadge — wrapper del Badge primitive con tone+label por status.
 * Server component puro (sin hooks).
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  RECEIPT_STATUS_LABELS,
  RECEIPT_STATUS_TONES,
  type WarehouseReceiptStatus,
} from "@/lib/studio/warehouse-cn-types";

export function ReceiptStatusBadge({
  status,
  size = "sm",
  dot = true,
}: {
  status: WarehouseReceiptStatus;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  return (
    <Badge tone={RECEIPT_STATUS_TONES[status]} size={size} dot={dot}>
      {RECEIPT_STATUS_LABELS[status]}
    </Badge>
  );
}

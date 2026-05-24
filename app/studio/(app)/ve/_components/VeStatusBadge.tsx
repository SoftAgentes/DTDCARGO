/**
 * VeStatusBadge — wrapper de Badge con label + tone VE-friendly.
 * Server component puro.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  VE_STATUS_LABELS,
  VE_STATUS_TONES,
  isVeStatus,
} from "@/lib/studio/warehouse-ve-types";
import { STATUS_LABELS } from "@/lib/studio/shipment-types";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";

export function VeStatusBadge({
  status,
  size = "sm",
  dot = true,
}: {
  status: ShipmentStatus;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  // Fallback al label generico si status no es VE (no debería pasar
  // en este módulo, pero defensivo)
  const isVe = isVeStatus(status);
  const label = isVe ? VE_STATUS_LABELS[status] : STATUS_LABELS[status];
  const tone = isVe ? VE_STATUS_TONES[status] : "neutral";

  return (
    <Badge tone={tone} size={size} dot={dot}>
      {label}
    </Badge>
  );
}

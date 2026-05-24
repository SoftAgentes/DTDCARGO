/**
 * CustomsStatusBadge — wrapper de Badge con label + tone SENIAT-friendly.
 * Server component puro.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  CUSTOMS_STATUS_LABELS,
  CUSTOMS_STATUS_TONES,
  type CustomsStatus,
} from "@/lib/studio/customs-types";

export function CustomsStatusBadge({
  status,
  size = "sm",
  dot = true,
}: {
  status: CustomsStatus;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  return (
    <Badge tone={CUSTOMS_STATUS_TONES[status]} size={size} dot={dot}>
      {CUSTOMS_STATUS_LABELS[status]}
    </Badge>
  );
}

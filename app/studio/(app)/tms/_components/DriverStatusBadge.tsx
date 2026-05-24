import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  DRIVER_STATUS_LABELS,
  DRIVER_STATUS_TONES,
  type DriverStatus,
} from "@/lib/studio/tms-types";

export function DriverStatusBadge({
  status,
  size = "sm",
  dot = true,
}: {
  status: DriverStatus;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  return (
    <Badge tone={DRIVER_STATUS_TONES[status]} size={size} dot={dot}>
      {DRIVER_STATUS_LABELS[status]}
    </Badge>
  );
}

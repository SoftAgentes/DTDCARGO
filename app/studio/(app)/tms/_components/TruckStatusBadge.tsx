import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  TRUCK_STATUS_LABELS,
  TRUCK_STATUS_TONES,
  type TruckStatus,
} from "@/lib/studio/tms-types";

export function TruckStatusBadge({
  status,
  size = "sm",
  dot = true,
}: {
  status: TruckStatus;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  return (
    <Badge tone={TRUCK_STATUS_TONES[status]} size={size} dot={dot}>
      {TRUCK_STATUS_LABELS[status]}
    </Badge>
  );
}

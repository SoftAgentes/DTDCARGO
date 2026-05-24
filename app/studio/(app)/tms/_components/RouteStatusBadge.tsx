import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  ROUTE_STATUS_LABELS,
  ROUTE_STATUS_TONES,
  type TmsRouteStatus,
} from "@/lib/studio/tms-types";

export function RouteStatusBadge({
  status,
  size = "sm",
  dot = true,
}: {
  status: TmsRouteStatus;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  return (
    <Badge tone={ROUTE_STATUS_TONES[status]} size={size} dot={dot}>
      {ROUTE_STATUS_LABELS[status]}
    </Badge>
  );
}

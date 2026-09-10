import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  ROUTE_STATUS_LABELS,
  ROUTE_STATUS_TONES,
  type TmsRouteStatus,
} from "@/lib/studio/tms-types";

export function RouteStatusBadge({
  status,
  size = "sm",
}: {
  status: TmsRouteStatus;
  size?: "sm" | "md";
}) {
  return (
    <Badge tone={ROUTE_STATUS_TONES[status]} size={size}>
      {ROUTE_STATUS_LABELS[status]}
    </Badge>
  );
}

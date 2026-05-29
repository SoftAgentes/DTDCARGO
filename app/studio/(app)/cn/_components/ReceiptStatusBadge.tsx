"use client";

/**
 * ReceiptStatusBadge — wrapper del Badge primitive con tone+label por status.
 *
 * Client component porque consume `useT()` para localizar el label según
 * locale activo. Si necesitás un badge server-side (sin hook), llamá a
 * `t(locale, key)` directo desde el caller server y pasá `label` como
 * prop override.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  RECEIPT_STATUS_TONES,
  type WarehouseReceiptStatus,
} from "@/lib/studio/warehouse-cn-types";
import { useT, type I18nKey } from "@/lib/i18n";

const STATUS_LABEL_KEYS: Record<WarehouseReceiptStatus, I18nKey> = {
  pendiente_consolidacion: "warehouse_cn.status.pending_consolidation",
  consolidado: "warehouse_cn.status.consolidated",
  incidencia: "warehouse_cn.status.incident",
};

export function ReceiptStatusBadge({
  status,
  size = "sm",
  dot = true,
}: {
  status: WarehouseReceiptStatus;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  const t = useT();
  return (
    <Badge tone={RECEIPT_STATUS_TONES[status]} size={size} dot={dot}>
      {t(STATUS_LABEL_KEYS[status])}
    </Badge>
  );
}

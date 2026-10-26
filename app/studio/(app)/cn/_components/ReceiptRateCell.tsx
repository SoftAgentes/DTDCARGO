"use client";

/**
 * ReceiptRateCell — la columna «Tarifa» del Almacén CN (SDD-0571).
 *
 * Con tarifa congelada: «$/m³», «a facturar» y de dónde salió, más el aviso si
 * el CBM de la recepción cambió desde que se congeló. Sin tarifa: «Sin tarifa»
 * en rojo. Sin la 0496 aplicada: «No disponible». Toda la celda abre el cajón
 * de la tarifa.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import { useT } from "@/lib/i18n";
import { fmtUsd } from "@/lib/money";
import {
  RATE_SOURCE_LABEL_KEYS,
  cbmCambio,
  type RateSnapshot,
} from "@/lib/studio/rate-snapshots/types";

export function ReceiptRateCell({
  snapshot,
  disponible,
  currentCbm,
  receiptCode,
  onOpen,
}: {
  snapshot: RateSnapshot | null;
  disponible: boolean;
  currentCbm: number | null;
  receiptCode: string;
  onOpen: () => void;
}) {
  const t = useT();

  if (!disponible) {
    return (
      <span
        style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-mute)" }}
        title={t("warehouse_cn.rate.unavailable")}
      >
        {t("warehouse_cn.rate.cell.unavailable")}
      </span>
    );
  }

  const aria = snapshot
    ? t("warehouse_cn.rate.cell.open_aria", { code: receiptCode })
    : t("warehouse_cn.rate.cell.freeze_aria", { code: receiptCode });
  const cambio = snapshot ? cbmCambio(snapshot, currentCbm) : false;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={aria}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 3,
        width: "100%",
        padding: "4px 0",
        background: "transparent",
        border: 0,
        cursor: "pointer",
        textAlign: "right",
        color: "inherit",
      }}
    >
      {snapshot ? (
        <>
          <span className="mono" style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)", whiteSpace: "nowrap" }}>
            {t("warehouse_cn.rate.cell.per_cbm", { amount: fmtUsd(snapshot.per_cbm) })}
          </span>
          {/* Solo el monto: «a facturar» lo dice el encabezado (el ancho se midió con el monto). */}
          <span
            className="mono"
            style={{ font: "600 11px/1 var(--f-mono)", color: "var(--ink-soft)", whiteSpace: "nowrap" }}
            title={t("warehouse_cn.rate.cell.to_invoice", { amount: fmtUsd(snapshot.amount_to_invoice) })}
          >
            {fmtUsd(snapshot.amount_to_invoice)}
          </span>
          <span style={{ font: "500 10px/1.2 var(--f-sans)", color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
            {t(RATE_SOURCE_LABEL_KEYS[snapshot.source])}
          </span>
          {cambio && (
            <Badge tone="warning" size="xs">
              {t("warehouse_cn.rate.cell.cbm_changed")}
            </Badge>
          )}
        </>
      ) : (
        <Badge tone="danger" size="sm">
          {t("warehouse_cn.rate.cell.none")}
        </Badge>
      )}
    </button>
  );
}

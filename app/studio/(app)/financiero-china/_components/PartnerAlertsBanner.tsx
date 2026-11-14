"use client";

/**
 * Banner de alertas PP/CA vencidas del Socio China (SDD-0115 · Slice C3).
 *
 * Muestra las CxP del tramo de socio (pre-pago / contra-entrega) que pasaron su
 * `due_date` con saldo pendiente — crédito comercial 30-45d vencido = plata que
 * se le debe al socio y que nadie está mirando. Derivado (no persiste): la lista
 * llega ya computada por `listOverduePartnerBills` (query pura).
 *
 * Se renderiza arriba de las tabs (siempre visible, como el banner de huecos
 * contables). Colapsa la lista detallada a las 4 más atrasadas + "ver N más".
 */

import { useState } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { billKindLabel } from "@/lib/studio/treasury/types";
import type { PartnerBillAlert } from "@/lib/studio/partner-finance/alerts-queries";

const PREVIEW = 4;

function fmtMoney(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PartnerAlertsBanner({ alerts }: { alerts: PartnerBillAlert[] }) {
  const [expanded, setExpanded] = useState(false);
  if (alerts.length === 0) return null;

  // SDD-0572: la CxP sin tasa no suma (antes una CNY con tasa daba 0).
  const totalUsd = alerts.reduce((s, a) => s + (a.balanceUsd ?? 0), 0);
  const sinTasa = alerts.filter((a) => a.balanceUsd === null).length;
  const shown = expanded ? alerts : alerts.slice(0, PREVIEW);
  const hidden = alerts.length - shown.length;

  return (
    <div style={{ marginBottom: 20 }}>
      <Aviso
        tono="atencion"
        titulo={
          <>
            {alerts.length} pago{alerts.length === 1 ? "" : "s"} PP/CA vencido
            {alerts.length === 1 ? "" : "s"} al socio · {fmtMoney(totalUsd, "USD")} pendiente
            {sinTasa > 0 ? ` · ${sinTasa} sin tasa, fuera del total` : ""}
          </>
        }
      >
        <p style={{ margin: 0 }}>
          Pre-pagos y saldos con crédito comercial (30-45 días) que pasaron su
          vencimiento con saldo. Págalos o ajusta la fecha desde Tesorería.
        </p>

        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {shown.map((a) => (
            <li
              key={a.bill.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "7px 10px",
                borderRadius: "var(--r-sm)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span className="studio-input-mono" style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink)" }}>
                  {a.bill.bill_code}
                </span>
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 6,
                    background: "var(--neutral-bg)",
                    color: "var(--ink-soft)",
                    font: "700 10px/1.4 var(--f-sans)",
                  }}
                >
                  {billKindLabel(a.kind)}
                </span>
                <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.bill.supplier_name}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <span style={{ font: "700 12px/1 var(--f-sans)", color: "var(--danger)" }}>
                  {a.daysOverdue}d vencido
                </span>
                <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)" }}>
                  {fmtMoney(a.balance, a.bill.currency)}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {(hidden > 0 || expanded) && alerts.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ marginTop: 8 }}
          >
            {expanded ? "Ver menos" : `Ver ${hidden} más`}
          </button>
        )}
      </Aviso>
    </div>
  );
}

"use client";

/**
 * EmitDrawer (SDD-0069 · decisión #5) — revisión del preview antes de EMITIR.
 *
 * Muestra el snapshot que se va a congelar: los 3 totales con su base + la
 * tabla de recibos elegibles. "Emitir rendición" usa <ActionButton> (acción
 * crítica no idempotente: congela + marca recibos rendido + no debe dispararse
 * dos veces). Tras emitir, el padre navega con highlight + toast.
 *
 * Solo tokens var(--*); sentence case; tuteo. Nombra "la Operadora".
 */

import { useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import { fmtAmount } from "@/lib/studio/renditions/printable";
import type { QuincenaCard } from "../page";
import { emitRenditionAction } from "../actions";

export function EmitDrawer({
  card,
  onClose,
  onEmitted,
}: {
  card: QuincenaCard;
  onClose: () => void;
  onEmitted: (renditionCode: string, receiptCount: number) => void;
}) {
  const { preview } = card;
  const [error, setError] = useState<string | null>(null);

  return (
    <DrawerShell
      title="Emitir rendición"
      subtitle={`${card.label} · ${card.from} → ${card.to}`}
      onClose={onClose}
      pending={false}
      width={680}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Totales con su base */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: "var(--bg-base)",
          }}
        >
          <SummaryRow
            label="Recaudado de terceros"
            base="caja"
            value={preview.thirdPartyUsd}
          />
          <SummaryRow
            label="Servicios locales facturados"
            base="devengado"
            value={preview.localRevenueInvoicedUsd}
          />
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <SummaryRow
              label="Neto a favor de la Operadora"
              value={preview.netToOperadoraUsd}
              strong
            />
          </div>
        </div>

        {(preview.recibosSinTasa ?? 0) + (preview.facturasLocalesSinTasa ?? 0) > 0 && (
          <p
            role="status"
            data-testid="rendicion-sin-tasa"
            style={{ margin: 0, font: "500 12.5px/1.45 var(--f-sans)", color: "var(--danger)" }}
          >
            {`No se puede emitir: ${preview.recibosSinTasa ?? 0} cobro(s) y ${preview.facturasLocalesSinTasa ?? 0} factura(s) local(es) no tienen tasa. Cárgala y vuelve a revisar.`}
          </p>
        )}

        {/* Detalle de recibos */}
        <div>
          <h3
            style={{
              font: "700 11px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              margin: "0 0 var(--s-2)",
            }}
          >
            Recibos a rendir ({preview.receiptCount})
          </h3>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                font: "500 12px/1.4 var(--f-sans)",
              }}
            >
              <thead>
                <tr style={{ background: "var(--bg-base)" }}>
                  {["Recibo", "Cliente", "Ref.", "Fecha", "USD"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 4 ? "right" : "left",
                        padding: "var(--s-2) var(--s-3)",
                        font: "700 9.5px/1 var(--f-sans)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l) => (
                  <tr
                    key={l.receiptId}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td
                      style={{
                        padding: "var(--s-2) var(--s-3)",
                        font: "600 11.5px/1 var(--f-mono)",
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.receiptCode}
                    </td>
                    <td style={{ padding: "var(--s-2) var(--s-3)" }}>
                      {l.clientName ?? "—"}
                      {l.clientMarkbox && (
                        <span
                          style={{
                            font: "500 10px/1 var(--f-mono)",
                            color: "var(--ink-soft)",
                            marginLeft: 6,
                          }}
                        >
                          {l.clientMarkbox}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "var(--s-2) var(--s-3)",
                        font: "500 11px/1 var(--f-mono)",
                        color: "var(--ink-soft)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.reference ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "var(--s-2) var(--s-3)",
                        whiteSpace: "nowrap",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {l.receivedAt}
                    </td>
                    <td
                      style={{
                        padding: "var(--s-2) var(--s-3)",
                        textAlign: "right",
                        font: "600 11.5px/1 var(--f-mono)",
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.amountUsd === null ? "sin tasa" : fmtAmount(l.amountUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p
          style={{
            font: "500 11.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Al emitir, estos totales quedan congelados y los recibos pasan a
          estado rendido. La rendición no se puede editar después (solo anular).
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--r-md)",
              background: "var(--danger-bg)",
              color: "var(--danger)",
              font: "600 12px/1.4 var(--f-sans)",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          onClick={onClose}
        >
          Cancelar
        </button>
        <ActionButton
          variant="primary"
          disabled={(preview.recibosSinTasa ?? 0) + (preview.facturasLocalesSinTasa ?? 0) > 0}
          idleLabel="Emitir rendición"
          loadingLabel="Emitiendo…"
          successLabel="Rendición emitida"
          idleIcon={Icon.check ? Icon.check(14) : undefined}
          successIcon={Icon.check ? Icon.check(14) : undefined}
          onAction={async () => {
            setError(null);
            const r = await emitRenditionAction({
              from: card.from,
              to: card.to,
            });
            if (r.error) throw new Error(r.error);
            onEmitted(r.renditionCode ?? "", r.receiptCount ?? 0);
          }}
          onError={setError}
        />
      </footer>
    </DrawerShell>
  );
}

function SummaryRow({
  label,
  base,
  value,
  strong = false,
}: {
  label: string;
  base?: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span
        style={{
          font: `${strong ? 700 : 500} 13px/1.3 var(--f-sans)`,
          color: strong ? "var(--ink)" : "var(--ink-soft)",
        }}
      >
        {label}
        {base && (
          <span
            style={{
              font: "600 9px/1 var(--f-sans)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              marginLeft: 6,
            }}
          >
            {base}
          </span>
        )}
      </span>
      <span
        style={{
          font: `${strong ? 800 : 600} 15px/1 var(--f-mono)`,
          color: "var(--ink)",
          whiteSpace: "nowrap",
        }}
      >
        USD {fmtAmount(value)}
      </span>
    </div>
  );
}

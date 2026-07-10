"use client";

/**
 * CostEditorDrawer — editor de los 7 costos de un embarque (SDD-0053 · Slice B).
 *
 * Drawer lateral (DrawerShell): header navy con Revenue / Costo total / Margen
 * recalculados en vivo + 7 NumericInput (uno por categoría) + form que postea
 * saveShipmentCosts vía useActionState. Footer HTML5 (<button form=…>) sin
 * requestSubmit hack. Costos en USD; el header se muestra en USD (el toggle VES
 * vive en la pantalla, el editor trabaja en la moneda canónica).
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { Icon } from "@/app/studio/_components/icons";
import {
  COST_CATEGORIES,
  emptyCosts,
  shipmentEconomics,
  type CostActionState,
  type CostAmounts,
  type CostCategoryKey,
} from "@/lib/studio/costing/types";
import type { CostingRow } from "@/lib/studio/costing/queries";
import { saveShipmentCosts } from "../actions";

const FORM_ID = "cost-editor-form";
const initialState: CostActionState = {};

const fmtUsd = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

function rowAmounts(row: CostingRow): CostAmounts {
  if (!row.costs) return emptyCosts();
  const a = emptyCosts();
  for (const c of COST_CATEGORIES) a[c.key] = row.costs[c.key];
  return a;
}

export function CostEditorDrawer({
  row,
  onClose,
}: {
  row: CostingRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    saveShipmentCosts,
    initialState,
  );

  // Estado controlado para recalcular el header (revenue/costo/margen) en vivo.
  // El padre re-monta este drawer con key={shipment.id} al cambiar de embarque,
  // así que el inicializador alcanza (sin sync via efecto).
  const [amounts, setAmounts] = useState<CostAmounts>(() => rowAmounts(row));

  // Cerrar + refrescar al guardar OK.
  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, router, onClose]);

  const eco = useMemo(
    () => shipmentEconomics({ revenueUsd: row.eco.revenue, costs: amounts }),
    [row.eco.revenue, amounts],
  );

  const set = (k: CostCategoryKey, v: number | null) =>
    setAmounts((prev) => ({ ...prev, [k]: v != null && v >= 0 ? v : 0 }));

  const ship = row.shipment;
  const subtitle = [
    ship.client_name,
    ship.origin && ship.destination ? `${ship.origin} → ${ship.destination}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DrawerShell
      title={`Editar costos · ${ship.code}`}
      subtitle={subtitle || undefined}
      onClose={onClose}
      pending={isPending}
      width={620}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <input type="hidden" name="shipment_id" value={ship.id} />

        {/* Header navy · revenue / costo / margen en vivo */}
        <div
          style={{
            background: "var(--ink)",
            borderRadius: "var(--r-lg)",
            padding: "18px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
          }}
        >
          <HeaderMetric label="Revenue" value={fmtUsd(eco.revenue)} color="var(--ink-inv)" />
          <HeaderMetric label="Costo total" value={fmtUsd(eco.totalCost)} color="var(--warning)" />
          <HeaderMetric
            label="Margen"
            value={fmtUsd(eco.margin)}
            color={eco.margin < 0 ? "var(--wine-soft)" : "var(--success)"}
            extra={`${eco.marginPct.toFixed(1)}%`}
          />
        </div>

        {/* 7 inputs de costo */}
        {COST_CATEGORIES.map((c) => (
          <div
            key={c.key}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 150px",
              gap: 14,
              alignItems: "start",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: c.colorToken,
                    flexShrink: 0,
                  }}
                />
                <label
                  htmlFor={`cost-${c.key}`}
                  style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}
                >
                  {c.label}
                </label>
              </div>
              <div
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                  paddingLeft: 20,
                }}
              >
                {c.desc}
              </div>
            </div>
            <div>
              <NumericInput
                id={`cost-${c.key}`}
                name={c.key}
                type="currency"
                currency="USD"
                min={0}
                placeholder="0"
                value={amounts[c.key]}
                onChange={(v) => set(c.key, v)}
              />
              {state.fieldErrors?.[c.key] && (
                <FieldError msg={state.fieldErrors[c.key] as string} />
              )}
            </div>
          </div>
        ))}

        {/* Notas */}
        <div>
          <label className="studio-label" htmlFor="cost-notes">
            Notas
          </label>
          <textarea
            id="cost-notes"
            name="notes"
            rows={2}
            className="studio-input"
            defaultValue={row.costs?.notes ?? ""}
            placeholder="Gaceta SENIAT cambió un arancel, naviera subió el flete…"
            style={{ resize: "vertical" }}
          />
        </div>

        {/* Nota de ayuda */}
        <div
          style={{
            padding: "10px 14px",
            background: "var(--info-bg)",
            borderRadius: "var(--r-md)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: "var(--info)", flexShrink: 0 }}>{Icon.info(13)}</span>
          <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink)" }}>
            Los costos van en USD · el margen se recalcula arriba al instante.
          </div>
        </div>

        {state.error && (
          <p
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
              padding: "10px 12px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {state.error}
          </p>
        )}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Guardar costos"
        pendingLabel="Guardando…"
      />
    </DrawerShell>
  );
}

function HeaderMetric({
  label,
  value,
  color,
  extra,
}: {
  label: string;
  value: string;
  color: string;
  extra?: string;
}) {
  return (
    <div>
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-inv-mute)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ font: "900 22px/1 var(--f-mono)", color, marginTop: 6 }}>
        {value}
      </div>
      {extra && (
        <div
          style={{
            font: "700 11px/1 var(--f-mono)",
            color: "var(--ink-inv-mute)",
            marginTop: 4,
          }}
        >
          {extra}
        </div>
      )}
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}

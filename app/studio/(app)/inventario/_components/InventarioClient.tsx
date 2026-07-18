"use client";

/**
 * InventarioClient · WMS (SDD-0081 · Slice A).
 *
 * UI espejo del mockup `_norte/inventario/inventario.jsx`: tabs Bodega China ·
 * Yiwu (modo consolidación) / Bodega Venezuela · Valencia (modo despacho),
 * 4 KPIs (Shipping Marks · Cajas · Volumen CBM · Peso kg), ocupación de
 * contenedor + cola "listo para consolidar" (CN), tabla por partida.
 *
 * Read-only — no escribe nada (la única escritura, el override de "listo",
 * entra en Slice B). Solo tokens var(--*), primitivas del sistema, "Shipping
 * Mark" en labels (no MARKBOX).
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  statusMeta,
  type StockRow,
  type Warehouse,
  type WarehouseStock,
} from "@/lib/studio/inventory/types";

interface Props {
  cn: WarehouseStock;
  ve: WarehouseStock;
}

const TABS: Array<{ key: Warehouse; label: string }> = [
  { key: "CN", label: "Bodega China · Yiwu" },
  { key: "VE", label: "Bodega Venezuela · Valencia" },
];

const fmt = (n: number) => n.toLocaleString("es-VE");
const fmt2 = (n: number) =>
  n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function InventarioClient({ cn, ve }: Props) {
  const [warehouse, setWarehouse] = useState<Warehouse>("CN");
  const stock = warehouse === "CN" ? cn : ve;
  const isCN = warehouse === "CN";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--s-5)" }}>
        <span className="studio-eyebrow">Operación · Inventario</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
        >
          Inventario de consolidación.
        </h1>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "66ch",
          }}
        >
          Existencias reales por bodega, agrupadas por Shipping Mark. Controla qué
          hay en China, qué está listo para consolidar y qué viaja hacia Venezuela.
          Solo volumen y peso — sin valores.
        </p>
      </div>

      {/* Tabs bodega */}
      <div style={{ display: "flex", gap: "var(--s-2)", marginBottom: "var(--s-4)", flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = warehouse === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setWarehouse(t.key)}
              aria-pressed={active}
              style={{
                cursor: "pointer",
                font: "600 13px/1 var(--f-sans)",
                padding: "11px 17px",
                borderRadius: "var(--r-pill)",
                border: `1px solid ${active ? "var(--ink)" : "var(--border)"}`,
                background: active ? "var(--ink)" : "var(--bg-surface)",
                color: active ? "var(--ink-inv-soft)" : "var(--ink-soft)",
                transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Modo del módulo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <Badge tone={isCN ? "wine" : "info"} size="md">
          {isCN ? "Modo consolidación · entrada" : "Modo despacho · salida"}
        </Badge>
        <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {isCN
            ? "Carga que entra y se agrupa para el contenedor."
            : "Carga que llegó a Venezuela y avanza a entrega."}
        </span>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--s-4)",
          marginBottom: "var(--s-4)",
        }}
      >
        <KpiCard
          label="Shipping Marks"
          value={stock.kpis.marks}
          sub="clientes con carga"
        />
        <KpiCard label="Cajas" value={fmt(stock.kpis.boxes)} sub="bultos en bodega" />
        <KpiCard
          label="Volumen"
          value={`${fmt2(stock.kpis.cbm)} m³`}
          sub="CBM acumulado"
          valueColor="var(--wine-text)"
        />
        <KpiCard
          label="Peso"
          value={`${fmt(Math.round(stock.kpis.weightKg))} kg`}
          sub="peso total"
        />
      </div>

      {/* CN · ocupación + cola */}
      {isCN && stock.occupancy && stock.readyQueue && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--s-4)",
            marginBottom: "var(--s-5)",
          }}
        >
          {/* Ocupación del próximo contenedor */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: "18px 20px",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 10,
              }}
            >
              <span
                style={{ font: "700 13px/1 var(--f-display)", color: "var(--ink)" }}
              >
                Próximo contenedor a consolidar
              </span>
              <span
                style={{
                  font: "700 12px/1 var(--f-mono)",
                  color:
                    stock.occupancy.tone === "danger"
                      ? "var(--danger)"
                      : stock.occupancy.tone === "warning"
                        ? "var(--warning)"
                        : "var(--success)",
                }}
              >
                {stock.occupancy.pct}%
              </span>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: "var(--bg-elevated)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${stock.occupancy.pct}%`,
                  height: "100%",
                  borderRadius: 999,
                  background:
                    stock.occupancy.tone === "danger"
                      ? "var(--danger)"
                      : stock.occupancy.tone === "warning"
                        ? "var(--warning)"
                        : "var(--success)",
                  transition: "width var(--dur-slow) var(--ease)",
                }}
              />
            </div>
            <div
              style={{
                font: "500 11px/1.3 var(--f-mono)",
                color: "var(--ink-soft)",
                marginTop: "var(--s-2)",
              }}
            >
              {fmt2(stock.occupancy.usedCbm)} / {fmt(stock.occupancy.capacityCbm)} CBM ·
              contenedor 40&apos;HC
            </div>
          </div>

          {/* Cola "listo para consolidar" */}
          <div
            style={{
              background: "var(--ink)",
              color: "var(--ink-inv-soft)",
              borderRadius: "var(--r-lg)",
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
              <span
                style={{
                  font: "600 10px/1 var(--f-sans)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--wine-soft)",
                }}
              >
                Listo para consolidar
              </span>
              <span
                style={{
                  font: "600 9px/1 var(--f-sans)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--ink-inv-mute)",
                  border: "1px solid var(--ink-inv-mute)",
                  borderRadius: "var(--r-pill)",
                  padding: "3px 7px",
                }}
              >
                auto · +3 días
              </span>
            </div>
            <div style={{ font: "900 30px/1 var(--f-display)", marginTop: "var(--s-2)" }}>
              {stock.readyQueue.rows}{" "}
              <span
                style={{ font: "500 14px var(--f-sans)", color: "var(--ink-inv-mute)" }}
              >
                partidas · {fmt2(stock.readyQueue.cbm)} m³
              </span>
            </div>
            <div
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-inv-mute)",
                marginTop: "var(--s-2)",
              }}
            >
              Se deriva solo (recibido + 3 días); el bodeguero podrá marcar/desmarcar
              en Slice B. Agrupar en el próximo embarque optimiza el contenedor — se
              arma en Naviera.
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      {stock.rows.length === 0 ? (
        <EmptyState
          eyebrow="Sin stock"
          title={isCN ? "No hay carga en la bodega CN." : "No hay carga en la bodega VE."}
          description={
            isCN
              ? "Cuando el equipo de Yiwu reciba cajas, aparecerán acá agrupadas por Shipping Mark."
              : "Cuando llegue un contenedor a Valencia y se escaneen sus cajas, el stock de despacho aparecerá acá."
          }
        />
      ) : (
        <StockTable warehouse={warehouse} rows={stock.rows} />
      )}

      {/* Nota de pie */}
      <p
        style={{
          font: "400 12px/1.6 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: "var(--s-5)",
          borderTop: "1px solid var(--border)",
          paddingTop: "var(--s-4)",
        }}
      >
        Torre de solo lectura (Slice A). El stock se deriva de las recepciones en
        bodega (warehouse_receipts CN/VE) y las consolidaciones de Naviera — no se
        inventa. <b>CN = consolidación</b> (entrada, agrupa para el contenedor);{" "}
        <b>VE = despacho</b> (salida, avanza a entrega). El override de &quot;listo&quot;
        y la acción de consolidar entran en Slice B.
      </p>
    </div>
  );
}

function StockTable({
  warehouse,
  rows,
}: {
  warehouse: Warehouse;
  rows: StockRow[];
}) {
  const headers = [
    "Shipping Mark",
    "Cliente",
    warehouse === "CN" ? "Contenido" : "Contenedor",
    "Cajas",
    "CBM",
    "Peso",
    "Días",
    "Estado",
  ];
  const isNumeric = (i: number) => i >= 3 && i <= 6;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-elevated)" }}>
            {headers.map((h, i) => (
              <th
                key={h}
                style={{
                  font: "700 10px/1.2 var(--f-sans)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                  textAlign: isNumeric(i) ? "right" : "left",
                  padding: "11px 14px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const meta = statusMeta(warehouse, r.status);
            return (
              <tr
                key={r.id}
                style={{
                  borderBottom:
                    i < rows.length - 1 ? "1px solid var(--border)" : "0",
                }}
              >
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 12.5px/1 var(--f-mono)",
                    color: "var(--wine-text)",
                  }}
                >
                  {r.markbox}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 13px/1.2 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  {r.clientName}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "400 12.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {r.contents}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 12.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                    textAlign: "right",
                  }}
                >
                  {fmt(r.boxes)}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 12.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                    textAlign: "right",
                  }}
                >
                  {fmt2(r.cbm)}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 12.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                    textAlign: "right",
                  }}
                >
                  {fmt(Math.round(r.weightKg))} kg
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "500 12px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    textAlign: "right",
                  }}
                >
                  {r.daysInWarehouse}d
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

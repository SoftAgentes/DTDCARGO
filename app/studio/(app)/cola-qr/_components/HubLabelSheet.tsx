"use client";

/**
 * SDD-0152 · Plancha de etiquetas del HUB (una por caja real, con su código).
 *
 * Reusa <Label> y FORMATS de /studio/etiquetas — misma etiqueta física, misma
 * marca, mismo QR. La diferencia es de DATOS, no de diseño: acá cada etiqueta
 * lleva el `warehouse_boxes.code` (DTD-B-NNNNNN) porque se imprime DESPUÉS de
 * recibir, cuando la caja ya existe en el sistema. Eso es lo que la hace
 * escaneable al estibar.
 *
 * Modo legacy (`boxes = null`): órdenes previas a SDD-0152 sin receipt_id.
 * Imprime por conteo, sin código — rotula pero no se puede escanear.
 *
 * Print: calca el patrón de LabelGeneratorClient (@page dinámico +
 * #dtd-print-target). Es client component solo por el <style> de impresión.
 */

import { Label, warehouseAddress } from "../../etiquetas/_components/Label";
import { FORMATS, type LabelFormat } from "@/lib/studio/etiquetas-formats";
import type { LabelWarehouseCn } from "../../etiquetas/page";
import { DTD_BRAND } from "@/lib/shared/brand-context";

type Props = {
  formatId: string;
  markbox: string;
  clientName: string;
  /** Cajas reales con su código. `null` → modo legacy (solo conteo). */
  boxes: { code: string; seq: number }[] | null;
  legacyCount: number;
  warehouseRow: LabelWarehouseCn | null;
};

/** Fallback cuando la orden no tiene hub: DTD opera una sola bodega real. */
const FALLBACK_WAREHOUSE: LabelWarehouseCn = {
  id: "",
  code: "YIWU",
  city: "Yiwu",
  hub_name_cn: null,
  warehouse_name: null,
};

export function HubLabelSheet({
  formatId,
  markbox,
  clientName,
  boxes,
  legacyCount,
  warehouseRow,
}: Props) {
  const format: LabelFormat = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];
  const warehouse = warehouseAddress(warehouseRow ?? FALLBACK_WAREHOUSE);
  // SDD-0255 · el HUB imprime desde `qr_print_orders`, que guarda el markbox
  // desnormalizado y nunca toca `clients`, así que desde acá NO se puede resolver
  // el aliado sin una consulta nueva. Va con la marca de la casa a propósito: hoy
  // `qr_print_orders` tiene 0 filas en producción — nunca se imprimió una— así que
  // no hay etiqueta de aliado en riesgo. Al primer uso real, resolver por markbox.
  const client = { markbox, name: clientName, company: null, brand: DTD_BRAND };

  // Con cajas reales, una etiqueta por caja y su código. Sin ellas, por conteo.
  const items: { boxIndex: number; total: number; code: string | null }[] = boxes
    ? boxes.map((b, i) => ({ boxIndex: i + 1, total: boxes.length, code: b.code }))
    : Array.from({ length: Math.max(0, Math.min(500, legacyCount)) }, (_, i) => ({
        boxIndex: i + 1,
        total: legacyCount,
        code: null,
      }));

  if (items.length === 0) return null;

  const perPage = format.perPage;
  const pages = Math.ceil(items.length / perPage);

  return (
    <>
      <div id="dtd-print-target" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: pages }).map((_, pi) => {
          const pageItems = items.slice(pi * perPage, (pi + 1) * perPage);
          return (
            <div
              key={pi}
              style={{
                width: `${format.page.w}mm`,
                height: `${format.page.h}mm`,
                padding: `${format.page.marginY}mm ${format.page.marginX}mm`,
                background: "var(--bg-surface)",
                boxShadow: "0 2px 10px rgba(15,30,61,0.10), 0 0 0 1px rgba(15,30,61,0.06)",
                display: "grid",
                gridTemplateColumns: `repeat(${format.cell.cols}, ${format.cell.w}mm)`,
                gridAutoRows: `${format.cell.h}mm`,
                columnGap: `${format.cell.gutterX}mm`,
                rowGap: `${format.cell.gutterY}mm`,
                justifyContent: "center",
                alignContent: "flex-start",
                boxSizing: "border-box",
                position: "relative",
                pageBreakAfter: "always",
                breakAfter: "page",
              }}
            >
              {pageItems.map((it, li) => (
                <Label
                  key={`${pi}-${li}`}
                  format={format}
                  client={client}
                  warehouse={warehouse}
                  boxIndex={it.boxIndex}
                  totalBoxes={it.total}
                  qr
                  boxCode={it.code}
                  brand={client.brand}
                  />
              ))}
              <div
                className="dtd-pagenum"
                style={{
                  position: "absolute",
                  right: 10,
                  bottom: 6,
                  font: "600 9px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                Página {pi + 1} de {pages}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          @page { size: ${format.page.w}mm ${format.page.h}mm; margin: 0; }
          body * { visibility: hidden !important; }
          #dtd-print-target, #dtd-print-target * { visibility: visible !important; }
          #dtd-print-target {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
            padding: 0 !important; margin: 0 !important;
            background: #ffffff !important;
            gap: 0 !important;
          }
          #dtd-print-target > div { box-shadow: none !important; }
          .no-print, .dtd-pagenum { display: none !important; }
        }
      `}</style>
    </>
  );
}

"use client";

/**
 * SDD-0173 · "Así queda tu orden a DTD — en vivo".
 *
 * El panel lateral sticky del Norte: mientras el cliente elige proveedor y
 * servicios, acá se va escribiendo —en castellano, en primera persona— el
 * mensaje que DTD va a recibir. No es un resumen de campos: es la orden.
 *
 * Lo que se lee acá es LO MISMO que viaja al equipo: las líneas salen de
 * `buildPurchaseOrderLines`, el mismo helper que usa la server action al
 * guardar las solicitudes de servicio.
 *
 * Sólo tokens `var(--*)` (BRAND.md). El tema oscuro es el default del portal y
 * los tokens con nombre de color voltean, así que sobre relleno wine va
 * `--color-on-accent`, nunca `text-white`.
 */

import { DocIcon } from "@/components/Icon";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import {
  buildPurchaseOrderLines,
  type PurchaseOrderLine,
} from "@/lib/portal/purchase-order-lines";

export function PurchaseOrderLive({
  supplierName,
  addons,
  selected,
  holdCount,
  holdTie,
}: {
  supplierName: string | null;
  addons: PrealertaAddon[];
  selected: ReadonlySet<string>;
  holdCount: number;
  holdTie: boolean;
}) {
  const lines: PurchaseOrderLine[] = buildPurchaseOrderLines({
    addons,
    selected: [...selected] as PurchaseOrderLine["code"][],
    holdCount,
    holdTie,
  });

  return (
    <div
      className="rounded-[14px] p-4 border"
      style={{
        borderColor: "var(--color-wine)",
        background: "var(--color-paper)",
      }}
    >
      <div
        className="flex items-center gap-2 text-[10px] font-bold tracking-[0.1em] uppercase"
        style={{ color: "var(--color-wine-text)" }}
      >
        <DocIcon size={13} />
        Así queda tu orden a DTD — en vivo
      </div>

      <div className="mt-2.5 text-[13px] leading-[1.6] text-ink">
        <p className="m-0">
          Hola, DTD Cargo. Te aviso que viene mercancía de mi proveedor{" "}
          <strong>{supplierName?.trim() || "mi proveedor"}</strong> para ser
          enviada por barco.
        </p>

        {lines.length > 0 && (
          <>
            <p className="mt-2 mb-1.5 font-bold">Aparte, requiero:</p>
            <ol className="m-0 pl-[18px] flex flex-col gap-1.5">
              {lines.map((l) => (
                <li key={l.code} className="text-[12.5px] leading-[1.5]">
                  <strong>{l.desc}</strong>
                  <span className="block mt-0.5 font-medium text-grey-700">
                    {l.fee}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

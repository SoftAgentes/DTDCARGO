"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowIcon,
  BoxIcon,
  ShipIcon,
  TruckIcon,
  CloseIcon,
} from "@/components/Icon";
import {
  PREALERTA_STATUS,
  PREALERTA_STATUSES,
  prealertaStatusTone,
  type BadgeTone,
  type PrealertaStatus,
} from "@/lib/studio/prealertas/types";
import { PrealertaStatusBadge } from "../../_components/PrealertaStatusBadge";

/**
 * Lista "Mis compras" del Portal (SDD-0057) rediseñada al Norte. Mismo lenguaje
 * visual que el hub `PortalAlertasHub` (etapas con color, pills con conteo, cards
 * con ícono por estado), pero enfocada SOLO en compras (prealertas) — sin mezclar
 * envíos. Client: filtro por estado (estado de UI puro). Los tokens son
 * theme-aware → sirve en el portal claro y en el oscuro del Norte.
 *
 * SDD-0281: la card lleva al DETALLE de la compra, no directo a las etiquetas.
 * Antes el listado era terminal — se veía el badge de estado y no había forma de
 * abrir la compra para saber si llegó a Yiwu ni cuántas cajas se recibieron.
 */
export type CompraItem = {
  code: string;
  description: string;
  supplierName: string | null;
  boxes: number;
  status: PrealertaStatus;
  /** nº de servicios de recepción pedidos sobre esta compra (SDD-0098). */
  services: number;
};

const TONE_COLOR: Record<BadgeTone, string> = {
  success: "var(--color-status-success)",
  warning: "var(--color-status-warning)",
  danger: "var(--color-status-danger)",
  info: "var(--portal-info)",
  wine: "var(--color-wine)",
  neutral: "var(--color-grey-500)",
};

function tint(color: string, pct = 14) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/** Ícono por estado (el ciclo de una compra: la creas → viaja → llega → consolida). */
function StatusIcon({ status, size = 16 }: { status: PrealertaStatus; size?: number }) {
  if (status === "anunciada")
    return (
      <span className="font-bold leading-none" style={{ fontSize: `${size + 3}px` }} aria-hidden>
        +
      </span>
    );
  if (status === "en_camino") return <TruckIcon size={size} />;
  if (status === "recibida") return <BoxIcon size={size} />;
  if (status === "consolidada") return <ShipIcon size={size} />;
  return <CloseIcon size={size} />;
}

export function ComprasList({ items }: { items: CompraItem[] }) {
  const [status, setStatus] = useState<"todas" | PrealertaStatus>("todas");

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: items.length };
    for (const s of PREALERTA_STATUSES) c[s] = 0;
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  // Pills: "Todas" + solo los estados con al menos una compra, en orden de ciclo.
  const pills = useMemo(
    () => [
      { k: "todas" as const, l: "Todas" },
      ...PREALERTA_STATUSES.filter((s) => counts[s] > 0).map((s) => ({
        k: s,
        l: PREALERTA_STATUS[s].label,
      })),
    ],
    [counts],
  );

  const list = status === "todas" ? items : items.filter((it) => it.status === status);

  return (
    <div>
      {/* Pills de filtro con conteo (mismo patrón que el hub de envíos) */}
      {pills.length > 1 ? (
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-paper border border-grey-200">
          {pills.map((p) => {
            const on = status === p.k;
            return (
              <button
                key={p.k}
                type="button"
                onClick={() => setStatus(p.k)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  on ? "bg-white text-wine-text card-shadow" : "text-grey-500 hover:text-ink"
                }`}
              >
                {p.l}
                <span
                  className={`text-[10.5px] ${on ? "text-wine-text" : "text-grey-500"}`}
                  style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                >
                  {counts[p.k]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {list.map((it) => {
          const color = TONE_COLOR[prealertaStatusTone(it.status)];
          return (
            <Link
              key={it.code}
              href={`/portal/compras/${encodeURIComponent(it.code)}`}
              className="card-shadow card-link group bg-white border border-grey-200 rounded-[16px] p-5 flex items-start gap-4 flex-wrap transition-colors hover:border-ink focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              aria-label={`Abrir la compra ${it.code}`}
            >
              <span
                className="grid place-items-center h-9 w-9 rounded-[10px] flex-shrink-0"
                style={{ background: tint(color, 16), color }}
              >
                <StatusIcon status={it.status} size={16} />
              </span>

              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className="text-[13.5px] font-bold text-ink"
                    style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                  >
                    {it.code}
                  </span>
                  <PrealertaStatusBadge status={it.status} />
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink truncate">
                  {it.description}
                </div>
                <div className="mt-0.5 text-[12px] text-grey-500">
                  {it.supplierName ?? "Sin proveedor"} · {it.boxes} caja
                  {it.boxes === 1 ? "" : "s"}
                  {it.services > 0
                    ? ` · ${it.services} servicio${it.services === 1 ? "" : "s"}`
                    : ""}
                </div>
              </div>

              <span className="flex items-center gap-2 flex-shrink-0 self-center">
                <span className="text-[12px] text-grey-500 hidden sm:inline">Ver detalle</span>
                <ArrowIcon size={18} className="text-grey-300 transition-colors group-hover:text-wine-text" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

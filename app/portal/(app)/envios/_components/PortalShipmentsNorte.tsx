"use client";

import { useState } from "react";
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, SearchIcon, WhatsAppIcon } from "@/components/Icon";
import {
  SERVICE_SHORT_LABELS,
  computeProgress,
  isActiveShipmentStatus,
  type PortalShipmentRow,
} from "@/lib/portal/portal-types";
import { StatusBadge } from "../../../_components/StatusBadge";

/**
 * "Mis envíos" — REDISEÑO NORTE (founder 2026-06-20). GATEADO al demo; los clientes
 * reales siguen con la lista plana actual. Eleva la lista a la imagen del Norte
 * (`PortalShipments` de `_norte/portal/app.jsx`): tabs (Todos/En curso/Entregados) +
 * buscador por código + grid de cards con BARRA DE PROGRESO. Client component por el
 * estado de tab/búsqueda; recibe los envíos ya cargados (mismo `listMyShipments`).
 *
 * El progreso sale de `computeProgress(status)` (mapa canónico del repo). Honesto:
 * la fila (`PortalShipmentRow`) no trae CBM/ETA, así que la card no los muestra (eso
 * vive en el detalle); en su lugar va el tipo de servicio + % + última actualización.
 */

type Tab = "all" | "active" | "delivered";

export function PortalShipmentsNorte({
  shipments,
}: {
  shipments: PortalShipmentRow[];
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const activeCount = shipments.filter((s) =>
    isActiveShipmentStatus(s.status),
  ).length;
  const deliveredCount = shipments.filter(
    (s) => s.status === "delivered",
  ).length;

  const filtered = shipments.filter((s) => {
    if (tab === "active" && !isActiveShipmentStatus(s.status)) return false;
    if (tab === "delivered" && s.status !== "delivered") return false;
    if (q.trim() && !s.code.toLowerCase().includes(q.trim().toLowerCase()))
      return false;
    return true;
  });

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "all", label: "Todos", count: shipments.length },
    { value: "active", label: "En curso", count: activeCount },
    { value: "delivered", label: "Entregados", count: deliveredCount },
  ];

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1
        className="h-display mt-3"
        style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}
      >
        Mis envíos.
      </h1>
      <p className="lead mt-3">
        {shipments.length}{" "}
        {shipments.length === 1 ? "embarque" : "embarques"} en total ·{" "}
        {activeCount} en curso
      </p>

      {/* Tabs + buscador */}
      <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-5">
          {tabs.map((t) => {
            const on = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`relative rounded-[6px] pb-2.5 inline-flex items-center gap-1.5 text-[13.5px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-[color:var(--color-paper)] ${
                  on ? "text-ink" : "text-grey-500 hover:text-grey-700"
                }`}
              >
                {t.label}
                <span
                  className={`text-[11px] font-bold ${on ? "text-wine" : "text-grey-300"}`}
                >
                  {t.count}
                </span>
                {on ? (
                  <span className="absolute left-0 right-0 bottom-0 h-0.5 rounded-full bg-wine" />
                ) : null}
              </button>
            );
          })}
        </div>

        <label className="relative block sm:w-[260px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-700">
            <SearchIcon size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código de envío…"
            aria-label="Buscar envío por código"
            className="w-full pl-9 pr-3 h-10 rounded-[10px] bg-white border border-grey-200 text-[13.5px] text-ink placeholder:text-grey-700 outline-none transition-colors focus:border-ink"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState empty={shipments.length === 0} />
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <ShipCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShipCard({ s }: { s: PortalShipmentRow }) {
  const progress = computeProgress(s.status);
  const delivered = s.status === "delivered";
  return (
    <Link
      href={`/portal/envios/${encodeURIComponent(s.code)}`}
      className="card-shadow card-link group bg-white border border-grey-200 rounded-[16px] p-5 flex flex-col transition-colors hover:border-ink focus-visible:border-ink"
      aria-label={`Ver detalle del envío ${s.code}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[14px] font-bold text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {s.code}
        </span>
        <StatusBadge status={s.status} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-[13px] min-w-0">
        <span className="font-semibold text-ink truncate">{cityOf(s.origin)}</span>
        <span className="text-wine flex-shrink-0">→</span>
        <span className="font-semibold text-ink truncate">
          {cityOf(s.destination)}
        </span>
      </div>

      <div className="mt-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-grey-700 bg-grey-100">
          {SERVICE_SHORT_LABELS[s.service]}
        </span>
      </div>

      <div className="mt-4">
        <div className="h-1.5 rounded-full bg-grey-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: delivered
                ? "var(--color-status-success)"
                : "var(--color-wine)",
            }}
          />
        </div>
        <div
          className="mt-2 flex items-center justify-between text-[11.5px] text-grey-500"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          <span>{progress}%</span>
          <span>Act. {formatDate(s.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ empty }: { empty: boolean }) {
  const waLink = buildWhatsAppLink(
    "Hola DTD Cargo, soy cliente y tengo una consulta sobre mis envíos.",
  );
  return (
    <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
      <div className="text-[16px] font-bold text-ink">
        {empty ? "Todavía no tienes envíos." : "Sin envíos en esta vista."}
      </div>
      <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
        {empty
          ? "Cuando confirmes tu primera carga con tu asesor, va a aparecer acá con su estado."
          : "Prueba con otra pestaña o limpia la búsqueda."}
      </p>
      {empty ? (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mt-6 inline-flex items-center gap-2"
        >
          <WhatsAppIcon size={16} /> Escribir a mi asesor <ArrowIcon size={15} />
        </a>
      ) : null}
    </div>
  );
}

/** Ciudad (parte antes de la coma) para mostrar rutas compactas. */
function cityOf(loc: string | null): string {
  if (!loc) return "—";
  return loc.split(",")[0]?.trim() || loc;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "—";
  }
}

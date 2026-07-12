"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ALERT_STAGE_META,
  ALERT_STAGES,
  countByStage,
  filterByStage,
  type AlertItem,
  type AlertStage,
  type AlertStageTone,
} from "@/lib/portal/alertas";
import {
  ArrowIcon,
  BoxIcon,
  ShipIcon,
  DocIcon,
  CheckIcon,
  DownloadIcon,
  RadarIcon,
  TruckIcon,
} from "@/components/Icon";
import { NewPurchaseButton } from "../../../_components/NewPurchaseButton";
import { NewPurchaseModal } from "../../../_components/NewPurchaseModal";
import { ServiceRequestButton } from "../../../_components/ServiceRequestButton";
import type { SupplierView } from "@/lib/studio/prealertas/types";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";

/**
 * Hub "Alertas · mis envíos" (Norte `PortalAlertas`). Unifica el ciclo
 * Pre-alerta → Alerta → Envío en una sola lista con pipeline + tabs + filas.
 * Toda la lógica de datos es pura (`lib/portal/alertas`); acá solo estado de UI
 * (tab activa, panel de docs abierto, vista lista/seguimiento).
 *
 * Datos por props desde la página server:
 *  - `items` ya mezclados/ordenados (prealertas + envíos).
 *  - `docs`  presencia de documentos por ítem (Slice B), key = `item.key`.
 *  - `track` envíos en camino con su progreso (Slice C · Seguimiento total).
 *  - `banner` copy del próximo consolidado (cut-off), null si no hay salida.
 */
export type DocPresence = { packing: boolean; factura: boolean; foto: boolean };

export type TrackItem = {
  id: string;
  code: string;
  /** 0–100, derivado del status (computeProgress). */
  progress: number;
  statusLabel: string;
  route: string | null;
};

const TONE_COLOR: Record<AlertStageTone, string> = {
  wine: "var(--color-wine)",
  warning: "var(--color-status-warning)",
  info: "var(--portal-info)",
};

function tint(color: string, pct = 14) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

function StageIcon({ stage, size = 16 }: { stage: AlertStage; size?: number }) {
  if (stage === "prealerta")
    return (
      <span
        className="font-bold leading-none"
        style={{ fontSize: `${size + 3}px` }}
        aria-hidden
      >
        +
      </span>
    );
  if (stage === "alerta") return <BoxIcon size={size} />;
  return <ShipIcon size={size} />;
}

export function PortalAlertasHub({
  items,
  docs,
  track,
  banner,
  markbox,
  suppliers,
  addons,
}: {
  items: AlertItem[];
  docs: Record<string, DocPresence>;
  track: TrackItem[];
  banner: { route: string; sentence: string } | null;
  markbox: string;
  suppliers: SupplierView[];
  addons: PrealertaAddon[];
}) {
  const [view, setView] = useState<"list" | "track">("list");
  const [stage, setStage] = useState<"todas" | AlertStage>("todas");
  const [openDocs, setOpenDocs] = useState<string | null>(null);
  // "Nueva compra" abre el modal acá mismo (no desvía a /proveedores).
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const counts = countByStage(items);
  const list = filterByStage(items, stage);

  if (view === "track") {
    return <SeguimientoTotal track={track} onBack={() => setView("list")} />;
  }

  const tabs: { k: "todas" | AlertStage; l: string }[] = [
    { k: "todas", l: "Todas" },
    { k: "prealerta", l: "Pre-alertas" },
    { k: "alerta", l: "Alertas" },
    { k: "envio", l: "Envíos" },
  ];

  return (
    <div>
      {/* Header + acciones */}
      <div className="eyebrow eyebrow-wine">Alertas · mis envíos</div>
      <div className="mt-2 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <h1 className="h-display" style={{ fontSize: "clamp(28px, 4.2vw, 44px)" }}>
          Mis envíos
        </h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setView("track")}
            className="btn btn-ghost inline-flex items-center gap-2"
          >
            <RadarIcon size={15} /> Seguimiento total
          </button>
          <Link
            href="/portal/proveedores"
            className="btn btn-ghost inline-flex items-center gap-2"
          >
            <TruckIcon size={16} /> Mis proveedores
          </Link>
          <NewPurchaseButton onClick={() => setPurchaseOpen(true)} />
          <ServiceRequestButton markbox={markbox} />
        </div>
      </div>

      {purchaseOpen && (
        <NewPurchaseModal
          suppliers={suppliers}
          addons={addons}
          preselected={null}
          onClose={() => setPurchaseOpen(false)}
        />
      )}

      {banner ? <ConsolidadoBanner banner={banner} /> : null}

      {/* Pipeline Pre-alerta → Alerta → Envío */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[14px] bg-paper border border-grey-200 px-5 py-4">
        {ALERT_STAGES.map((s, i) => {
          const m = ALERT_STAGE_META[s];
          const color = TONE_COLOR[m.tone];
          return (
            <div key={s} className="flex items-center gap-3">
              <span
                className="grid place-items-center h-7 w-7 rounded-full flex-shrink-0"
                style={{ background: tint(color, 16), color }}
              >
                <StageIcon stage={s} size={14} />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[13.5px] font-bold text-ink">{m.label}</span>
                <span className="text-[12px] text-grey-500">{m.desc}</span>
              </span>
              {i < ALERT_STAGES.length - 1 ? (
                <ArrowIcon size={15} className="text-grey-300 ml-1" />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Tabs con conteo */}
      <div className="mt-6 inline-flex flex-wrap gap-1 p-1 rounded-full bg-paper border border-grey-200">
        {tabs.map((t) => {
          const on = stage === t.k;
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setStage(t.k)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                on ? "bg-white text-wine card-shadow" : "text-grey-500 hover:text-ink"
              }`}
            >
              {t.l}
              <span
                className={`text-[10.5px] ${on ? "text-wine" : "text-grey-500"}`}
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {counts[t.k]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filas */}
      <div className="mt-6 flex flex-col gap-3">
        {list.length === 0 ? (
          <EmptyState stage={stage} />
        ) : (
          list.map((it) => (
            <AlertRow
              key={it.key}
              item={it}
              docs={docs[it.key]}
              open={openDocs === it.key}
              onToggleDocs={() =>
                setOpenDocs((cur) => (cur === it.key ? null : it.key))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function AlertRow({
  item,
  docs,
  open,
  onToggleDocs,
}: {
  item: AlertItem;
  docs: DocPresence | undefined;
  open: boolean;
  onToggleDocs: () => void;
}) {
  const m = ALERT_STAGE_META[item.stage];
  const color = TONE_COLOR[m.tone];
  const isEnvio = item.stage === "envio";
  const docCount = docs
    ? (docs.packing ? 1 : 0) + (docs.factura ? 1 : 0) + (docs.foto ? 1 : 0)
    : 0;

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[16px] p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <span
          className="grid place-items-center h-9 w-9 rounded-[10px] flex-shrink-0"
          style={{ background: tint(color, 16), color }}
        >
          <StageIcon stage={item.stage} size={16} />
        </span>

        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className="text-[13.5px] font-bold text-ink"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            >
              {item.code}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{
                color,
                background: tint(color, 16),
                border: `1px solid ${tint(color, 42)}`,
              }}
            >
              {m.label}
            </span>
          </div>
          <div className="mt-1.5 text-[13px] font-semibold text-ink">{item.title}</div>
          <div className="mt-0.5 text-[12px] text-grey-500">{item.meta}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isEnvio ? (
            <Link
              href={`/portal/envios/${encodeURIComponent(item.code)}`}
              className="inline-flex items-center gap-1.5 rounded text-[12.5px] font-bold text-wine hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Ver seguimiento <ArrowIcon size={13} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onToggleDocs}
              aria-expanded={open}
              className={`inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                open ? "border-grey-300 bg-paper" : "border-grey-200 bg-white hover:bg-paper"
              } text-ink`}
            >
              <DocIcon size={13} /> Documentos{" "}
              <span
                className="text-[10px]"
                style={{
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                  color: docCount ? "var(--color-status-success)" : "var(--color-grey-500)",
                }}
              >
                {docCount}/3
              </span>
            </button>
          )}
        </div>
      </div>

      {open && !isEnvio ? (
        <DocsPanel code={item.code} docs={docs} />
      ) : null}
    </div>
  );
}

/** Panel expandible de documentos de una compra (packing/factura/foto). */
function DocsPanel({ code, docs }: { code: string; docs: DocPresence | undefined }) {
  const rows: { key: keyof DocPresence; label: string; ok: boolean }[] = [
    { key: "packing", label: "Packing list", ok: !!docs?.packing },
    { key: "factura", label: "Factura", ok: !!docs?.factura },
    { key: "foto", label: "Fotos", ok: !!docs?.foto },
  ];
  return (
    <div className="mt-4 pt-4 border-t border-grey-200">
      <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-grey-500 mb-3">
        Documentos de esta compra
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center gap-2 rounded-[10px] px-3 py-2.5"
            style={{
              background: r.ok
                ? "color-mix(in srgb, var(--color-status-success) 12%, transparent)"
                : "var(--color-paper)",
            }}
          >
            <span style={{ color: r.ok ? "var(--color-status-success)" : "var(--color-grey-500)" }}>
              {r.ok ? <CheckIcon size={14} /> : <DownloadIcon size={14} />}
            </span>
            <span className="flex-1 text-[12px] font-semibold text-ink">{r.label}</span>
          </div>
        ))}
      </div>
      <Link
        href={`/portal/compras/${encodeURIComponent(code)}/etiquetas`}
        className="mt-3 inline-flex items-center gap-1.5 rounded text-[12.5px] font-bold text-wine hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Gestionar documentos y etiquetas <ArrowIcon size={13} />
      </Link>
      <p className="mt-2 text-[11px] text-grey-500 leading-[1.5]">
        Los documentos quedan atados a esta compra durante todo el ciclo — de
        pre-alerta a envío.
      </p>
    </div>
  );
}

/** Banner "Próximo consolidado" (cut-off). Copy ya armado en el server. */
function ConsolidadoBanner({
  banner,
}: {
  banner: { route: string; sentence: string };
}) {
  return (
    <div
      className="mt-6 rounded-[14px] border-l-[3px] p-5"
      style={{
        background: "color-mix(in srgb, var(--color-wine) 8%, transparent)",
        borderColor: "var(--color-wine)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <ShipIcon size={18} className="text-wine flex-shrink-0" />
        <div className="text-[14px] font-bold text-ink">
          Próximo consolidado · {banner.route}
        </div>
      </div>
      <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.55]">
        {banner.sentence}
      </p>
    </div>
  );
}

/** Seguimiento total (Slice C): envíos en camino con su progreso. */
function SeguimientoTotal({
  track,
  onBack,
}: {
  track: TrackItem[];
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-grey-700 hover:text-ink mb-4"
      >
        <ArrowIcon size={13} className="rotate-180" /> Volver a Alertas · mis envíos
      </button>
      <div className="eyebrow eyebrow-wine">Seguimiento total</div>
      <h1 className="h-display mt-2" style={{ fontSize: "clamp(26px, 3.8vw, 38px)" }}>
        Mis envíos en camino
      </h1>
      <p className="lead mt-2 max-w-[60ch]">
        El estado de cada carga que ya viaja hacia ti, con su avance en el viaje
        China → Venezuela.
      </p>

      {track.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center text-[14px] text-grey-700">
          Aún no tienes envíos en camino.
        </div>
      ) : (
        <div className="mt-7 flex flex-col gap-3">
          {track.map((t) => (
            <Link
              key={t.id}
              href={`/portal/envios/${encodeURIComponent(t.code)}`}
              className="card-shadow card-link group bg-white border border-grey-200 rounded-[16px] p-5 transition-colors hover:border-ink focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="grid place-items-center h-9 w-9 rounded-[10px] flex-shrink-0"
                  style={{ background: tint("var(--color-wine)", 14), color: "var(--color-wine)" }}
                >
                  <ShipIcon size={17} />
                </span>
                <div className="flex-1 min-w-[160px]">
                  <span
                    className="text-[13.5px] font-bold text-ink"
                    style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                  >
                    {t.code}
                  </span>
                  <div className="mt-0.5 text-[12px] text-grey-500">
                    {t.statusLabel}
                    {t.route ? ` · ${t.route}` : ""}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-wine">
                  Ver <ArrowIcon size={13} />
                </span>
              </div>
              <div
                className="mt-4 h-1.5 rounded-full bg-grey-100 overflow-hidden"
                role="progressbar"
                aria-valuenow={t.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${t.progress}% del viaje`}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${t.progress}%`, background: "var(--color-wine)" }}
                />
              </div>
              <div
                className="mt-1.5 text-[11px] text-grey-500"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {t.progress}%
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ stage }: { stage: "todas" | AlertStage }): ReactNode {
  const empty = stage === "todas";
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
      <div className="text-[16px] font-bold text-ink">
        {empty ? "Todavía no tienes compras ni envíos." : "No hay ítems en esta etapa."}
      </div>
      <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
        {empty
          ? "Registra tu primera compra desde Tus proveedores para avisarnos que viene mercancía de China."
          : "Prueba con otra pestaña."}
      </p>
      {empty ? (
        <Link href="/portal/proveedores" className="btn btn-primary mt-6 inline-flex">
          Ir a Tus proveedores <ArrowIcon />
        </Link>
      ) : null}
    </div>
  );
}

"use client";

import { useId, useState, type ReactNode } from "react";
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
  groupCountLabel,
  type TrackGroup,
} from "@/lib/portal/seguimiento";
import {
  ArrowIcon,
  BoxIcon,
  ShipIcon,
  ContainerIcon,
  DocIcon,
  CheckIcon,
  ChevronDownIcon,
  RadarIcon,
  TruckIcon,
  WarehouseIcon,
} from "@/components/Icon";
import { NewPurchaseButton } from "../../../_components/NewPurchaseButton";
import { ServiceRequestButton } from "../../../_components/ServiceRequestButton";
import { PortalTrackingEnConstruccion } from "../../../_components/PortalTrackingEnConstruccion";

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

/** Solo tiñe ICONOS y fondos (los rótulos van en `text-ink`) → umbral 3:1. */
const TONE_COLOR: Record<AlertStageTone, string> = {
  wine: "var(--color-wine)",
  warning: "var(--color-status-warning)",
  info: "var(--portal-info)",
  neutral: "var(--color-ink)",
  success: "var(--color-status-success)",
};

function tint(color: string, pct = 14) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/**
 * ETA del zarpe → "llega aprox. 14 ago". null si no hay fecha o no parsea.
 *
 * `timeZone: "UTC"` NO es decorativo: `sailings.eta` es una columna `date`
 * (sin hora), y `new Date("2026-08-14")` la ancla a medianoche UTC. Formateándola
 * en la zona local (Venezuela, GMT-4) retrocede al día anterior — el cliente veía
 * "13 ago" para una llegada del 14.
 */
function formatEta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `llega aprox. ${d.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })}`;
}

function StageIcon({ stage, size = 16 }: { stage: AlertStage; size?: number }) {
  if (stage === "prealerta") return <DocIcon size={size} />;
  if (stage === "alerta") return <BoxIcon size={size} />;
  if (stage === "bodegave") return <WarehouseIcon size={size} />;
  if (stage === "recibido") return <CheckIcon size={size} />;
  return <ShipIcon size={size} />;
}

export function PortalAlertasHub({
  items,
  docs,
  trackGroups,
  banner,
  markbox,
}: {
  items: AlertItem[];
  docs: Record<string, DocPresence>;
  trackGroups: TrackGroup[];
  banner: { route: string; sentence: string } | null;
  markbox: string;
}) {
  const [view, setView] = useState<"list" | "track">("list");
  const [stage, setStage] = useState<"todas" | AlertStage>("todas");
  const [openDocs, setOpenDocs] = useState<string | null>(null);

  const counts = countByStage(items);
  const list = filterByStage(items, stage);

  if (view === "track") {
    return (
      <SeguimientoTotal groups={trackGroups} onBack={() => setView("list")} />
    );
  }

  // Una pestaña por etapa del ciclo (SDD-0170: 5, antes 3).
  const tabs: { k: "todas" | AlertStage; l: string }[] = [
    { k: "todas", l: "Todas" },
    { k: "prealerta", l: "Pre-alertas" },
    { k: "alerta", l: "Alertas" },
    { k: "envio", l: "Envíos" },
    { k: "bodegave", l: "En casa" },
    { k: "recibido", l: "Recibidos" },
  ];

  return (
    <div>
      {/* Header + acciones */}
      <div className="eyebrow eyebrow-wine">Alertas · mis envíos</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-4">
        <h1 className="h-display shrink-0" style={{ fontSize: "clamp(28px, 4.2vw, 44px)" }}>
          Mis envíos
        </h1>
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:min-w-0 sm:flex-1 [&_.btn]:active:translate-y-0! [&_.btn]:active:shadow-none!">
          <NewPurchaseButton href="/portal/compras/nueva" primary />
          <button
            type="button"
            onClick={() => setView("track")}
            className="btn btn-ghost inline-flex items-center gap-2 bg-white! border-grey-500! hover:bg-grey-100! hover:border-ink!"
          >
            <RadarIcon size={15} /> Seguimiento total
          </button>
          <Link
            href="/portal/proveedores"
            className="btn btn-ghost inline-flex items-center gap-2 bg-white! border-grey-500! hover:bg-grey-100! hover:border-ink!"
          >
            <TruckIcon size={16} /> Mis proveedores
          </Link>
          <ServiceRequestButton markbox={markbox} />
        </div>
      </div>

      {/* SDD-0514 · el almacén de China todavía registra en Excel: lo que sigue a
          la pre-alerta sale vacío. El aviso se suma; las filas siguen abajo. */}
      <PortalTrackingEnConstruccion className="mt-6" />

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
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 min-h-12 rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                on ? "bg-white text-ink underline underline-offset-4 card-shadow" : "text-grey-500 hover:text-ink"
              }`}
            >
              {t.l}
              <span
                className={`text-[10.5px] ${on ? "text-wine-text" : "text-grey-500"}`}
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
  const panelId = useId();
  const m = ALERT_STAGE_META[item.stage];
  const color = TONE_COLOR[m.tone];
  // Es un ENVÍO (tiene detalle propio) vs. una compra todavía en prealerta (tiene
  // panel de documentos). Ojo: NO se puede derivar de la etapa — desde SDD-0170 un
  // envío puede estar en `envio`, `bodegave` o `recibido`. El dato que lo define
  // es tener `shipmentId`.
  const isEnvio = item.shipmentId !== null;
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
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{
                // Texto en --color-ink + PUNTO del color de etapa (BRAND §♿).
                // El tono como texto a 10px no llega a AA: medido en el tema
                // oscuro daba wine 2.69 · info 3.91 · success 3.73. El color
                // sigue identificando la etapa en el punto, el borde, el fondo y
                // el ícono de la fila — sin apoyar la legibilidad en él.
                color: "var(--color-ink)",
                background: tint(color, 16),
                border: `1px solid ${tint(color, 42)}`,
              }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
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
              className="inline-flex items-center gap-1.5 rounded text-[12.5px] font-bold text-ink underline underline-offset-4 min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Ver seguimiento <ArrowIcon size={13} />
            </Link>
          ) : (
            <>
              <span className="text-xs text-grey-700">Documentos: {docCount}/3 disponibles</span>
              <button type="button" onClick={onToggleDocs} aria-expanded={open} aria-controls={panelId}
                aria-label={`${open ? "Ocultar" : "Ver"} documentos de ${item.code}`}
                className="btn btn-ghost min-h-12 inline-flex items-center gap-2">
                <DocIcon size={16} /> {open ? "Ocultar documentos" : "Ver documentos"}
                <ChevronDownIcon size={16} className={open ? "rotate-180" : ""} />
              </button>
            </>
          )}
        </div>
      </div>

      {!isEnvio ? (
        <div id={panelId} hidden={!open}>
          {open ? <DocsPanel code={item.code} docs={docs} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Panel expandible de documentos de una compra (packing/factura/foto). */
function DocsPanel({ code, docs }: { code: string; docs: DocPresence | undefined }) {
  const rows: {
    key: keyof DocPresence;
    label: string;
    ok: boolean;
    /** Destino cuando el documento ya se puede leer. */
    href?: string;
  }[] = [
    {
      key: "packing",
      label: "Packing list",
      ok: !!docs?.packing,
      href: docs?.packing
        ? `/portal/compras/${encodeURIComponent(code)}`
        : undefined,
    },
    { key: "factura", label: "Factura", ok: !!docs?.factura },
    { key: "foto", label: "Fotos", ok: !!docs?.foto },
  ];
  return (
    <div className="mt-4 pt-4 border-t border-grey-200">
      <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-grey-500 mb-3">
        Documentos de esta compra
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {rows.map((r) => {
          const contenido = (
            <>
              <DocIcon size={16} className="text-ink" />
              <span className="flex-1 text-sm font-semibold text-ink">{r.label}</span>
              {r.href ? (
                <span className="inline-flex items-center gap-2 text-sm text-ink underline underline-offset-4">
                  Consultar <ArrowIcon size={16} />
                </span>
              ) : (
                <span className="text-xs text-grey-700">{r.ok ? "Recibido" : "Pendiente"}</span>
              )}
            </>
          );
          const base =
            "flex min-h-12 items-center gap-2 rounded-[10px] px-3 py-3 text-left";
          const fondo = {
            background: r.ok
              ? "color-mix(in srgb, var(--color-status-success) 12%, transparent)"
              : "var(--color-paper)",
          };

          // El chip verde anunciaba un documento y no dejaba abrirlo: era un
          // `<div>`. Con packing list enviado, ahora lleva al detalle de la
          // compra, que es donde se lee (SDD-0308).
          return r.href ? (
            <Link
              key={r.key}
              href={r.href}
              className={`${base} transition-colors hover:brightness-[0.97] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink`}
              style={fondo}
            >
              {contenido}
            </Link>
          ) : (
            <div key={r.key} className={base} style={fondo}>
              {contenido}
            </div>
          );
        })}
      </div>
      <Link
        href={`/portal/compras/${encodeURIComponent(code)}/etiquetas`}
        className="btn btn-primary mt-4 min-h-12 inline-flex items-center gap-2"
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
        <ShipIcon size={18} className="text-wine-text flex-shrink-0" />
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

/**
 * Seguimiento total — agrupado por CONTENEDOR (SDD-0170). Las compras que viajan
 * consolidadas se muestran como UN solo seguimiento con su lista adentro; las que
 * todavía no tienen contenedor asignado salen como tarjeta suelta.
 */
function SeguimientoTotal({
  groups,
  onBack,
}: {
  groups: TrackGroup[];
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        // `flex w-fit`, no `inline-flex`: `.eyebrow` de abajo también es
        // inline-flex, así que en inline los dos caían en la MISMA línea y el
        // guion del eyebrow se montaba sobre el texto del botón.
        className="btn btn-ghost flex w-fit min-h-12 items-center gap-2 mb-4"
      >
        <ArrowIcon size={13} className="rotate-180" /> Volver a Alertas · mis envíos
      </button>
      <div className="eyebrow eyebrow-wine">Seguimiento total</div>
      <h1 className="h-display mt-2" style={{ fontSize: "clamp(26px, 3.8vw, 38px)" }}>
        Mis envíos en camino
      </h1>
      <p className="lead mt-2 max-w-[60ch]">
        El estado de cada carga que ya viaja hacia ti, con su avance en el viaje
        China → Venezuela. Las compras que van en el mismo contenedor se siguen
        juntas.
      </p>

      {/* SDD-0514 · mismo aviso que en la lista: esta es la vista que el
          cliente abre para buscar su tracking. */}
      <PortalTrackingEnConstruccion className="mt-6" />

      {groups.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center text-[14px] text-grey-700">
          Aún no tienes envíos en camino.
        </div>
      ) : (
        <div className="mt-7 flex flex-col gap-3">
          {groups.map((g) => (
            <TrackGroupCard key={g.key} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Una tarjeta de seguimiento: un contenedor con sus compras, o un envío suelto.
 * El grupo entero comparte barra de progreso — es la misma caja viajando.
 */
function TrackGroupCard({ group }: { group: TrackGroup }) {
  const consolidado = group.kind === "consolidado";
  const countLabel = groupCountLabel(group);
  // Un envío suelto es clicable entero; un consolidado no, porque sus compras
  // tienen cada una su propio destino — el enlace vive en cada fila.
  const solo = group.items[0];

  const cabecera = (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className="grid place-items-center h-9 w-9 rounded-[10px] flex-shrink-0"
        style={{ background: tint("var(--color-wine)", 14), color: "var(--color-wine)" }}
      >
        {consolidado ? <ContainerIcon size={17} /> : <ShipIcon size={17} />}
      </span>
      <div className="flex-1 min-w-[160px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[13.5px] font-bold text-ink"
            style={
              group.labelIsContainer
                ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }
                : undefined
            }
          >
            {group.label}
          </span>
          {countLabel ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{
                background: tint("var(--color-wine)", 12),
                color: "var(--color-wine-text)",
              }}
            >
              Consolidado · {group.items.length}
            </span>
          ) : null}
        </div>
        {/* El chip ya dice "Consolidado · N": acá va lo que NO se repite —
            la ruta y cuándo llega. En el envío suelto, su estado. */}
        <div className="mt-0.5 text-[12px] text-grey-500">
          {[
            consolidado ? group.route : solo.statusLabel,
            consolidado ? null : group.route,
            formatEta(group.eta),
          ]
            .filter(Boolean)
            .join(" · ") || countLabel}
        </div>
      </div>
      {consolidado ? null : (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-wine-text">
          Ver <ArrowIcon size={13} />
        </span>
      )}
    </div>
  );

  const barra = (
    <>
      <div
        className="mt-4 h-1.5 rounded-full bg-grey-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={group.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${group.progress}% del viaje`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${group.progress}%`, background: "var(--color-wine)" }}
        />
      </div>
      <div
        className="mt-1.5 text-[11px] text-grey-500"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {group.progress}%
      </div>
    </>
  );

  if (!consolidado) {
    return (
      <Link
        href={`/portal/envios/${encodeURIComponent(solo.code)}`}
        className="card-shadow card-link group bg-white border border-grey-200 rounded-[16px] p-5 transition-colors hover:border-ink focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {cabecera}
        {barra}
      </Link>
    );
  }

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[16px] p-5">
      {cabecera}
      {barra}
      <ul className="mt-4 flex flex-col gap-1 border-t border-grey-200 pt-3">
        {group.items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/portal/envios/${encodeURIComponent(t.code)}`}
              className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span
                className="text-[12.5px] font-bold text-ink flex-shrink-0"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {t.code}
              </span>
              <span className="flex-1 min-w-0 truncate text-[12px] text-grey-500">
                {t.statusLabel}
              </span>
              <ArrowIcon size={13} className="text-wine-text flex-shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
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

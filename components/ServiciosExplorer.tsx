"use client";

/**
 * Explorador interactivo de /servicios — "el viaje de tu carga".
 *
 * Capa de PRESENTACIÓN (no conoce la fuente del dato): recibe DDP (paraguas) +
 * las fases ya agrupadas por `agruparPorViaje`. Aporta la interactividad:
 *  - Riel del viaje que FILTRA (toca una etapa → solo sus servicios).
 *  - "Arma tu envío": agrega servicios y cotiza el combo por WhatsApp.
 *
 * Progressive enhancement: lo renderiza Next en el servidor (SSR) → todo el
 * contenido sale en el HTML inicial; el filtro oculta con el atributo `hidden`
 * (no desmonta) y el detalle vive en <details> → SEO/crawler intactos.
 */
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import {
  WhatsAppIcon,
  CheckIcon,
  CloseIcon,
  ChevronDownIcon,
  ShieldIcon,
  WarehouseIcon,
  ShipIcon,
  StampIcon,
} from "@/components/Icon";
import type { ServicioDetalle } from "@/lib/servicios-detalle";
import {
  RAIL_NODOS,
  type FaseRender,
  type ViajeMomento,
} from "@/lib/servicios-timeline";
import {
  FichaCuerpo,
  SedeFlag,
  ESTADO_LABEL,
} from "@/components/servicios/FichaCuerpo";

type IconCmp = ComponentType<{ size?: number; className?: string }>;

const FASE_ICON: Record<ViajeMomento, IconCmp> = {
  origen: ShieldIcon,
  recepcion_bodega: WarehouseIcon,
  transporte_aduana: ShipIcon,
  transversal: StampIcon,
};

type Filtro = "todo" | ViajeMomento;

export function ServiciosExplorer({
  ddp,
  fases,
}: {
  ddp: ServicioDetalle | null;
  fases: FaseRender[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [seleccion, setSeleccion] = useState<string[]>([]);

  const servicios = useMemo(
    () => [...(ddp ? [ddp] : []), ...fases.flatMap((f) => f.servicios)],
    [ddp, fases],
  );
  const porSlug = useMemo(
    () => new Map(servicios.map((s) => [s.slug, s])),
    [servicios],
  );

  // Deep-link (/servicios#slug): si el hash apunta a un servicio, vuelve a
  // "Todo" para que la ficha quede visible (luego OpenDetailsOnHash la abre).
  useEffect(() => {
    const slugs = new Set(servicios.map((s) => s.slug));
    function onHash() {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (id && slugs.has(id)) setFiltro("todo");
    }
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [servicios]);

  const total = fases.reduce((n, f) => n + f.servicios.length, 0);
  const countDe = (id: Filtro) =>
    id === "todo" ? total : (fases.find((f) => f.id === id)?.servicios.length ?? 0);

  const seleccionado = (slug: string) => seleccion.includes(slug);
  const toggle = (slug: string) =>
    setSeleccion((cur) =>
      cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug],
    );

  const cotizar = () => {
    if (!seleccion.length) return;
    const lineas = seleccion
      .map((slug) => `• ${porSlug.get(slug)?.titulo ?? slug}`)
      .join("\n");
    const url = buildWhatsAppLink(
      `Hola DTD Cargo, quiero cotizar estos servicios:\n${lineas}\n¿Me ayudan?`,
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // El riel solo muestra "Todo" + las fases que tienen servicios.
  const nodos = RAIL_NODOS.filter(
    (n) => n.id === "todo" || fases.some((f) => f.id === n.id),
  );

  return (
    <div className="mt-10">
      {/* Paraguas: DDP cubre todo el recorrido */}
      {ddp && (
        <div
          id={ddp.slug}
          className="scroll-mt-28 card-shadow-static bg-white border border-wine rounded-[18px] overflow-hidden"
        >
          <div className="px-6 pt-5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10.5px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-md bg-wine text-white">
                Servicio principal
              </span>
              <span className="text-[12px] text-grey-500">
                Cubre todo el recorrido
              </span>
            </div>
            <div className="mt-3 flex items-start gap-4">
              <span className="flex-shrink-0 mt-0.5">
                <SedeFlag sede={ddp.sede} />
              </span>
              <div className="flex-1 min-w-0">
                <h3
                  className="text-[20px] lg:text-[24px] font-extrabold leading-[1.15] tracking-[-0.01em] text-ink"
                  style={{ fontFamily: "var(--font-archivo-black)" }}
                >
                  {ddp.titulo}
                </h3>
                <p className="mt-1.5 text-[14.5px] leading-[1.5] text-grey-700 max-w-[68ch]">
                  {ddp.resumen}
                </p>
              </div>
              <BotonAgregar
                activo={seleccionado(ddp.slug)}
                onToggle={() => toggle(ddp.slug)}
              />
            </div>
          </div>
          <div className="mt-4">
            <FichaCuerpo service={ddp} />
          </div>
        </div>
      )}

      {/* Riel del viaje — filtro */}
      <div className="mt-10">
        <span className="eyebrow">El viaje de tu carga · toca una etapa</span>
      </div>
      <nav
        aria-label="Filtrar servicios por etapa del viaje"
        className="mt-4 flex flex-wrap gap-2"
      >
        {nodos.map((n) => {
          const activo = filtro === n.id;
          const Icon = n.id === "todo" ? null : FASE_ICON[n.id];
          return (
            <button
              key={n.id}
              type="button"
              aria-pressed={activo}
              onClick={() => setFiltro(n.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-[13px] font-semibold transition-colors ${
                activo
                  ? "bg-wine text-white border-wine"
                  : "bg-white text-ink border-grey-200 hover:border-ink"
              }`}
            >
              {Icon && <Icon size={16} />}
              {n.label}
              <span
                className={`text-[11px] tabular-nums ${activo ? "text-white/80" : "text-grey-500"}`}
              >
                {countDe(n.id)}
              </span>
            </button>
          );
        })}
      </nav>

      {filtro !== "todo" && (
        <div className="mt-6 flex items-center gap-3 text-[13px] text-grey-700">
          <span>
            Mostrando solo:{" "}
            <strong className="font-semibold text-ink">
              {nodos.find((n) => n.id === filtro)?.label}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setFiltro("todo")}
            className="inline-flex items-center gap-1 font-semibold text-wine hover:text-wine-deep"
          >
            <CloseIcon size={12} /> Ver todo el viaje
          </button>
        </div>
      )}

      {/* Secciones por fase */}
      <div className="mt-12 flex flex-col gap-14">
        {fases.map((fase) => {
          const Icon = FASE_ICON[fase.id];
          const oculta = filtro !== "todo" && filtro !== fase.id;
          return (
            <section
              key={fase.id}
              id={`fase-${fase.id}`}
              hidden={oculta}
              className="scroll-mt-28"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 w-10 h-10 rounded-full bg-wine/10 text-wine grid place-items-center">
                  <Icon size={20} />
                </span>
                <div>
                  <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
                    {fase.eyebrow}
                  </span>
                  <h3
                    className="mt-1 text-[22px] lg:text-[28px] leading-[1.1] tracking-[-0.01em] text-ink"
                    style={{ fontFamily: "var(--font-archivo-black)" }}
                  >
                    {fase.titulo}
                  </h3>
                </div>
              </div>
              <p className="mt-2 text-[14.5px] leading-[1.55] text-grey-700 max-w-[64ch]">
                {fase.blurb}
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {fase.servicios.map((s) => (
                  <Tarjeta
                    key={s.slug}
                    service={s}
                    activo={seleccionado(s.slug)}
                    onToggle={() => toggle(s.slug)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Arma tu envío — barra sticky */}
      {seleccion.length > 0 && (
        <div className="sticky bottom-3 z-10 mt-12">
          <div className="card-shadow bg-white border border-grey-200 rounded-[18px] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[13px] font-bold text-ink">
                Tu envío{" "}
                <span className="font-normal text-grey-500">
                  · {seleccion.length} servicio{seleccion.length > 1 ? "s" : ""}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {seleccion.map((slug) => (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-grey-100 text-ink"
                  >
                    {porSlug.get(slug)?.titulo ?? slug}
                    <button
                      type="button"
                      aria-label={`Quitar ${porSlug.get(slug)?.titulo ?? slug}`}
                      onClick={() => toggle(slug)}
                      className="text-grey-500 hover:text-wine"
                    >
                      <CloseIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={cotizar}
              className="btn btn-primary w-full sm:w-auto flex-shrink-0"
              style={{ height: 44 }}
            >
              <WhatsAppIcon size={16} /> Cotiza por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BotonAgregar({
  activo,
  onToggle,
}: {
  activo: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={(e) => {
        // Dentro de <summary> el click haría toggle del acordeón: lo evitamos.
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        activo
          ? "bg-wine text-white border-wine"
          : "bg-white text-ink border-grey-300 hover:border-wine hover:text-wine"
      }`}
    >
      {activo ? (
        <>
          <CheckIcon size={13} /> Agregado
        </>
      ) : (
        <>
          <span aria-hidden>+</span> Agregar
        </>
      )}
    </button>
  );
}

function Tarjeta({
  service,
  activo,
  onToggle,
}: {
  service: ServicioDetalle;
  activo: boolean;
  onToggle: () => void;
}) {
  const estado = service.estado ?? "activo";
  return (
    <details
      id={service.slug}
      className={`brochure-group group scroll-mt-28 card-shadow bg-white border rounded-[14px] overflow-hidden ${
        activo ? "border-wine" : "border-grey-200"
      }`}
    >
      <summary className="cursor-pointer px-6 py-5 flex items-start gap-4 select-none">
        <span className="flex-shrink-0 mt-0.5">
          <SedeFlag sede={service.sede} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[16.5px] lg:text-[18px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">
              {service.titulo}
            </span>
            {estado !== "activo" && (
              <span className="text-[10.5px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-md bg-grey-100 text-grey-700">
                {ESTADO_LABEL[estado]}
              </span>
            )}
          </span>
          <span className="mt-1.5 block text-[14px] leading-[1.5] text-grey-700">
            {service.resumen}
          </span>
        </span>
        <BotonAgregar activo={activo} onToggle={onToggle} />
        <span
          className="flex-shrink-0 mt-1 w-6 h-6 grid place-items-center text-grey-500 group-open:text-wine transition-transform group-open:rotate-180"
          aria-hidden
        >
          <ChevronDownIcon size={16} />
        </span>
      </summary>
      <FichaCuerpo service={service} />
    </details>
  );
}

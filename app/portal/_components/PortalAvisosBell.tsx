"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BoxIcon, ChatIcon, CloseIcon, ShipIcon } from "@/components/Icon";
import {
  avisosSinLeer,
  contadorVisible,
  masReciente,
  type PortalAviso,
} from "@/lib/portal/portal-avisos";
import { markPortalAvisosSeenAction } from "../actions";

/**
 * SDD-0526 · Campana del Portal con la bandeja de avisos.
 *
 * Norte del Portal: en escritorio la campana despliega un panel bajo la topbar
 * (`_norte/portal/app.jsx` · `PortalTopbar`, «Notificaciones»); en el teléfono es
 * una hoja que sube desde abajo (`_norte/portal/mobile-extra.jsx` · `NotifSheet`,
 * «Avisos»). Por eso es un panel y no una página `/portal/avisos`: se consulta
 * sin perder la pantalla en la que el cliente está.
 *
 * Qué muestra:
 *   · La respuesta del asesor (SDD-0148), como antes, arriba de todo.
 *   · Los avisos que el sistema YA le envió, del más nuevo al más viejo, cada uno
 *     con título, texto, fecha y enlace a su compra o envío. La lista y sus reglas
 *     (sólo `sent`, su tenant y Shipping Mark, ancla viva, «Visible en el
 *     portal») salen de la base (migración 0479).
 *
 * El contador suma los avisos sin leer y la respuesta del asesor. Al abrir la
 * campana se marcan como vistos los avisos hasta el más nuevo que se mostró; el
 * contador baja sólo cuando la base confirmó (LOD-01: éxito después del
 * resultado durable). Si falla, queda como estaba y se reintenta al volver a
 * abrir. Mientras el panel sigue abierto, los que eran nuevos conservan su marca.
 */
export function PortalAvisosBell({
  avisos,
  soporteDot,
  marcarVistos = markPortalAvisosSeenAction,
}: {
  avisos: readonly PortalAviso[];
  soporteDot: boolean;
  /** Inyectable en pruebas; en la app es la server action. */
  marcarVistos?: (hasta: string) => Promise<{ ok: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [vistoHasta, setVistoHasta] = useState<string | null>(null);
  const [resaltados, setResaltados] = useState<ReadonlySet<string>>(() => new Set());
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const enCurso = useRef(false);
  const panelId = useId();
  const titleId = useId();

  const sinLeer = avisosSinLeer(avisos, vistoHasta);
  const total = sinLeer.length + (soporteDot ? 1 : 0);
  const contador = contadorVisible(total);

  function cerrar(devolverFoco: boolean) {
    setOpen(false);
    if (devolverFoco) trigger.current?.focus();
  }

  async function marcar(hasta: string) {
    if (enCurso.current) return;
    enCurso.current = true;
    try {
      const r = await marcarVistos(hasta);
      if (r?.ok) {
        setVistoHasta((prev) =>
          prev && Date.parse(prev) >= Date.parse(hasta) ? prev : hasta,
        );
      }
    } catch {
      // Queda sin marcar: el contador sigue y se reintenta al volver a abrir.
    } finally {
      enCurso.current = false;
    }
  }

  function abrir() {
    setResaltados(new Set(sinLeer.map((a) => a.id)));
    setOpen(true);
    const hasta = masReciente(sinLeer);
    if (hasta) void marcar(hasta);
  }

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const nuevos = resaltados.size;

  return (
    <div className="relative" ref={ref}>
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? cerrar(false) : abrir())}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={
          contador ? `Avisos · ${total === 1 ? "1 sin leer" : `${total} sin leer`}` : "Avisos"
        }
        className={`relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          open ? "bg-grey-100 text-ink" : "text-grey-500 hover:text-ink hover:bg-grey-100"
        }`}
      >
        <BellGlyph />
        {contador && (
          <span
            aria-hidden
            data-testid="avisos-contador"
            className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full px-1 text-center text-[10px] font-extrabold leading-4"
            style={{
              background: "var(--color-wine)",
              color: "var(--color-on-accent)",
              boxShadow: "0 0 0 2px var(--color-white)",
            }}
          >
            {contador}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Velo de la hoja (sólo teléfono): navy en los dos temas, como la hoja
              del Norte (`mobile-extra.jsx` · `Sheet`). Oculto para lectores de
              pantalla: el cierre accesible es la ×. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => cerrar(true)}
            className="fixed inset-0 z-[55] sm:hidden"
            style={{ background: "color-mix(in srgb, var(--hero-from, var(--color-ink)) 55%, transparent)" }}
          />
          <section
            id={panelId}
            aria-labelledby={titleId}
            className="card-shadow fixed inset-x-0 bottom-0 z-[56] flex max-h-[80vh] flex-col overflow-hidden rounded-t-[14px] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+8px)] sm:max-h-[min(70vh,520px)] sm:w-[360px] sm:rounded-[12px]"
            style={{
              background: "var(--color-white)",
              border: "1px solid var(--color-grey-200)",
            }}
          >
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-grey-200 py-1 pl-4 pr-1 sm:py-3 sm:pr-4">
              <h3 id={titleId} className="text-[13px] font-extrabold text-ink">
                Avisos
              </h3>
              {nuevos > 0 && (
                <span className="text-[11.5px] font-bold text-wine-text">
                  {nuevos === 1 ? "1 nuevo" : `${nuevos} nuevos`}
                </span>
              )}
              <button
                type="button"
                onClick={() => cerrar(true)}
                aria-label="Cerrar avisos"
                className="ml-auto grid h-11 w-11 place-items-center rounded-md text-grey-700 transition-colors hover:bg-grey-100 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink sm:hidden"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:pb-0">
              {soporteDot && (
                <Link
                  href="/portal/soporte"
                  onClick={() => cerrar(false)}
                  className="flex items-center gap-3 border-b border-grey-200 px-4 py-3 transition-colors hover:bg-grey-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                >
                  <span
                    aria-hidden
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md"
                    style={{
                      background: "color-mix(in srgb, var(--color-wine) 12%, transparent)",
                      color: "var(--color-wine-text)",
                    }}
                  >
                    <ChatIcon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-bold text-ink">Soporte</span>
                    <span className="block text-[11.5px] text-grey-700">Tu asesor te respondió.</span>
                  </span>
                </Link>
              )}

              {avisos.length > 0 ? (
                <ul aria-label="Avisos enviados">
                  {avisos.map((a) => {
                    const nuevo = resaltados.has(a.id);
                    return (
                      <li key={a.id} className="border-b border-grey-200 last:border-b-0">
                        <Link
                          href={a.href}
                          onClick={() => cerrar(false)}
                          className="flex gap-3 px-4 py-3 transition-colors hover:bg-grey-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                        >
                          <span
                            aria-hidden
                            className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-md"
                            style={{
                              background: "var(--color-grey-100)",
                              color: "var(--portal-info, var(--color-ink))",
                            }}
                          >
                            {a.anchorKind === "compra" ? <BoxIcon size={15} /> : <ShipIcon size={15} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2">
                              <span className="min-w-0 flex-1 text-[13px] font-bold leading-[1.3] text-ink">
                                {a.title}
                              </span>
                              {nuevo && (
                                <span className="flex flex-shrink-0 items-center gap-1 text-[11px] font-bold text-wine-text">
                                  <span
                                    aria-hidden
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ background: "var(--color-wine-text)" }}
                                  />
                                  Nuevo
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block text-[12.5px] leading-[1.45] text-grey-700">
                              {a.body}
                            </span>
                            <span className="mt-1.5 block text-[11.5px] text-grey-700">
                              {a.anchorLabel}{" "}
                              <span
                                className="font-semibold text-ink"
                                style={{
                                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                                }}
                              >
                                {a.anchorCode}
                              </span>
                              <span aria-hidden> · </span>
                              <time dateTime={a.sentAt}>{a.sentAtLabel}</time>
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-4 py-5">
                  <p className="text-[12.5px] font-bold text-ink">Todavía no tienes avisos.</p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-grey-700">
                    Cuando te enviemos uno sobre tu mercancía, también lo verás aquí.
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** Campana (no existe en el set de iconos del repo). */
function BellGlyph() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

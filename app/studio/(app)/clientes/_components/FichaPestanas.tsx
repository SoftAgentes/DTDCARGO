"use client";

/**
 * SDD-0669 · Pestañas de la ficha del cliente.
 *
 * El servidor pinta todos los paneles que el rol puede ver; aquí solo se elige
 * cuál se muestra (los demás van con `hidden`). La activa viaja en `?pestana=`
 * con `history.replaceState`, que Next sincroniza con `useSearchParams`: se
 * puede enlazar y recargar sin pedirle nada nuevo al servidor.
 * `pestanaDeLaFicha` solo acepta las pestañas que llegaron en `pestanas`: la
 * URL no puede abrir un panel que la página no armó para este rol.
 *
 * Teclado (patrón de pestañas de la WAI-ARIA): ← y → cambian de pestaña, Inicio
 * y Fin van a la primera y a la última; Tab entra al panel.
 */

import { useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { pestanaDeLaFicha, type IdPestanaFicha } from "@/lib/studio/ficha-cliente";

export type PestanaFicha = {
  id: IdPestanaFicha;
  etiqueta: string;
  /** Contador al lado de la etiqueta; `null` para no mostrar ninguno. */
  n?: number | null;
  contenido: ReactNode;
};

const ID_LISTA = "ficha-pestanas";

/** Cambia la pestaña desde cualquier enlace de la ficha (ver `EnlacePestana`). */
export function irAPestana(id: IdPestanaFicha): void {
  const url = new URL(window.location.href);
  if (id === "resumen") url.searchParams.delete("pestana");
  else url.searchParams.set("pestana", id);
  window.history.replaceState(window.history.state, "", url.toString());
}

export function FichaPestanas({ pestanas }: { pestanas: PestanaFicha[] }) {
  const params = useSearchParams();
  const activa = pestanaDeLaFicha(
    params?.get("pestana"),
    pestanas.map((p) => p.id),
  );
  const botones = useRef<Record<string, HTMLButtonElement | null>>({});

  function alTeclado(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let j: number | null = null;
    if (e.key === "ArrowRight") j = (i + 1) % pestanas.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + pestanas.length) % pestanas.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = pestanas.length - 1;
    if (j === null) return;
    e.preventDefault();
    const id = pestanas[j].id;
    irAPestana(id);
    botones.current[id]?.focus();
  }

  return (
    <div className="studio-ficha-pestanas">
      <div role="tablist" aria-label="Secciones de la ficha" id={ID_LISTA} className="studio-tabs">
        {pestanas.map((p, i) => {
          const sel = p.id === activa;
          return (
            <button
              key={p.id}
              ref={(el) => {
                botones.current[p.id] = el;
              }}
              type="button"
              role="tab"
              id={`ficha-tab-${p.id}`}
              aria-controls={`ficha-panel-${p.id}`}
              aria-selected={sel}
              tabIndex={sel ? 0 : -1}
              data-activa={sel ? "true" : undefined}
              className="studio-tab"
              onClick={() => irAPestana(p.id)}
              onKeyDown={(e) => alTeclado(e, i)}
            >
              {p.etiqueta}
              {p.n != null ? <span className="studio-tab-n">{p.n}</span> : null}
            </button>
          );
        })}
      </div>
      {pestanas.map((p) => (
        <div
          key={p.id}
          role="tabpanel"
          id={`ficha-panel-${p.id}`}
          aria-labelledby={`ficha-tab-${p.id}`}
          hidden={p.id !== activa}
          className="studio-ficha-panel"
        >
          {p.contenido}
        </div>
      ))}
    </div>
  );
}

/**
 * Enlace a una pestaña de la ficha («Ver todos», «N adjuntos»). Sin JavaScript
 * es un enlace normal a `?pestana=`; con JavaScript cambia la pestaña sin
 * recargar y sube a la lista de pestañas.
 */
export function EnlacePestana({
  pestana,
  children,
  className,
  style,
}: {
  pestana: IdPestanaFicha;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  function alClic(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    irAPestana(pestana);
    document.getElementById(ID_LISTA)?.scrollIntoView({ block: "nearest" });
    document.getElementById(`ficha-tab-${pestana}`)?.focus({ preventScroll: true });
  }
  return (
    <a href={`?pestana=${pestana}`} onClick={alClic} className={className} style={style}>
      {children}
    </a>
  );
}

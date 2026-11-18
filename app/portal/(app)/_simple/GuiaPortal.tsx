"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { markPortalGuiaVistaAction } from "../../actions";
import {
  GUIA_PRIMERAS_VECES,
  TUTORIAL_CODIGO,
  type Recorrido,
} from "@/lib/portal/simple/contenido/guia";
import { pasoDe, primeraFase, siguienteFase, type FaseGuia } from "@/lib/portal/simple/guia-motor";
import { EVENTO_ABRIR_GUIA, EVENTO_ABRIR_TUTORIAL, PARAM_GUIA } from "@/lib/portal/simple/eventos";
import { Dialogo } from "./Dialogo";

/**
 * SDD-0654 fase 2 · La guía de la Vista simple (§6.2, AC-15).
 *
 *   · Arranca sola la primera vez (`guiaVista` false) y lo marca en la base al
 *     mostrarse, para que no se repita en otro dispositivo (D-15).
 *   · Se repite con «Guía» de la barra (evento o `?guia=1`).
 *   · El tutorial del código se abre desde el bloque 5, con el mismo motor.
 *   · «Ahora no» la cierra en cualquier paso; Escape también. La tarjeta es un
 *     diálogo que contiene el foco y lo devuelve al cerrar.
 *   · El bloque del paso se resalta con un contorno de tinta (la selección va en
 *     tinta, BD-037). Sin animaciones si la persona pidió menos movimiento.
 */
function existe(ancla: string): boolean {
  try {
    return document.querySelector(ancla) !== null;
  } catch {
    return false;
  }
}

function menosMovimiento(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

type Activa = { rec: Recorrido; fase: FaseGuia } | null;

export function GuiaPortal({ guiaVista }: { guiaVista: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useSearchParams();
  const [activa, setActiva] = useState<Activa>(null);
  const [marco, setMarco] = useState<DOMRect | null>(null);
  const arrancoSola = useRef(false);
  // `?guia=1` se atiende una sola vez por visita a esa URL. Sin esto, cada
  // render que cambie una dependencia (un `router` con otra identidad, por
  // ejemplo) mientras la URL sigue con el parámetro volvía a abrir la guía, y
  // abrirla vuelve a renderizar: un bucle sin fin.
  const atendioUrl = useRef(false);
  const porUrl = params?.get(PARAM_GUIA) === "1";

  const abrir = useCallback((rec: Recorrido) => {
    const fase = primeraFase(rec, existe);
    setActiva(fase.tipo === "fin" ? null : { rec, fase });
  }, []);

  // Primera vez: arranca sola y queda marcada en la base. `?guia=1`: arranca y
  // se limpia la URL.
  useEffect(() => {
    if (!porUrl) atendioUrl.current = false;
    if (porUrl) {
      if (atendioUrl.current) return;
      atendioUrl.current = true;
      // Arranque desde la URL o la primera vez: es sincronizar con la carga, no
      // un estado derivado (mismo caso que PushOptIn).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      abrir(GUIA_PRIMERAS_VECES);
      router.replace(pathname, { scroll: false });
      return;
    }
    if (!guiaVista && !arrancoSola.current) {
      arrancoSola.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      abrir(GUIA_PRIMERAS_VECES);
      void markPortalGuiaVistaAction().catch(() => undefined);
    }
  }, [abrir, guiaVista, porUrl, pathname, router]);

  useEffect(() => {
    const guia = () => abrir(GUIA_PRIMERAS_VECES);
    const tutorial = () => abrir(TUTORIAL_CODIGO);
    window.addEventListener(EVENTO_ABRIR_GUIA, guia);
    window.addEventListener(EVENTO_ABRIR_TUTORIAL, tutorial);
    return () => {
      window.removeEventListener(EVENTO_ABRIR_GUIA, guia);
      window.removeEventListener(EVENTO_ABRIR_TUTORIAL, tutorial);
    };
  }, [abrir]);

  const paso = activa ? pasoDe(activa.rec, activa.fase) : null;
  const ancla = paso?.ancla ?? null;

  // El contorno sigue al bloque del paso (desplazamiento y cambio de tamaño).
  useEffect(() => {
    if (!ancla) return;
    const el = document.querySelector<HTMLElement>(ancla);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: menosMovimiento() ? "auto" : "smooth" });
    let raf = 0;
    const medir = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setMarco(el.getBoundingClientRect()));
    };
    medir();
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [ancla]);

  if (!activa) return null;
  const cerrar = () => setActiva(null);
  const avanzar = (aceptaExtra = false) => {
    const fase = siguienteFase(activa.rec, activa.fase, existe, aceptaExtra);
    setActiva(fase.tipo === "fin" ? null : { rec: activa.rec, fase });
  };

  const continuar = activa.fase.tipo === "continuar" ? activa.rec.continuar : undefined;
  const etiqueta = continuar ? continuar.etiqueta : (paso?.etiqueta ?? "");
  const titulo = continuar ? continuar.titulo : (paso?.titulo ?? "");
  const texto = continuar ? continuar.texto : (paso?.texto ?? "");

  return (
    <>
      {ancla && marco && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[55] rounded-[18px]"
          style={{
            top: marco.top - 6,
            left: marco.left - 6,
            width: marco.width + 12,
            height: marco.height + 12,
            outline: "3px solid var(--color-ink)",
            outlineOffset: 0,
          }}
        />
      )}
      <Dialogo abierto titulo={titulo} onCerrar={cerrar} posicion="abajo" etiquetaCerrar="Ahora no">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-grey-700">{etiqueta}</p>
        <p className="mt-1.5 text-[15px] leading-[1.55]">{texto}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {continuar ? (
            <>
              <button type="button" onClick={cerrar} className="vs-btn-secundario">
                {continuar.no}
              </button>
              <button type="button" onClick={() => avanzar(true)} className="vs-btn-principal">
                {continuar.si}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => avanzar()} className="vs-btn-principal">
              {paso?.siguiente ?? "Siguiente"}
            </button>
          )}
        </div>
      </Dialogo>
    </>
  );
}

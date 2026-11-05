"use client";

/**
 * GuiaMotor · motor de la guía «Antes en Kommo → Ahora aquí» (SDD-0589,
 * paso 9.2 del programa SDD-0582).
 *
 * Se monta una vez en el layout de Studio. Arranca un recorrido de dos formas:
 *   - `?guia=<id>` en la URL (capacitación de 8.1, enlaces de ayuda);
 *   - `iniciarGuia("<id>")` desde cualquier componente (el botón «Guía» y la
 *     primera vez automática llegan en 9.3).
 *
 * Cada paso se ancla a un elemento con `data-guia="<pantalla>.<elemento>"`.
 * Si el ancla no está, el paso se salta; si no hay ninguna, no abre. La
 * tarjeta no bloquea la pantalla: no hay fondo ni trampa de foco, sólo un
 * contorno sobre el ancla. Al cerrar, el foco vuelve a donde estaba.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { hasI18nKey, useT } from "@/lib/i18n";
import { crearAlmacenLocal, type GuiaAlmacen } from "@/lib/studio/guia/almacen";
import { contador, pasoAnterior, pasoSiguiente, primerPaso } from "@/lib/studio/guia/motor";
import { colocarTarjeta, type Caja } from "@/lib/studio/guia/posicion";
import { buscarRecorrido, RECORRIDOS, rutaCoincide } from "@/lib/studio/guia/recorridos";
import { esAnclaValida, textoDe, type GuiaRecorrido } from "@/lib/studio/guia/tipos";
import { GuiaTarjeta } from "./GuiaTarjeta";

export const EVENTO_GUIA = "dtd:guia";

/** Pide al motor montado que abra un recorrido de la pantalla actual. */
export function iniciarGuia(recorridoId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_GUIA, { detail: { id: recorridoId } }));
}

/** Elemento visible con `data-guia` = ancla, o `null`. Nunca lanza. */
export function buscarAncla(ancla: string): HTMLElement | null {
  if (typeof document === "undefined" || !esAnclaValida(ancla)) return null;
  const el = document.querySelector<HTMLElement>(`[data-guia="${ancla}"]`);
  if (!el || el.closest("[hidden], [inert], [aria-hidden='true']")) return null;
  return el;
}

const existeAncla = (ancla: string) => buscarAncla(ancla) !== null;

const CONSULTA_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

function consultaMovimiento(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(CONSULTA_MOVIMIENTO);
}

function usePrefiereMenosMovimiento(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = consultaMovimiento();
      mq?.addEventListener?.("change", avisar);
      return () => mq?.removeEventListener?.("change", avisar);
    },
    () => consultaMovimiento()?.matches ?? false,
    () => false,
  );
}

/** Reintentos de arranque mientras la pantalla termina de pintar sus anclas. */
const REINTENTOS = 8;
const ESPERA_MS = 250;
/** Tamaño de referencia antes de medir la tarjeta real. */
const TARJETA_ESTIMADA = { width: 360, height: 240 };

interface Activo {
  recorrido: GuiaRecorrido;
  indice: number;
  /** Ruta donde se abrió: cambiar de pantalla cierra la guía. */
  ruta: string;
}

interface Geometria {
  ancla: Caja | null;
  top: number;
  left: number;
}

export function GuiaMotor({
  catalogo = RECORRIDOS,
  almacen,
}: {
  catalogo?: readonly GuiaRecorrido[];
  /** 9.3 inyecta aquí el almacén por usuario. */
  almacen?: GuiaAlmacen;
} = {}) {
  const t = useT();
  const pathname = usePathname() ?? "";
  const params = useSearchParams();
  const pedidoUrl = params?.get("guia") ?? null;
  const reducido = usePrefiereMenosMovimiento();

  const almacenRef = useRef<GuiaAlmacen | null>(almacen ?? null);
  const obtenerAlmacen = useCallback(() => {
    if (!almacenRef.current) almacenRef.current = crearAlmacenLocal();
    return almacenRef.current;
  }, []);

  const [activo, setActivo] = useState<Activo | null>(null);
  const [geo, setGeo] = useState<Geometria | null>(null);
  const [anuncioCierre, setAnuncioCierre] = useState("");
  const tarjetaRef = useRef<HTMLElement | null>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);
  const enfocarAlAbrir = useRef(false);

  // Cambiar de pantalla cierra la guía: sus anclas ya no son de esta ruta.
  // Se ajusta durante el render (patrón de React para estado derivado de
  // props previas), sin efecto ni render intermedio con la tarjeta vieja.
  if (activo && activo.ruta !== pathname) {
    setActivo(null);
    setGeo(null);
  }

  const cerrar = useCallback(
    (terminado: boolean) => {
      if (activo) {
        const paso = activo.recorrido.pasos[activo.indice];
        obtenerAlmacen().guardar(activo.recorrido.id, { pasoId: paso?.id ?? null, terminado });
      }
      setActivo(null);
      setGeo(null);
      setAnuncioCierre(t("guide.chrome.closed"));
      const previo = focoPrevio.current;
      focoPrevio.current = null;
      if (previo && previo.isConnected) previo.focus();
    },
    [activo, obtenerAlmacen, t],
  );

  /** Intenta abrir; devuelve false si el recorrido no aplica o no hay anclas. */
  const intentarAbrir = useCallback(
    (id: string): boolean => {
      const recorrido = buscarRecorrido(id, catalogo);
      if (!recorrido || !rutaCoincide(recorrido, pathname)) return false;
      const indice = primerPaso(recorrido.pasos, existeAncla);
      if (indice === null) return false;
      const enfocado = document.activeElement;
      if (!tarjetaRef.current?.contains(enfocado)) {
        focoPrevio.current = enfocado instanceof HTMLElement ? enfocado : null;
      }
      enfocarAlAbrir.current = true;
      setActivo({ recorrido, indice, ruta: pathname });
      return true;
    },
    [catalogo, pathname],
  );

  /** Abre con reintentos cortos: un ancla puede pintarse después del motor. */
  const abrirCuandoHaya = useCallback(
    (id: string) => {
      let intentos = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const probar = () => {
        timer = null;
        if (intentarAbrir(id)) return;
        intentos += 1;
        if (intentos < REINTENTOS) timer = setTimeout(probar, ESPERA_MS);
      };
      probar();
      return () => {
        if (timer) clearTimeout(timer);
      };
    },
    [intentarAbrir],
  );

  // Arranque por URL.
  useEffect(() => {
    if (!pedidoUrl) return;
    return abrirCuandoHaya(pedidoUrl);
  }, [pedidoUrl, abrirCuandoHaya]);

  // Arranque programático.
  useEffect(() => {
    let cancelar: (() => void) | null = null;
    const onEvento = (e: Event) => {
      const id = (e as CustomEvent<{ id?: unknown }>).detail?.id;
      if (typeof id !== "string") return;
      cancelar?.();
      cancelar = abrirCuandoHaya(id);
    };
    window.addEventListener(EVENTO_GUIA, onEvento);
    return () => {
      window.removeEventListener(EVENTO_GUIA, onEvento);
      cancelar?.();
    };
  }, [abrirCuandoHaya]);

  const pasoActual = activo ? activo.recorrido.pasos[activo.indice] : null;

  // Guardar el progreso de cada paso mostrado.
  useEffect(() => {
    if (!activo || !pasoActual) return;
    obtenerAlmacen().guardar(activo.recorrido.id, { pasoId: pasoActual.id, terminado: false });
  }, [activo, pasoActual, obtenerAlmacen]);

  // Llevar el ancla a la vista al cambiar de paso.
  useEffect(() => {
    if (!pasoActual) return;
    const el = buscarAncla(pasoActual.ancla);
    if (!el || typeof el.scrollIntoView !== "function") return;
    const r = el.getBoundingClientRect();
    const fuera = r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth;
    if (fuera) el.scrollIntoView({ block: "center", inline: "nearest", behavior: reducido ? "auto" : "smooth" });
  }, [pasoActual, reducido]);

  // Medir y colocar: al abrir, al cambiar de paso, con scroll, resize y
  // cambios del DOM (un ancla que aparece o se va).
  useLayoutEffect(() => {
    if (!pasoActual) return;
    let raf = 0;
    const medir = () => {
      raf = 0;
      const el = buscarAncla(pasoActual.ancla);
      const r = el?.getBoundingClientRect();
      const ancla: Caja | null = el && r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      const card = tarjetaRef.current;
      const tam =
        card && card.offsetWidth > 0
          ? { width: card.offsetWidth, height: card.offsetHeight }
          : TARJETA_ESTIMADA;
      const pos = colocarTarjeta(ancla, tam, { width: window.innerWidth, height: window.innerHeight });
      setGeo({ ancla, top: pos.top, left: pos.left });
    };
    const programar = () => {
      if (!raf) raf = requestAnimationFrame(medir);
    };
    medir();
    // Segunda medida con el tamaño real de la tarjeta ya montada.
    programar();
    window.addEventListener("resize", programar);
    window.addEventListener("scroll", programar, true);
    const mo = typeof MutationObserver === "function" ? new MutationObserver(programar) : null;
    mo?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-guia", "hidden", "inert", "aria-hidden"],
    });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", programar);
      window.removeEventListener("scroll", programar, true);
      mo?.disconnect();
    };
  }, [pasoActual]);

  // Foco a la tarjeta sólo al abrir; al navegar se queda en el botón usado.
  useEffect(() => {
    if (activo && enfocarAlAbrir.current && tarjetaRef.current) {
      enfocarAlAbrir.current = false;
      tarjetaRef.current.focus();
    }
  }, [activo, geo]);

  const siguiente = useCallback(() => {
    if (!activo) return;
    const j = pasoSiguiente(activo.recorrido.pasos, activo.indice, existeAncla);
    if (j === null) cerrar(true);
    else setActivo({ ...activo, indice: j });
  }, [activo, cerrar]);

  const anterior = useCallback(() => {
    if (!activo) return;
    const j = pasoAnterior(activo.recorrido.pasos, activo.indice, existeAncla);
    if (j !== null) setActivo({ ...activo, indice: j });
  }, [activo]);

  const posicion = activo ? contador(activo.recorrido.pasos, activo.indice, existeAncla) : null;
  const anuncio =
    pasoActual && posicion
      ? t("guide.chrome.announce", { ...posicion, title: t(textoDe(pasoActual.clave, "title")) })
      : anuncioCierre;

  const region = (
    <div role="status" aria-live="polite" aria-atomic="true" className="studio-sr-only">
      {anuncio}
    </div>
  );

  if (!activo || !pasoActual || !geo || !posicion) return region;

  const { pasos } = activo.recorrido;
  const { n, total } = posicion;
  const clave = pasoActual.clave;
  const opcional = (sufijo: string) => {
    const k = `${clave}.${sufijo}`;
    return hasI18nKey(k) ? t(k) : null;
  };
  const faltaAncla = geo.ancla === null;

  return (
    <>
      {region}
      {geo.ancla && (
        <div
          aria-hidden
          data-testid="guia-contorno"
          style={{
            position: "fixed",
            top: geo.ancla.top - 4,
            left: geo.ancla.left - 4,
            width: geo.ancla.width + 8,
            height: geo.ancla.height + 8,
            border: "2px solid var(--wine-text)",
            borderRadius: "var(--r-md)",
            pointerEvents: "none",
            zIndex: 89,
            transition: reducido
              ? "none"
              : "top var(--dur-slow) var(--ease), left var(--dur-slow) var(--ease), width var(--dur-slow) var(--ease), height var(--dur-slow) var(--ease)",
          }}
        />
      )}
      <GuiaTarjeta
        ref={tarjetaRef}
        titulo={t(textoDe(clave, "title"))}
        que={t(textoDe(clave, "what"))}
        antes={opcional("before")}
        ahora={opcional("now")}
        n={n}
        total={total}
        esUltimo={pasoSiguiente(pasos, activo.indice, existeAncla) === null}
        puedeAtras={pasoAnterior(pasos, activo.indice, existeAncla) !== null}
        faltaAncla={faltaAncla}
        top={geo.top}
        left={geo.left}
        reducido={reducido}
        onSiguiente={siguiente}
        onAnterior={anterior}
        onCerrar={() => cerrar(false)}
      />
    </>
  );
}

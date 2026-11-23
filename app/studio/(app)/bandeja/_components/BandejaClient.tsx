"use client";

/**
 * Bandeja de Chatwoot en un iframe (SDD-0585, paso 2.2; SDD-0677; SDD-0680).
 *
 * - `inicioUrl` presente → ya se pidió el SSO para este usuario en esta sesión
 *   de Studio: el iframe abre el panel directo.
 * - `inicioUrl` ausente → se pide UN enlace de un solo uso al montar. «Abrir de
 *   nuevo» fuerza otro (cuando el panel muestra su pantalla de login o un error).
 * - `allow="microphone"`: las notas de voz. La cabecera de la ruta lo delega al
 *   origen del chat (PoC 2.1: hacen falta el atributo y la cabecera).
 * - Al montar con vínculo, `reconciliarBandeja` corrige el contador con lo que
 *   el agente ve en Chatwoot (un agente que lee sin responder no dispara webhook).
 * - `conversacion`: el SSO lleva la conversación y Chatwoot redirige a ella.
 * - Sin `sandbox`: el panel necesita scripts, su origen, formularios, ventanas
 *   emergentes y descargas, y un sandbox con todo eso no protege nada.
 *
 * SDD-0680, variante C (elegida por Sam el 2026-11-19):
 * - **Una sola fila** arriba: «CRM», las pestañas del CRM (las trae la página en
 *   `pestanas`), el estado («Conectada», «Abriendo la bandeja…») y las acciones:
 *   «Abrir de nuevo», abrir en pestaña aparte (icono) y, al admin, «Agentes».
 *   Sin texto de ayuda fijo y sin marco: el panel va pegado debajo, de borde a
 *   borde del área de contenido, y ocupa el alto que queda de la ventana. Esto
 *   reemplaza la pantalla completa con «Reducir» de SDD-0677.
 * - **Ancho estable (BTN-01 §5):** «Abrir de nuevo» y «Abriendo…» ocupan la misma
 *   celda; el botón mide siempre lo de la etiqueta más ancha.
 *
 * SDD-0677 (sigue):
 * - **Recuperación.** El enlace se reintenta solo ante `service` (pedirlo no gasta
 *   un login: el login lo hace el navegador al cargarlo). Un vigilante avisa si
 *   el marco no carga.
 * - **Freno.** Como mucho 3 aperturas por SSO cada 5 minutos en este navegador,
 *   automáticas y manuales. SDD-0680: cuenta el enlace que se carga en el marco
 *   (ese es el login); un pedido que falló o no volvió no cuenta. Las marcas
 *   (solo horas, sin datos) van en localStorage: sobreviven a recargar y se
 *   comparten entre pestañas. Si el almacenamiento falla al leer O al escribir,
 *   la página pasa a usar solo la memoria. La reserva corre bajo
 *   `navigator.locks` cuando existe: dos pestañas no pasan el tope a la vez; sin
 *   locks, el límite es «3 por navegador, salvo carrera entre pestañas».
 *   rack-attack corta a 5 logins por IP cada 5 min y cada SSO suma una sesión:
 *   Studio no debe empeorar ninguna de las dos (H1, H4).
 * - **Con `error` el iframe se desmonta**: no hay enlace válido que mostrar. Con
 *   `lento` y `freno` sigue montado por si termina de cargar.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { origenDe, usePuenteChatwoot } from "@/app/studio/_components/guia/usePuenteChatwoot";
import { pedirEnlaceSso, reconciliarBandeja, type BandejaErrorCode, type EnlaceSsoResult } from "../actions";
import { PortalChatwoot } from "./PortalChatwoot";
import type { ResumenPortal } from "@/lib/studio/chatwoot/portal";
import type { EventoDescartado } from "@/lib/studio/chatwoot/conversations-queries";

export type BandejaEstado = "sin_configurar" | "sin_vinculo" | "listo";

/** Intentos del enlace ante `service` y la espera antes de cada reintento. */
export const INTENTOS_ENLACE = 3;
export const ESPERAS_REINTENTO_MS = [1500, 4000] as const;
/**
 * SDD-0680: plazo de cada pedido del enlace. Un pedido que no vuelve (el POST de
 * la action abortado o colgado) cuenta como `service` y se reintenta. El servidor
 * corta el suyo a los 10 s (`platform-api.ts`); esto cubre la red y la cola.
 */
export const PLAZO_ENLACE_MS = 15_000;
/** Si el marco no termina de cargar en este tiempo, se ofrece abrirlo de nuevo. */
export const VIGILANTE_CARGA_MS = 20_000;
/** Aperturas por SSO permitidas por ventana y navegador (automáticas y manuales). */
export const SSO_MAX = 3;
export const VENTANA_SSO_MS = 5 * 60_000;
/** Marcas del freno: horas (ms) de las últimas aperturas por SSO. Sin datos de nadie. */
export const CLAVE_SSO = "dtd.bandeja.sso";
/** Alto mínimo del panel cuando la ventana es baja. */
export const ALTO_MINIMO_PANEL = 480;

interface Props {
  estado: BandejaEstado;
  panelUrl: string | null;
  inicioUrl: string | null;
  /** `?c=N`: conversación a abrir (E2-D24). */
  conversacion?: number | null;
  /** SDD-0680: las pestañas del CRM, que van en la misma fila que las acciones. */
  pestanas?: ReactNode;
  admin: {
    descartados?: EventoDescartado[];
    /** SDD-0586 (10.5, PR 1b): la ida del chat del portal; null sin la bandeja del portal configurada. */
    portal?: ResumenPortal | null;
    /** SDD-0655: enlace a Usuarios › Bandeja, donde viven los vínculos. */
    agentesHref?: string;
  } | null;
}

type Fase =
  | { tipo: "pidiendo"; intento: number }
  | { tipo: "abriendo" }
  | { tipo: "abierto" }
  | { tipo: "lento" }
  | { tipo: "freno" }
  | { tipo: "error"; codigo: BandejaErrorCode; vencido?: boolean };

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Respaldo cuando el almacenamiento falla (al leer o al escribir): desde ese
 * momento la página usa solo esta memoria, para que el freno no quede en cero
 * leyendo un localStorage que ya no se actualiza.
 */
let marcasEnMemoria: number[] = [];
let almacenamientoRoto = false;

/** Solo para pruebas: vuelve el freno en memoria a su estado inicial. */
export function reiniciarFrenoEnMemoria() {
  marcasEnMemoria = [];
  almacenamientoRoto = false;
}

/**
 * Marcas que cuentan en `ahora`: las de los últimos 5 min y también las futuras
 * (un reloj que se atrasó no abre el freno). Una marca más allá de una ventana en
 * el futuro es basura: si contara, cerraría el freno para siempre.
 */
export function marcasVigentes(marcas: readonly number[], ahora: number): number[] {
  return marcas.filter((t0) => Number.isFinite(t0) && Math.abs(ahora - t0) < VENTANA_SSO_MS);
}

function leerMarcas(): number[] {
  if (almacenamientoRoto) return marcasEnMemoria;
  try {
    const crudo = window.localStorage.getItem(CLAVE_SSO);
    const valor: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(valor) ? valor.filter((n): n is number => typeof n === "number") : [];
  } catch {
    almacenamientoRoto = true;
    return marcasEnMemoria;
  }
}

function guardarMarcas(marcas: number[]) {
  marcasEnMemoria = marcas;
  if (almacenamientoRoto) return;
  try {
    window.localStorage.setItem(CLAVE_SSO, JSON.stringify(marcas));
  } catch {
    // Desde ahora manda la memoria: el freno sigue valiendo en esta página.
    almacenamientoRoto = true;
  }
}

/** ¿Queda cupo en la ventana? Solo mira: la marca se pone al cargar el enlace (SDD-0680). */
function hayCupo(): boolean {
  return marcasVigentes(leerMarcas(), Date.now()).length < SSO_MAX;
}

/** Resultado del pedido; `vencido` = no volvió a tiempo y sigue en la cola de Next. */
type ResultadoPedido = EnlaceSsoResult & { vencido?: boolean };

/**
 * SDD-0680: pide el enlace sin que nada lo deje colgado. Si la llamada a la
 * action rechaza (`net::ERR_ABORTED`, una respuesta que Next no reconoce tras un
 * despliegue), el resultado es `service`, que se reintenta. Antes de 0680 el
 * rechazo escapaba y la fase quedaba en `pidiendo`.
 *
 * Si no vuelve en `PLAZO_ENLACE_MS`, el resultado es `service` con `vencido`:
 * Next corre las server actions de una en una, así que un POST colgado deja en
 * cola cualquier pedido nuevo. No se reintenta por la action; «Abrir de nuevo»
 * recarga la página (revisión de la #700, M1).
 */
async function pedirConPlazo(conversacion: number | undefined): Promise<ResultadoPedido> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<ResultadoPedido>((resolver) => {
    reloj = setTimeout(() => resolver({ ok: false, error: "service", vencido: true }), PLAZO_ENLACE_MS);
  });
  try {
    const r = await Promise.race([pedirEnlaceSso(conversacion), plazo]);
    return r && typeof r === "object" && "ok" in r ? r : { ok: false, error: "service" };
  } catch {
    return { ok: false, error: "service" };
  } finally {
    clearTimeout(reloj);
  }
}

/** Recargar la página: la única salida cuando la cola de actions quedó trabada. */
export const recargarPagina = { ahora: () => window.location.reload() };

/** Reserva una apertura si cabe en la ventana; si no, `false` y el enlace no se carga. */
function reservarApertura(ahora: number): boolean {
  const vigentes = marcasVigentes(leerMarcas(), ahora);
  if (vigentes.length >= SSO_MAX) {
    guardarMarcas(vigentes);
    return false;
  }
  guardarMarcas([...vigentes, ahora]);
  return true;
}

/**
 * La reserva entre pestañas: con `navigator.locks` leer y escribir las marcas es
 * una sola operación para todo el navegador. Sin locks (o si fallan) se reserva
 * igual, sin exclusión: el límite documentado es «salvo carrera entre pestañas».
 */
async function reservarAperturaExclusiva(): Promise<boolean> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    try {
      return await locks.request(CLAVE_SSO, () => reservarApertura(Date.now()));
    } catch {
      // Sigue sin exclusión.
    }
  }
  return reservarApertura(Date.now());
}

const iconoReabrir = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);
const iconoPestana = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
const iconoAgentes = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
    <path d="M16 5a3 3 0 0 1 0 6" />
    <path d="M21 20c0-2-1-4-3-5" />
  </svg>
);
const iconoListo = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

/**
 * «Abrir de nuevo» con ancho estable (BTN-01 §5, como `BotonEnvio` de SDD-0678):
 * las dos etiquetas van en la misma celda de una rejilla y la que no toca queda
 * con `visibility: hidden`. Mientras pide, queda deshabilitado y `aria-busy`.
 */
function BotonReabrir({
  pidiendo,
  variante,
  onClick,
}: {
  pidiendo: boolean;
  variante: "primary" | "ghost";
  onClick: () => void;
}) {
  const t = useT();
  const celda = {
    gridArea: "1 / 1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--s-1)",
  } as const;
  return (
    <button
      type="button"
      className={`studio-btn studio-btn-${variante} studio-btn-sm`}
      disabled={pidiendo}
      aria-busy={pidiendo}
      onClick={onClick}
      style={{ display: "inline-grid" }}
    >
      <span style={{ ...celda, visibility: pidiendo ? "hidden" : "visible" }}>
        {iconoReabrir}
        {t("bandeja.action.reopen")}
      </span>
      <span aria-hidden={!pidiendo} style={{ ...celda, visibility: pidiendo ? "visible" : "hidden" }}>
        <span className="studio-spin" style={{ display: "inline-flex" }}>
          {iconoReabrir}
        </span>
        {t("bandeja.action.reopening")}
      </span>
    </button>
  );
}

export function BandejaClient({ estado, panelUrl, inicioUrl, conversacion = null, pestanas = null, admin }: Props) {
  const t = useT();
  const [src, setSrc] = useState<string | null>(inicioUrl);
  const [fase, setFase] = useState<Fase>(inicioUrl ? { tipo: "abriendo" } : { tipo: "pidiendo", intento: 1 });
  /** Alto del panel medido en el navegador: hasta el borde de abajo de la ventana. */
  const [alto, setAlto] = useState<number | null>(null);
  const pidioAlMontar = useRef(false);
  const reconcilio = useRef(false);
  const zonaRef = useRef<HTMLDivElement | null>(null);
  /** Cada pedido lleva un número; el que llega tarde (otro pedido o desmontado) no pisa el estado. */
  const corrida = useRef(0);
  /** Un pedido venció el plazo: la cola de actions de Next sigue trabada detrás de él. */
  const colaTrabada = useRef(false);
  // Guía dentro del panel (SDD-0589, 9.4): el marco es el ancla de respaldo y el
  // puente le pregunta al script del panel dónde está cada ancla de Chatwoot.
  const marcoRef = useRef<HTMLIFrameElement | null>(null);
  usePuenteChatwoot(marcoRef, origenDe(panelUrl));

  const pedirConReintentos = useCallback(async () => {
    const mia = ++corrida.current;
    // Con el tope lleno no se pide: el enlace no se podría cargar.
    if (!hayCupo()) {
      setFase({ tipo: "freno" });
      return;
    }
    for (let intento = 1; intento <= INTENTOS_ENLACE; intento++) {
      setFase({ tipo: "pidiendo", intento });
      const r = await pedirConPlazo(conversacion ?? undefined);
      if (mia !== corrida.current) return;
      if (!r.ok && r.vencido) {
        // Un reintento por la action esperaría detrás del POST colgado.
        colaTrabada.current = true;
        setFase({ tipo: "error", codigo: "service", vencido: true });
        return;
      }
      if (r.ok) {
        // SDD-0680: la marca se pone aquí, al cargar el enlace, porque el login lo
        // hace el navegador al cargarlo. Un intento que falló no gastó ningún login
        // y no cuenta: antes de 0680 tres fallos cerraban «Abrir de nuevo» 5 min.
        const reservada = await reservarAperturaExclusiva();
        if (mia !== corrida.current) return;
        if (!reservada) {
          setFase({ tipo: "freno" });
          return;
        }
        setSrc(r.url);
        setFase({ tipo: "abriendo" });
        return;
      }
      // Solo `service` es pasajero; denied/unlinked/unconfigured no cambian por reintentar.
      if (r.error !== "service" || intento === INTENTOS_ENLACE) {
        setFase({ tipo: "error", codigo: r.error });
        return;
      }
      // Durante la espera ya se anuncia el próximo intento.
      setFase({ tipo: "pidiendo", intento: intento + 1 });
      await esperar(ESPERAS_REINTENTO_MS[intento - 1] ?? ESPERAS_REINTENTO_MS[ESPERAS_REINTENTO_MS.length - 1]);
      if (mia !== corrida.current) return;
    }
  }, [conversacion]);

  /**
   * «Abrir de nuevo»: un SSO nuevo; el freno lo aplica `pedirConReintentos`. Si
   * un pedido venció el plazo, la cola de actions sigue trabada: recarga la página.
   */
  const abrirDeNuevo = useCallback(() => {
    if (colaTrabada.current) {
      recargarPagina.ahora();
      return;
    }
    void pedirConReintentos();
  }, [pedirConReintentos]);

  useEffect(() => {
    // Un pedido que sigue en vuelo al desmontar no escribe estado.
    return () => {
      corrida.current += 1;
    };
  }, []);

  useEffect(() => {
    // Una reconciliación por montaje; si falla, el contador sigue con el webhook.
    // SDD-0680: espera a que termine el pedido del enlace. Next pone las server
    // actions en UNA cola: si la reconciliación (varias llamadas a Chatwoot) sale
    // primero, el SSO espera detrás de ella con la pantalla en «Abriendo…».
    if (estado !== "listo" || reconcilio.current || fase.tipo === "pidiendo") return;
    reconcilio.current = true;
    void Promise.resolve()
      .then(() => reconciliarBandeja())
      .catch(() => undefined);
  }, [estado, fase.tipo]);

  useEffect(() => {
    // Un solo pedido automático por montaje (StrictMode monta dos veces en dev).
    if (estado !== "listo" || inicioUrl || pidioAlMontar.current) return;
    pidioAlMontar.current = true;
    void pedirConReintentos();
  }, [estado, inicioUrl, pedirConReintentos]);

  useEffect(() => {
    // Vigilante: el `onLoad` no llegó a tiempo. El marco sigue montado por si termina.
    if (fase.tipo !== "abriendo") return;
    const id = setTimeout(() => {
      setFase((f) => (f.tipo === "abriendo" ? { tipo: "lento" } : f));
    }, VIGILANTE_CARGA_MS);
    return () => clearTimeout(id);
  }, [fase.tipo, src]);

  const listo = estado === "listo";

  const aviso =
    fase.tipo === "error"
      ? fase.vencido
        ? // SDD-0680: no hubo 3 intentos; hubo uno que no volvió, y la salida es recargar.
          t("bandeja.recover.timeout")
        : fase.codigo === "service"
        ? t("bandeja.recover.service", { total: INTENTOS_ENLACE })
        : t(`bandeja.error.${fase.codigo}` as I18nKey)
      : fase.tipo === "lento"
        ? t("bandeja.recover.slow")
        : fase.tipo === "freno"
          ? t("bandeja.recover.throttle")
          : null;

  useEffect(() => {
    // El panel llega hasta el borde de abajo de la ventana: se mide desde donde
    // empieza (debajo de la fila y del aviso, si lo hay). Sin medir, el estilo de
    // respaldo usa `100dvh` menos un estimado.
    if (!listo) return;
    const medir = () => {
      const caja = zonaRef.current?.getBoundingClientRect();
      if (!caja) return;
      setAlto(Math.max(ALTO_MINIMO_PANEL, Math.floor(window.innerHeight - (caja.top + window.scrollY))));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [listo, aviso]);

  const pidiendo = fase.tipo === "pidiendo";
  const estadoFila =
    fase.tipo === "pidiendo" && fase.intento > 1
      ? t("bandeja.state.retrying", { n: fase.intento, total: INTENTOS_ENLACE })
      : fase.tipo === "pidiendo" || fase.tipo === "abriendo"
        ? t("bandeja.state.loading")
        : fase.tipo === "abierto"
          ? t("bandeja.state.connected")
          : null;

  const abrirEnPestana = panelUrl ? (
    <a
      href={panelUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("bandeja.action.open_tab")}
      title={t("bandeja.action.open_tab")}
      className="studio-btn studio-btn-ghost studio-btn-sm"
      style={{ minWidth: 32, paddingInline: 0, justifyContent: "center" }}
    >
      {iconoPestana}
    </a>
  ) : null;

  const agentes = admin?.agentesHref ? (
    <Link href={admin.agentesHref} className="studio-btn studio-btn-ghost studio-btn-sm" title={t("bandeja.links.manage")}>
      {iconoAgentes}
      {t("bandeja.action.agents")}
    </Link>
  ) : null;

  // Con error no hay marco (no hay enlace válido); lento y freno lo dejan montado por si carga.
  const conMarco = src !== null && fase.tipo !== "error";

  const fila = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--s-2)",
        flexWrap: "wrap",
        minHeight: 48,
        padding: "var(--s-1) var(--s-4)",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <h1 style={{ font: "800 15px/1.2 var(--f-display)", color: "var(--ink)", margin: "0 var(--s-2) 0 0" }}>
        {t("bandeja.page.crm")}
      </h1>
      {pestanas}
      {/* Siempre montado mientras hay panel: un `role="status"` que nace con el texto
          no siempre se anuncia; uno que ya estaba y cambia, sí. */}
      {listo ? (
        <span
          role="status"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-1)",
            marginLeft: "var(--s-2)",
            font: "600 12px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {fase.tipo === "abierto" ? iconoListo : null}
          {estadoFila}
        </span>
      ) : null}
      {/* SDD-0680, adenda del 2026-11-23 (variante A): el estado del chat del portal va en la
          fila, junto al de la Bandeja; antes era una tarjeta debajo del panel. */}
      {admin?.portal ? <PortalChatwoot resumen={admin.portal} /> : null}
      <span style={{ flex: "1 1 auto" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
        {listo ? <BotonReabrir pidiendo={pidiendo} variante="ghost" onClick={abrirDeNuevo} /> : null}
        {listo ? abrirEnPestana : null}
        {agentes}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <section
        aria-label={t("bandeja.page.title")}
        data-ancho-completo=""
        data-bandeja=""
        style={{
          display: "flex",
          flexDirection: "column",
          // De borde a borde del área de contenido: anula el relleno de `.studio-content`.
          margin: "calc(-1 * var(--s-6)) calc(-1 * var(--s-8)) 0",
        }}
      >
        {fila}
        {!listo ? (
          <div style={{ padding: "var(--s-6) var(--s-8) 0" }}>
            {estado === "sin_configurar" ? (
              <EmptyState title={t("bandeja.state.unconfigured.title")} description={t("bandeja.state.unconfigured.body")} />
            ) : (
              <EmptyState title={t("bandeja.state.unlinked.title")} description={t("bandeja.state.unlinked.body")} />
            )}
          </div>
        ) : (
          <>
            {aviso ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)", padding: "var(--s-3) var(--s-4)" }}>
                <Aviso tono={fase.tipo === "error" ? "error" : "atencion"} urgente titulo={t("bandeja.recover.title")}>
                  {aviso}
                </Aviso>
                {fase.tipo !== "freno" ? (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s-2)", flexWrap: "wrap" }}>
                    <BotonReabrir pidiendo={pidiendo} variante="primary" onClick={abrirDeNuevo} />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div
              ref={zonaRef}
              style={{
                position: "relative",
                height: alto ?? `max(${ALTO_MINIMO_PANEL}px, calc(100dvh - 120px))`,
                background: "var(--bg-surface)",
              }}
            >
              {conMarco ? (
                <iframe
                  key={src}
                  ref={marcoRef}
                  data-guia="bandeja.marco"
                  src={src}
                  title={t("bandeja.frame.title")}
                  allow="microphone"
                  onLoad={() =>
                    setFase((f) => (f.tipo === "abriendo" || f.tipo === "lento" || f.tipo === "freno" ? { tipo: "abierto" } : f))
                  }
                  style={{ display: "block", width: "100%", height: "100%", border: 0, background: "var(--bg-surface)" }}
                />
              ) : null}
            </div>
          </>
        )}
      </section>

      {admin?.descartados?.length ? (
        <section
          aria-labelledby="bandeja-descartados"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-2)",
          }}
        >
          <h2 id="bandeja-descartados" style={{ font: "800 16px/1.2 var(--f-display)", color: "var(--ink)", margin: 0 }}>
            {t("bandeja.discarded.title")}
          </h2>
          <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>{t("bandeja.discarded.help")}</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
            {admin.descartados.map((d) => (
              <li key={d.event_key} style={{ font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                {t(d.event === "message_created" ? "bandeja.discarded.message" : "bandeja.discarded.status", {
                  n: d.conversation_id,
                  intentos: d.attempts,
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

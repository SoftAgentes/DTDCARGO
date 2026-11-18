"use client";

/**
 * Bandeja de Chatwoot en un iframe (SDD-0585, paso 2.2; SDD-0677).
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
 * - SDD-0655: es una pestaña de CRM. La cabecera y la barra las pinta la página;
 *   aquí quedan las acciones del panel. Los vínculos se mudaron a Usuarios: al
 *   admin le queda el enlace «Agentes vinculados».
 *
 * SDD-0677:
 * - **Pantalla completa.** Lista la Bandeja, el panel ocupa toda la ventana con
 *   una franja compacta arriba. «Reducir» o Esc vuelven a la vista dentro del
 *   CRM; la preferencia se guarda en este navegador. El iframe NUNCA se vuelve a
 *   montar al cambiar de modo: solo cambia el estilo del contenedor (recargar
 *   gastaría otro login o reusaría un enlace de un solo uso ya consumido).
 * - **Recuperación.** El enlace se reintenta solo ante `service` (pedirlo no gasta
 *   un login: el login lo hace el navegador al cargarlo). Un vigilante avisa si
 *   el marco no carga.
 * - **Freno.** Como mucho 3 aperturas por SSO cada 5 minutos en este navegador,
 *   automáticas y manuales, también las que terminan en `service`. Las marcas
 *   (solo horas, sin datos) van en localStorage: sobreviven a recargar y se
 *   comparten entre pestañas. Si el almacenamiento falla al leer O al escribir,
 *   la página pasa a usar solo la memoria. La reserva corre bajo
 *   `navigator.locks` cuando existe: dos pestañas no pasan el tope a la vez; sin
 *   locks, el límite es «3 por navegador, salvo carrera entre pestañas».
 *   rack-attack corta a 5 logins por IP cada 5 min y cada SSO suma una sesión
 *   (tope 5): Studio no debe empeorar ninguna de las dos (H1, H4).
 * - **Con `error` el iframe se desmonta**: no hay enlace válido que mostrar. Con
 *   `lento` y `freno` sigue montado por si termina de cargar.
 * - **El fondo queda `inert`** en pantalla completa: Tab no cae detrás de la capa.
 *   Solo las ramas marcadas con `data-capa-fondo` (el menú y la barra del shell,
 *   la cabecera del CRM y lo del admin debajo del panel). Los avisos, la guía y
 *   el BugFAB no están marcados y siguen vivos: cuelgan del shell como hermanos,
 *   sin portal, así que «todo lo de al lado» los apagaría.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { origenDe, usePuenteChatwoot } from "@/app/studio/_components/guia/usePuenteChatwoot";
import { pedirEnlaceSso, reconciliarBandeja, type BandejaErrorCode } from "../actions";
import { PortalChatwoot } from "./PortalChatwoot";
import type { ResumenPortal } from "@/lib/studio/chatwoot/portal";
import type { EventoDescartado } from "@/lib/studio/chatwoot/conversations-queries";

export type BandejaEstado = "sin_configurar" | "sin_vinculo" | "listo";

/** Intentos del enlace ante `service` y la espera antes de cada reintento. */
export const INTENTOS_ENLACE = 3;
export const ESPERAS_REINTENTO_MS = [1500, 4000] as const;
/** Si el marco no termina de cargar en este tiempo, se ofrece abrirlo de nuevo. */
export const VIGILANTE_CARGA_MS = 20_000;
/** Aperturas por SSO permitidas por ventana y navegador (automáticas y manuales). */
export const SSO_MAX = 3;
export const VENTANA_SSO_MS = 5 * 60_000;
/** Marcas del freno: horas (ms) de las últimas aperturas por SSO. Sin datos de nadie. */
export const CLAVE_SSO = "dtd.bandeja.sso";
/** Preferencia de este navegador: "0" = reducida. Sin valor, pantalla completa. */
export const CLAVE_AMPLIADA = "dtd.bandeja.ampliada";

interface Props {
  estado: BandejaEstado;
  panelUrl: string | null;
  inicioUrl: string | null;
  /** `?c=N`: conversación a abrir (E2-D24). */
  conversacion?: number | null;
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
  | { tipo: "error"; codigo: BandejaErrorCode };

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Marca de las ramas del fondo que la pantalla completa vuelve `inert`. */
export const ATRIBUTO_FONDO = "data-capa-fondo";

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

/** Reserva una apertura si cabe en la ventana; si no, `false` y no se pide SSO. */
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

/**
 * Pone `inert` a las ramas marcadas con `data-capa-fondo` que no contienen la capa.
 * Solo toca las que no lo tenían y devuelve cómo deshacerlo. Sin soporte de
 * `inert` el atributo no hace nada y la capa sigue funcionando: es el respaldo seguro.
 */
function inertizarFondo(capa: HTMLElement): () => void {
  const tocados: Element[] = [];
  for (const rama of Array.from(document.querySelectorAll(`[${ATRIBUTO_FONDO}]`))) {
    if (rama.contains(capa) || rama.hasAttribute("inert")) continue;
    rama.setAttribute("inert", "");
    tocados.push(rama);
  }
  return () => tocados.forEach((r) => r.removeAttribute("inert"));
}

function leerAmpliada(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_AMPLIADA) !== "0";
  } catch {
    return true;
  }
}

function guardarAmpliada(valor: boolean) {
  try {
    window.localStorage.setItem(CLAVE_AMPLIADA, valor ? "1" : "0");
  } catch {
    // Sin almacenamiento la Bandeja igual funciona; solo no recuerda la elección.
  }
}

export function BandejaClient({ estado, panelUrl, inicioUrl, conversacion = null, admin }: Props) {
  const t = useT();
  const [src, setSrc] = useState<string | null>(inicioUrl);
  const [fase, setFase] = useState<Fase>(inicioUrl ? { tipo: "abriendo" } : { tipo: "pidiendo", intento: 1 });
  /** `null` hasta leer la preferencia: así el servidor y la hidratación coinciden y no hay destello. */
  const [ampliada, setAmpliada] = useState<boolean | null>(null);
  /** La ayuda de «Abrir de nuevo» aparece solo después de un fallo (o de reabrir a mano). */
  const [huboFallo, setHuboFallo] = useState(false);
  const pidioAlMontar = useRef(false);
  const reconcilio = useRef(false);
  const seccionRef = useRef<HTMLElement | null>(null);
  /** Cada pedido lleva un número; el que llega tarde (otro pedido o desmontado) no pisa el estado. */
  const corrida = useRef(0);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const botonModoRef = useRef<HTMLButtonElement | null>(null);
  /** Solo un cambio que hizo la persona mueve el foco; el modo inicial no se lo quita. */
  const moverFoco = useRef(false);
  // Guía dentro del panel (SDD-0589, 9.4): el marco es el ancla de respaldo y el
  // puente le pregunta al script del panel dónde está cada ancla de Chatwoot.
  const marcoRef = useRef<HTMLIFrameElement | null>(null);
  usePuenteChatwoot(marcoRef, origenDe(panelUrl));

  const pedirConReintentos = useCallback(async () => {
    const mia = ++corrida.current;
    // Cada apertura cuenta una vez para el freno, termine bien o en `service`.
    const reservada = await reservarAperturaExclusiva();
    if (mia !== corrida.current) return;
    if (!reservada) {
      setFase({ tipo: "freno" });
      setHuboFallo(true);
      return;
    }
    for (let intento = 1; intento <= INTENTOS_ENLACE; intento++) {
      setFase({ tipo: "pidiendo", intento });
      const r = await pedirEnlaceSso(conversacion ?? undefined);
      if (mia !== corrida.current) return;
      if (r.ok) {
        setSrc(r.url);
        setFase({ tipo: "abriendo" });
        return;
      }
      // Solo `service` es pasajero; denied/unlinked/unconfigured no cambian por reintentar.
      if (r.error !== "service" || intento === INTENTOS_ENLACE) {
        setFase({ tipo: "error", codigo: r.error });
        setHuboFallo(true);
        return;
      }
      // Durante la espera ya se anuncia el próximo intento.
      setFase({ tipo: "pidiendo", intento: intento + 1 });
      await esperar(ESPERAS_REINTENTO_MS[intento - 1] ?? ESPERAS_REINTENTO_MS[ESPERAS_REINTENTO_MS.length - 1]);
      if (mia !== corrida.current) return;
    }
  }, [conversacion]);

  /** «Abrir de nuevo»: un SSO nuevo; el freno lo aplica `pedirConReintentos`. */
  const abrirDeNuevo = useCallback(async () => {
    setHuboFallo(true);
    await pedirConReintentos();
  }, [pedirConReintentos]);

  useEffect(() => {
    // Un pedido que sigue en vuelo al desmontar no escribe estado.
    return () => {
      corrida.current += 1;
    };
  }, []);

  useEffect(() => {
    // Una reconciliación por montaje; si falla, el contador sigue con el webhook.
    if (estado !== "listo" || reconcilio.current) return;
    reconcilio.current = true;
    void reconciliarBandeja().catch(() => undefined);
  }, [estado]);

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
      setHuboFallo(true);
    }, VIGILANTE_CARGA_MS);
    return () => clearTimeout(id);
  }, [fase.tipo, src]);

  useEffect(() => {
    // Lectura diferida y cancelable, como `useColumnConfig`: el servidor no ve el
    // almacenamiento y así no hay diferencia de hidratación.
    const id = setTimeout(() => setAmpliada(leerAmpliada()), 0);
    return () => clearTimeout(id);
  }, []);

  const listo = estado === "listo";
  const enPantallaCompleta = listo && ampliada === true;

  const cambiarModo = useCallback((valor: boolean) => {
    moverFoco.current = true;
    setAmpliada(valor);
    guardarAmpliada(valor);
  }, []);

  useEffect(() => {
    if (!moverFoco.current) return;
    moverFoco.current = false;
    (ampliada ? tituloRef.current : botonModoRef.current)?.focus();
  }, [ampliada]);

  useEffect(() => {
    if (!enPantallaCompleta) return;
    // Esc solo llega aquí con el foco en Studio; dentro del panel el teclado es de Chatwoot.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Un diálogo de Studio abierto encima maneja su propio Esc.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      cambiarModo(false);
    }
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    const deshacerInert = seccionRef.current ? inertizarFondo(seccionRef.current) : () => undefined;
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previo;
      deshacerInert();
    };
  }, [enPantallaCompleta, cambiarModo]);

  const abrirEnPestana = panelUrl ? (
    <a href={panelUrl} target="_blank" rel="noopener noreferrer" className="studio-btn studio-btn-ghost studio-btn-sm">
      {t("bandeja.action.open_tab")}
    </a>
  ) : null;

  const agentes = admin?.agentesHref ? (
    <Link href={admin.agentesHref} className="studio-btn studio-btn-ghost studio-btn-sm">
      {t("bandeja.links.manage")}
    </Link>
  ) : null;

  const pidiendo = fase.tipo === "pidiendo";
  const reabrir = (variante: "primary" | "ghost") => (
    <ActionButton
      variant={variante}
      size="sm"
      idleLabel={t("bandeja.action.reopen")}
      loadingLabel={t("bandeja.state.loading")}
      successLabel={null}
      disabled={pidiendo}
      onAction={abrirDeNuevo}
    />
  );

  const aviso =
    fase.tipo === "error"
      ? fase.codigo === "service"
        ? t("bandeja.recover.service", { total: INTENTOS_ENLACE })
        : t(`bandeja.error.${fase.codigo}` as I18nKey)
      : fase.tipo === "lento"
        ? t("bandeja.recover.slow")
        : fase.tipo === "freno"
          ? t("bandeja.recover.throttle")
          : null;

  // Con error no hay marco (no hay enlace válido); lento y freno lo dejan montado por si carga.
  const conMarco = src !== null && fase.tipo !== "error";

  const panel = listo ? (
    <section
      ref={seccionRef}
      aria-labelledby="bandeja-titulo"
      data-modo={ampliada === null ? "pendiente" : enPantallaCompleta ? "completa" : "compacta"}
      style={
        ampliada === null
          ? // Sin decidir todavía: el marco ya carga, pero no se pinta en un modo para saltar al otro.
            { display: "flex", flexDirection: "column", gap: "var(--s-2)", visibility: "hidden" }
          : enPantallaCompleta
          ? {
              position: "fixed",
              inset: 0,
              // Sobre el topbar (70) y el menú (80); debajo de la guía (89-90), drawers (100) y avisos.
              zIndex: 85,
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-base)",
            }
          : { display: "flex", flexDirection: "column", gap: "var(--s-2)" }
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-2)",
          flexWrap: "wrap",
          minHeight: 44,
          ...(enPantallaCompleta
            ? { padding: "var(--s-1) var(--s-4)", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }
            : {}),
        }}
      >
        <h2
          id="bandeja-titulo"
          ref={tituloRef}
          tabIndex={-1}
          style={{ font: "800 15px/1.2 var(--f-display)", color: "var(--ink)", margin: 0, outlineOffset: 2 }}
        >
          {t("bandeja.page.title")}
        </h2>
        {huboFallo && !aviso ? (
          <p style={{ flex: "1 1 220px", margin: 0, font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {t("bandeja.help.reopen")}
          </p>
        ) : (
          <span style={{ flex: "1 1 auto" }} />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
          {agentes}
          {reabrir("ghost")}
          {abrirEnPestana}
          {enPantallaCompleta ? (
            <button
              type="button"
              ref={botonModoRef}
              className="studio-btn studio-btn-ghost studio-btn-sm"
              aria-keyshortcuts="Escape"
              onClick={() => cambiarModo(false)}
            >
              {t("bandeja.action.collapse")}
              <kbd aria-hidden="true" style={{ marginLeft: "var(--s-1)", font: "600 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                {t("bandeja.action.collapse_hint")}
              </kbd>
            </button>
          ) : (
            <button
              type="button"
              ref={botonModoRef}
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => cambiarModo(true)}
            >
              {t("bandeja.action.expand")}
            </button>
          )}
        </div>
      </div>

      {aviso ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-2)",
            ...(enPantallaCompleta ? { padding: "var(--s-3) var(--s-4) 0" } : {}),
          }}
        >
          <Aviso tono={fase.tipo === "error" ? "error" : "atencion"} urgente titulo={t("bandeja.recover.title")}>
            {aviso}
          </Aviso>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s-2)", flexWrap: "wrap" }}>
            {abrirEnPestana}
            {fase.tipo !== "freno" ? reabrir("primary") : null}
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: "relative",
          ...(enPantallaCompleta ? { flex: "1 1 auto", minHeight: 0 } : {}),
        }}
      >
        {fase.tipo === "pidiendo" || fase.tipo === "abriendo" ? (
          <p
            role="status"
            style={{ position: "absolute", inset: "var(--s-4) 0 auto", textAlign: "center", font: "500 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}
          >
            {fase.tipo === "pidiendo" && fase.intento > 1
              ? t("bandeja.state.retrying", { n: fase.intento, total: INTENTOS_ENLACE })
              : t("bandeja.state.loading")}
          </p>
        ) : null}
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
            style={
              enPantallaCompleta
                ? { display: "block", width: "100%", height: "100%", border: 0, background: "var(--bg-surface)" }
                : {
                    display: "block",
                    width: "100%",
                    // SDD-0655: arriba van la cabecera y la barra del CRM. Estimado, sin medir: se mide en el smoke.
                    height: "calc(100dvh - 300px)",
                    minHeight: 480,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-lg)",
                    background: "var(--bg-surface)",
                  }
            }
          />
        ) : null}
      </div>
    </section>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      {!listo && agentes ? (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s-2)" }}>{agentes}</div>
      ) : null}

      {estado === "sin_configurar" ? (
        <EmptyState title={t("bandeja.state.unconfigured.title")} description={t("bandeja.state.unconfigured.body")} />
      ) : estado === "sin_vinculo" ? (
        <EmptyState title={t("bandeja.state.unlinked.title")} description={t("bandeja.state.unlinked.body")} />
      ) : (
        panel
      )}

      {admin?.portal ? (
        <div data-capa-fondo="">
          <PortalChatwoot resumen={admin.portal} />
        </div>
      ) : null}
      {admin?.descartados?.length ? (
        <section
          data-capa-fondo=""
          aria-labelledby="bandeja-descartados"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "var(--s-6)", display: "flex", flexDirection: "column", gap: "var(--s-2)" }}
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

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
 *   el marco no carga. Tres «Abrir de nuevo» en 5 minutos frenan: rack-attack
 *   corta a 5 logins por IP cada 5 min y cada SSO suma una sesión (tope 5).
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
/** «Abrir de nuevo» manuales permitidos por ventana antes del freno. */
export const REAPERTURAS_MAX = 2;
export const VENTANA_REAPERTURAS_MS = 5 * 60_000;
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
  const [ampliada, setAmpliada] = useState(true);
  const pidioAlMontar = useRef(false);
  const reconcilio = useRef(false);
  const reaperturas = useRef<number[]>([]);
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
        return;
      }
      // Durante la espera ya se anuncia el próximo intento.
      setFase({ tipo: "pidiendo", intento: intento + 1 });
      await esperar(ESPERAS_REINTENTO_MS[intento - 1] ?? ESPERAS_REINTENTO_MS[ESPERAS_REINTENTO_MS.length - 1]);
      if (mia !== corrida.current) return;
    }
  }, [conversacion]);

  /** «Abrir de nuevo»: un SSO nuevo, con el freno de los ingresos repetidos. */
  const abrirDeNuevo = useCallback(async () => {
    const ahora = Date.now();
    reaperturas.current = reaperturas.current.filter((t0) => ahora - t0 < VENTANA_REAPERTURAS_MS);
    if (reaperturas.current.length >= REAPERTURAS_MAX) {
      setFase({ tipo: "freno" });
      return;
    }
    reaperturas.current.push(ahora);
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
    const id = setTimeout(() => setFase((f) => (f.tipo === "abriendo" ? { tipo: "lento" } : f)), VIGILANTE_CARGA_MS);
    return () => clearTimeout(id);
  }, [fase.tipo, src]);

  useEffect(() => {
    setAmpliada(leerAmpliada());
  }, []);

  const listo = estado === "listo";
  const enPantallaCompleta = listo && ampliada;

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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previo;
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
      aria-labelledby="bandeja-titulo"
      data-modo={enPantallaCompleta ? "completa" : "compacta"}
      style={
        enPantallaCompleta
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
        <p style={{ flex: "1 1 220px", margin: 0, font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {t("bandeja.help.reopen")}
        </p>
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
            onLoad={() => setFase((f) => (f.tipo === "abriendo" || f.tipo === "lento" ? { tipo: "abierto" } : f))}
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

      {admin?.portal ? <PortalChatwoot resumen={admin.portal} /> : null}
      {admin?.descartados?.length ? (
        <section
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

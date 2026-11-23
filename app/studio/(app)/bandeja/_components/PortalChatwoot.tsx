"use client";

/**
 * Estado del chat del portal en la fila de la Bandeja (SDD-0586, paso 10.5, PR 1b, §10.5.20;
 * SDD-0680, adenda «estado del portal en la fila», variante A elegida por Sam el 2026-11-23).
 * Solo la monta la página para un admin, y solo con la bandeja del portal configurada.
 *
 * Antes era una tarjeta debajo del panel: había que bajar más allá de Chatwoot para verla y casi
 * siempre decía «0» y «0». Ahora es una pastilla en la fila de arriba, junto a «Conectada»:
 * - al día, apagado, con mensajes sin llegar o con atascados (el estado va con icono y texto,
 *   nunca solo con color);
 * - con atascados, «Reintentar los atascados» queda en la fila, sin abrir nada;
 * - al hacer clic abre el detalle: qué es, los dos números y el mismo botón.
 *
 * Los números son los del aviso de E10-D40: mensajes del portal que llevan más de 15 min sin
 * llegar a Chatwoot y cuántos de ellos están atascados. Un atascado detiene su hilo hasta que se
 * reintenta. Solo números: ni nombres ni texto.
 */
import { useActionState, useEffect, useId, useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import { StatusIcon } from "@/components/StatusIcon";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import type { ResumenPortal } from "@/lib/studio/chatwoot/portal";
import { destrabarPortal, type DestrabarState } from "../actions";

const INICIAL: DestrabarState = { ok: false, error: null };

const TEXTO = { font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 } as const;

export type TonoPortal = "neutral" | "success" | "warning" | "danger";

/** El tono y el texto de la pastilla. Exportado para las pruebas. */
export function estadoPortal(resumen: ResumenPortal): { tono: TonoPortal; clave: I18nKey; n?: number } {
  if (!resumen.encendido) return { tono: "neutral", clave: "bandeja.portal.pill.off" };
  if (resumen.atascados > 0) return { tono: "danger", clave: "bandeja.portal.pill.atascados", n: resumen.atascados };
  if (resumen.sinLlegar > 0) return { tono: "warning", clave: "bandeja.portal.pill.sin_llegar", n: resumen.sinLlegar };
  return { tono: "success", clave: "bandeja.portal.pill.ok" };
}

const COLOR_TONO: Record<TonoPortal, string> = {
  neutral: "var(--ink-soft)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger-text)",
};

export function PortalChatwoot({ resumen }: { resumen: ResumenPortal }) {
  const t = useT();
  const [estado, accion, pendiente] = useActionState(destrabarPortal, INICIAL);
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const tituloId = useId();
  const zona = useRef<HTMLDivElement | null>(null);
  const disparador = useRef<HTMLButtonElement | null>(null);
  const error = estado.error ? { error: t(`bandeja.error.${estado.error}` as I18nKey) } : null;
  // El botón queda deshabilitado mientras corre y, sin atascados, también después: el foco va al
  // resultado para no caer en el body (ui-check).
  const resultado = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (estado.ok || estado.error) {
      // El resultado vive en el detalle: se abre para que se lea.
      setAbierto(true);
      requestAnimationFrame(() => resultado.current?.focus());
    }
  }, [estado]);

  useEffect(() => {
    // El detalle se cierra con Escape (el foco vuelve a la pastilla) o con un clic afuera.
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      disparador.current?.focus();
    };
    const alPulsar = (e: PointerEvent) => {
      if (zona.current && e.target instanceof Node && !zona.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alPulsar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alPulsar);
    };
  }, [abierto]);

  const { tono, clave, n } = estadoPortal(resumen);
  const etiqueta = t(clave, n === undefined ? undefined : { n });
  const conAtascados = resumen.encendido && resumen.atascados > 0;

  const reintentar = (
    <form action={accion} style={{ display: "inline-flex" }}>
      <button
        type="submit"
        className="studio-btn studio-btn-primary studio-btn-sm"
        disabled={pendiente || !conAtascados}
        aria-busy={pendiente}
      >
        {pendiente ? t("bandeja.portal.retrying") : t("bandeja.portal.retry")}
      </button>
    </form>
  );

  return (
    <div ref={zona} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "var(--s-2)" }}>
      <button
        ref={disparador}
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        aria-expanded={abierto}
        aria-controls={panelId}
        data-tono={tono}
        onClick={() => setAbierto((a) => !a)}
        style={{ gap: "var(--s-1)" }}
      >
        <StatusIcon tone={tono} size={14} style={{ color: COLOR_TONO[tono] }} />
        {etiqueta}
      </button>
      {conAtascados ? reintentar : null}

      {abierto ? (
        <section
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={tituloId}
          style={{
            position: "absolute",
            top: "calc(100% + var(--s-1))",
            left: 0,
            zIndex: 20,
            width: "min(360px, calc(100vw - 32px))",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-md)",
            padding: "var(--s-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-3)",
          }}
        >
          <div>
            <h2 id={tituloId} style={{ font: "700 14px/1.3 var(--f-sans)", color: "var(--ink)", margin: "0 0 var(--s-1)" }}>
              {t("bandeja.portal.title")}
            </h2>
            <p style={TEXTO}>{t("bandeja.portal.help")}</p>
          </div>

          {!resumen.encendido ? (
            <p role="status" style={TEXTO}>
              {t("bandeja.portal.off")}
            </p>
          ) : (
            <>
              <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--s-1) var(--s-4)", margin: 0 }}>
                <dt style={TEXTO}>{t("bandeja.portal.sin_llegar")}</dt>
                <dd style={{ margin: 0, font: "600 14px/1.5 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
                  {resumen.sinLlegar}
                </dd>
                <dt style={TEXTO}>{t("bandeja.portal.atascados")}</dt>
                <dd style={{ margin: 0, font: "600 14px/1.5 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
                  {resumen.atascados}
                </dd>
              </dl>
              {conAtascados ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>{reintentar}</div>
              ) : (
                <p style={TEXTO}>{t("bandeja.portal.none")}</p>
              )}
              <div ref={resultado} tabIndex={-1} data-testid="bandeja-portal-resultado" style={{ outline: "none" }}>
                <ErrorAlert state={error} />
                {estado.ok ? (
                  <p role="status" style={{ ...TEXTO, font: "500 13px/1.4 var(--f-sans)" }}>
                    {t("bandeja.portal.retried", { n: estado.destrabados ?? 0 })}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

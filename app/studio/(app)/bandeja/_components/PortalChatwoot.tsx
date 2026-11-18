"use client";

/**
 * Tarjeta «Portal → Chatwoot» de la Bandeja (SDD-0586, paso 10.5, PR 1b, §10.5.20). Solo la
 * monta la página para un admin, y solo con la bandeja del portal configurada.
 *
 * Muestra los mismos números del aviso de E10-D40 (mensajes del portal que llevan más de 15 min
 * sin llegar a Chatwoot y cuántos de ellos están atascados) y «Reintentar los atascados»: un
 * atascado detiene su hilo hasta que se reintenta. Solo números: ni nombres ni texto.
 */
import { useActionState, useEffect, useRef } from "react";

import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import type { ResumenPortal } from "@/lib/studio/chatwoot/portal";
import { destrabarPortal, type DestrabarState } from "../actions";

const INICIAL: DestrabarState = { ok: false, error: null };

const TEXTO = { font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 } as const;

export function PortalChatwoot({ resumen }: { resumen: ResumenPortal }) {
  const t = useT();
  const [estado, accion, pendiente] = useActionState(destrabarPortal, INICIAL);
  const error = estado.error ? { error: t(`bandeja.error.${estado.error}` as I18nKey) } : null;
  // El botón queda deshabilitado mientras corre y, sin atascados, también después: el foco va al
  // resultado para no caer en el body (ui-check).
  const resultado = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (estado.ok || estado.error) resultado.current?.focus();
  }, [estado]);

  return (
    <section
      aria-labelledby="bandeja-portal"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "var(--s-6)", display: "flex", flexDirection: "column", gap: "var(--s-3)" }}
    >
      <div>
        <h2 id="bandeja-portal" style={{ font: "800 16px/1.2 var(--f-display)", color: "var(--ink)", margin: "0 0 var(--s-1)" }}>
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
          <dl style={{ display: "flex", gap: "var(--s-6)", flexWrap: "wrap", margin: 0 }}>
            <div>
              <dt style={TEXTO}>{t("bandeja.portal.sin_llegar")}</dt>
              <dd style={{ margin: 0, font: "800 20px/1.2 var(--f-mono)", color: "var(--ink)" }}>{resumen.sinLlegar}</dd>
            </div>
            <div>
              <dt style={TEXTO}>{t("bandeja.portal.atascados")}</dt>
              <dd
                style={{
                  margin: 0,
                  font: "800 20px/1.2 var(--f-mono)",
                  color: resumen.atascados > 0 ? "var(--danger-text)" : "var(--ink)",
                }}
              >
                {resumen.atascados}
              </dd>
            </div>
          </dl>
          <form action={accion}>
            <button
              type="submit"
              className="studio-btn studio-btn-primary"
              disabled={pendiente || resumen.atascados === 0}
              aria-describedby={resumen.atascados === 0 ? "bandeja-portal-sin-atascados" : undefined}
            >
              {pendiente ? t("bandeja.portal.retrying") : t("bandeja.portal.retry")}
            </button>
          </form>
          {resumen.atascados === 0 ? (
            <p id="bandeja-portal-sin-atascados" style={TEXTO}>
              {t("bandeja.portal.none")}
            </p>
          ) : null}
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
  );
}

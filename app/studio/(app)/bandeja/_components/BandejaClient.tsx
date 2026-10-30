"use client";

/**
 * Bandeja de Chatwoot en un iframe (SDD-0585, paso 2.2).
 *
 * - `inicioUrl` presente → ya se pidió el SSO para este usuario en esta sesión
 *   de Studio: el iframe abre el panel directo.
 * - `inicioUrl` ausente → se pide UN enlace de un solo uso al montar. «Volver a
 *   entrar» fuerza otro (cuando el panel muestra su pantalla de login).
 * - `allow="microphone"`: las notas de voz. La cabecera de la ruta lo delega al
 *   origen del chat (PoC 2.1: hacen falta el atributo y la cabecera).
 * - Al montar con vínculo, `reconciliarBandeja` corrige el contador con lo que
 *   el agente ve en Chatwoot (un agente que lee sin responder no dispara webhook).
 * - `conversacion`: el SSO lleva la conversación y Chatwoot redirige a ella.
 * - Sin `sandbox`: el panel necesita scripts, su origen, formularios, ventanas
 *   emergentes y descargas, y un sandbox con todo eso no protege nada.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { pedirEnlaceSso, reconciliarBandeja, type BandejaErrorCode } from "../actions";
import { VinculosAdmin, type MiembroOpcion, type VinculoFila } from "./VinculosAdmin";
import type { EventoDescartado } from "@/lib/studio/chatwoot/conversations-queries";

export type BandejaEstado = "sin_configurar" | "sin_vinculo" | "listo";

interface Props {
  estado: BandejaEstado;
  panelUrl: string | null;
  inicioUrl: string | null;
  /** `?c=N`: conversación a abrir (E2-D24). */
  conversacion?: number | null;
  admin: { vinculos: VinculoFila[]; miembros: MiembroOpcion[]; descartados?: EventoDescartado[] } | null;
}

type Fase = { tipo: "pidiendo" } | { tipo: "abriendo" } | { tipo: "abierto" } | { tipo: "error"; codigo: BandejaErrorCode };

export function BandejaClient({ estado, panelUrl, inicioUrl, conversacion = null, admin }: Props) {
  const t = useT();
  const [src, setSrc] = useState<string | null>(inicioUrl);
  const [fase, setFase] = useState<Fase>(inicioUrl ? { tipo: "abriendo" } : { tipo: "pidiendo" });
  const pidioAlMontar = useRef(false);
  const reconcilio = useRef(false);

  const pedir = useCallback(async () => {
    setFase({ tipo: "pidiendo" });
    const r = await pedirEnlaceSso(conversacion ?? undefined);
    if (r.ok) {
      setSrc(r.url);
      setFase({ tipo: "abriendo" });
    } else {
      setFase({ tipo: "error", codigo: r.error });
    }
  }, [conversacion]);

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
    void pedir();
  }, [estado, inicioUrl, pedir]);

  const abrirEnPestana = panelUrl ? (
    <a
      href={panelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="studio-btn studio-btn-ghost studio-btn-sm"
    >
      {t("bandeja.action.open_tab")}
    </a>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--s-4)", flexWrap: "wrap" }}>
        <div>
          <div style={{ font: "700 10.5px/1 var(--f-sans)", color: "var(--wine-text)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "var(--s-2)" }}>
            {t("bandeja.page.eyebrow")}
          </div>
          <h1 style={{ font: "900 24px/1.15 var(--f-display)", color: "var(--ink)", margin: 0 }}>{t("bandeja.page.title")}</h1>
        </div>
        {estado === "listo" && fase.tipo !== "error" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
            <ActionButton
              variant="ghost"
              size="sm"
              idleLabel={t("bandeja.action.relogin")}
              loadingLabel={t("bandeja.state.loading")}
              successLabel={null}
              disabled={fase.tipo === "pidiendo"}
              onAction={pedir}
            />
            {abrirEnPestana}
          </div>
        ) : null}
      </header>

      {estado === "sin_configurar" ? (
        <EmptyState title={t("bandeja.state.unconfigured.title")} description={t("bandeja.state.unconfigured.body")} />
      ) : estado === "sin_vinculo" ? (
        <EmptyState title={t("bandeja.state.unlinked.title")} description={t("bandeja.state.unlinked.body")} />
      ) : fase.tipo === "error" ? (
        <EmptyState
          title={t("bandeja.state.error.title")}
          description={
            <>
              <span>{t(`bandeja.error.${fase.codigo}` as I18nKey)}</span> <span>{t("bandeja.state.error.body")}</span>
            </>
          }
          action={
            <div style={{ display: "flex", justifyContent: "center", gap: "var(--s-2)" }}>
              <ActionButton idleLabel={t("bandeja.action.retry")} loadingLabel={t("bandeja.state.loading")} successLabel={null} onAction={pedir} />
              {abrirEnPestana}
            </div>
          }
        />
      ) : (
        <div style={{ position: "relative" }}>
          {fase.tipo !== "abierto" ? (
            <p role="status" style={{ position: "absolute", inset: "var(--s-4) 0 auto", textAlign: "center", font: "500 13px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: 0 }}>
              {t("bandeja.state.loading")}
            </p>
          ) : null}
          {src ? (
            <iframe
              key={src}
              src={src}
              title={t("bandeja.frame.title")}
              allow="microphone"
              onLoad={() => setFase({ tipo: "abierto" })}
              style={{
                display: "block",
                width: "100%",
                height: "calc(100dvh - 180px)",
                minHeight: 480,
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                background: "var(--bg-surface)",
              }}
            />
          ) : null}
        </div>
      )}

      {admin ? <VinculosAdmin vinculos={admin.vinculos} miembros={admin.miembros} /> : null}
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

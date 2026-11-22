"use client";

/**
 * Panel de conversaciones de la ficha del cliente (SDD-0650 F2).
 *
 * Recibe del servidor (`PanelConversacionesFicha`) lo ya filtrado: el texto solo si el
 * usuario puede ver datos de clientes (SDD-0531) y el enlace «Abrir» solo si su rol abre
 * esa conversación (D3: el Archivo Kommo, Admin y Contabilidad). Aquí no se decide
 * ningún permiso: lo que no llegó no se puede mostrar.
 *
 * Estados: cargando (`ConversacionesFichaCargando`, el fallback del Suspense), Chatwoot
 * no responde (con «Reintentar»), sin conversaciones y «hay conversaciones que tu rol
 * no abre» (sin decir cuántas).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties, type ReactNode } from "react";

import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { useLocale, useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import { logoDeCanalUnion, type CanalUnion } from "@/lib/studio/chatwoot/canal-union";
import type { ItemPanel, PanelConversaciones } from "@/lib/studio/chatwoot/ficha-conversaciones";

import { CanalLogo } from "../../crm/_components/CanalLogo";

import { quitarUnionAction, unirChatAction } from "../conversaciones-actions";

export interface UnionVisible {
  chatwootContactId: number;
  /** `portal`: la unión del chat del portal; la pone el sistema y no se quita a mano. */
  origen: "webhook" | "kommo" | "manual" | "portal";
  /** SDD-0676: por qué canal escribe ese contacto; null en las uniones anteriores. */
  canal?: CanalUnion | null;
}

/** Chip de un canal vinculado: nada que se oprima baja de 32 px (SDD-0603). */
const CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--s-2)",
  minHeight: 32,
  padding: "0 var(--s-1) 0 var(--s-3)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-md)",
  background: "var(--bg-base)",
  font: "500 13px/1.3 var(--f-sans)",
  color: "var(--ink)",
};

const TARJETA: CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-3)",
};
const TITULO: CSSProperties = { font: "800 15px/1.2 var(--f-display)", color: "var(--ink)", margin: 0 };
const TENUE: CSSProperties = { margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" };
/** Un `<summary>` también se oprime: nada que se oprima baja de 32 px (SDD-0603). */
const SUMARIO: CSSProperties = {
  cursor: "pointer",
  font: "600 13px/1.4 var(--f-sans)",
  color: "var(--ink-soft)",
  // Queda como list-item para conservar el triángulo; 13 px × 1,4 + 2 × 8 px ≈ 34 px.
  padding: "var(--s-2) 0",
};

function fechaCorta(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function Marco({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <section aria-labelledby="ficha-chatwoot" data-guia="cliente.conversaciones" style={TARJETA}>
      <h2 id="ficha-chatwoot" style={TITULO}>
        {t("bandeja.card.title")}
      </h2>
      {children}
    </section>
  );
}

/** Fallback del Suspense: el panel carga aparte y no frena la ficha. */
export function ConversacionesFichaCargando() {
  const t = useT();
  return (
    <Marco>
      <p style={TENUE} role="status" aria-live="polite">
        {t("bandeja.ficha.panel_loading")}
      </p>
    </Marco>
  );
}

export function ConversacionesFichaNoResponde() {
  const t = useT();
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <Marco>
      <Aviso
        tono="error"
        compacto
        accion={{ etiqueta: t("bandeja.ficha.retry"), onClick: () => iniciar(() => router.refresh()), disabled: pendiente }}
      >
        {t("bandeja.ficha.unreachable")}
      </Aviso>
    </Marco>
  );
}

function Conversacion({ item, puedeVerTexto }: { item: ItemPanel; puedeVerTexto: boolean }) {
  const t = useT();
  const locale = useLocale();
  const fecha = fechaCorta(item.fechaMensaje ?? item.ultimaActividad, locale);
  const textoVisible = item.texto ?? (puedeVerTexto ? t("bandeja.ficha.no_text") : t("bandeja.ficha.hidden_text"));
  return (
    <li style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", paddingBottom: "var(--s-2)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap" }}>
        <span style={{ font: "600 14px/1.3 var(--f-sans)", color: "var(--ink)" }}>
          {t("bandeja.card.conversation", { n: item.conversationId })}
          <span style={{ font: "500 12px/1 var(--f-sans)", color: "var(--ink-soft)", marginLeft: "var(--s-2)" }}>
            {t(`bandeja.status.${item.estado}` as I18nKey)}
          </span>
          {item.esArchivoKommo ? (
            <span style={{ font: "500 12px/1 var(--f-sans)", color: "var(--ink-soft)", marginLeft: "var(--s-2)" }}>
              · {t("bandeja.ficha.archivo")}
            </span>
          ) : null}
        </span>
        {item.abrirHref ? (
          <Link href={item.abrirHref} className="studio-btn studio-btn-ghost studio-btn-sm">
            {t("bandeja.card.open")}
          </Link>
        ) : null}
      </div>
      <p
        style={{
          margin: 0,
          font: "400 13px/1.45 var(--f-sans)",
          color: item.texto ? "var(--ink)" : "var(--ink-soft)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {item.autor ? (
          <strong style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{t(`bandeja.ficha.author.${item.autor}` as I18nKey)}: </strong>
        ) : null}
        {textoVisible}
      </p>
      {fecha ? <span style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>{fecha}</span> : null}
    </li>
  );
}

function UnirChat({ clientId, markbox }: { clientId: string; markbox: string }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const n = Number(numero);
  const valido = Number.isSafeInteger(n) && n > 0 && motivo.trim().length >= 4;
  return (
    <details>
      <summary style={SUMARIO}>
        {t("bandeja.ficha.link_title")}
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)", marginTop: "var(--s-2)" }}>
        <label className="studio-label" htmlFor="ficha-unir-numero">
          {t("bandeja.ficha.link_conversation")}
        </label>
        <input
          id="ficha-unir-numero"
          className="studio-input studio-input-mono"
          inputMode="numeric"
          autoComplete="off"
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))}
        />
        <label className="studio-label" htmlFor="ficha-unir-motivo">
          {t("bandeja.ficha.link_reason")}
        </label>
        <input
          id="ficha-unir-motivo"
          className="studio-input"
          maxLength={1000}
          placeholder={t("bandeja.ficha.link_reason_placeholder")}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {error ? (
          <Aviso tono="error" compacto>
            {error}
          </Aviso>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <ActionButton
            variant="dark"
            size="sm"
            idleLabel={t("bandeja.ficha.link_submit")}
            loadingLabel={t("bandeja.ficha.link_submitting")}
            successLabel={t("bandeja.ficha.link_done")}
            disabled={!valido}
            onAction={async () => {
              setError(null);
              const r = await unirChatAction(clientId, markbox, n, motivo);
              if (!r.ok) return { error: r.error };
              toast.success(r.mensaje);
              setNumero("");
              setMotivo("");
              router.refresh();
            }}
            onError={setError}
          />
        </div>
      </div>
    </details>
  );
}

function ChatsUnidos({
  uniones,
  puedeUnir,
  clientId,
  markbox,
}: {
  uniones: UnionVisible[];
  puedeUnir: boolean;
  clientId: string;
  markbox: string;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [quitando, setQuitando] = useState<number | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  if (uniones.length === 0 && !puedeUnir) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      {uniones.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          <h3 id="ficha-canales" style={{ margin: 0, font: "600 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {t("bandeja.ficha.channels_title")}
          </h3>
          {/* SDD-0676: un chip por contacto unido, con el logo de su canal (SDD-0648, D1). */}
          <ul aria-labelledby="ficha-canales" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
            {uniones.map((u) => {
              const logo = logoDeCanalUnion(u.canal);
              const idChip = `ficha-canal-${u.chatwootContactId}`;
              return (
                <li key={u.chatwootContactId} style={{ ...CHIP, paddingRight: puedeUnir && u.origen !== "portal" ? "var(--s-1)" : "var(--s-3)" }}>
                  {/* El nombre del canal va en texto al lado: el logo es decorativo. */}
                  {logo ? (
                    <span aria-hidden="true" style={{ display: "inline-flex" }}>
                      <CanalLogo canal={logo} size={16} />
                    </span>
                  ) : null}
                  <span id={idChip}>
                    {u.canal
                      ? t(`bandeja.ficha.channel.${u.canal}` as I18nKey)
                      : t("bandeja.ficha.contact", { n: u.chatwootContactId })}
                    <span style={{ color: "var(--ink-soft)", marginLeft: "var(--s-2)" }}>{t(`bandeja.ficha.origin.${u.origen}` as I18nKey)}</span>
                  </span>
                  {/* La unión del portal la pone el sistema y se va con la ficha: no se quita a mano. */}
                  {puedeUnir && u.origen !== "portal" ? (
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      aria-describedby={idChip}
                      onClick={() => { setError(undefined); setQuitando(u.chatwootContactId); }}
                    >
                      {t("bandeja.ficha.unlink")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {puedeUnir ? <UnirChat clientId={clientId} markbox={markbox} /> : null}
      <ConfirmDialog
        open={quitando !== null}
        title={t("bandeja.ficha.unlink_title")}
        message={t("bandeja.ficha.unlink_body")}
        confirmLabel={t("bandeja.ficha.unlink")}
        cancelLabel={t("bandeja.ficha.cancel")}
        danger
        pending={pendiente}
        reason
        reasonRequired
        reasonLabel={t("bandeja.ficha.reason")}
        error={error}
        onCancel={() => setQuitando(null)}
        onConfirm={(motivo) => {
          if (quitando === null) return;
          const contacto = quitando;
          iniciar(async () => {
            const r = await quitarUnionAction(clientId, markbox, contacto, motivo);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            setQuitando(null);
            toast.success(t("bandeja.ficha.unlink_done"));
            router.refresh();
          });
        }}
      />
    </div>
  );
}

export function ConversacionesFichaCard({
  panel,
  uniones,
  puedeUnir,
  puedeVerTexto,
  clientId,
  markbox,
}: {
  panel: PanelConversaciones;
  uniones: UnionVisible[];
  puedeUnir: boolean;
  puedeVerTexto: boolean;
  clientId: string;
  markbox: string;
}) {
  const t = useT();
  return (
    <Marco>
      {panel.nombreEnElChat ? (
        <p style={{ margin: 0, font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {t("bandeja.ficha.chat_name")}: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{panel.nombreEnElChat}</span>
        </p>
      ) : null}
      {panel.items.length === 0 ? (
        <p style={TENUE}>{t("bandeja.ficha.empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {panel.items.map((item) => (
            <Conversacion key={item.conversationId} item={item} puedeVerTexto={puedeVerTexto} />
          ))}
        </ul>
      )}
      {panel.hayQueNoAbres ? (
        <Aviso tono="info" compacto>
          {t("bandeja.ficha.restricted")}
        </Aviso>
      ) : null}
      {panel.incompleto ? (
        <Aviso tono="atencion" compacto>
          {t("bandeja.ficha.incomplete")}
        </Aviso>
      ) : null}
      <ChatsUnidos uniones={uniones} puedeUnir={puedeUnir} clientId={clientId} markbox={markbox} />
    </Marco>
  );
}

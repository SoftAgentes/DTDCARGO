"use client";

/**
 * ComposeView · Mailing → Envío manual (SDD-0143 Slice C · portado del Norte
 * erp/modules/mailing-compose.jsx).
 *
 * Grid 1fr / 360px:
 *   - Izquierda: toggle de canal (Email / WhatsApp), selector de template
 *     (filtra por canal · al elegir setea asunto + cuerpo), fila Para con
 *     botón "CC / BCC" que revela los campos, Asunto (solo email), textarea
 *     de cuerpo (texto plano · sin editor rich por decisión de diseño),
 *     bloque "Firma adjunta" (solo email · select de firma + preview con
 *     renderSignatureHtml), y footer con "Enviar ahora" + "Programar".
 *   - Derecha: card de destinatario rápido (deshabilitado · ver nota) + card
 *     informativa.
 *
 * Mutaciones (patrón del Studio, no fire-and-forget):
 *   - "Enviar ahora" → <ActionButton> llama sendManualEmailAction DIRECTO en
 *     onAction y devuelve { error } si falla; en éxito muestra la pantalla
 *     "Correo enviado".
 *   - "Programar" → revela un panel inline con <input datetime-local>; el
 *     <ActionButton> arma un FormData y llama scheduleEmailAction (Slice D).
 *
 * Simplificación consciente vs. Norte: el picker de clientes/leads del panel
 * derecho se deja como "Destinatario rápido · próximamente" (deshabilitado)
 * para no cargar listas pesadas de clientes/leads en esta vista. El operador
 * escribe el email a mano (o pega varios separados por coma).
 */

import { useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  MAIL_CHANNELS,
  channelLabel,
  type MailChannel,
  type MailSignature,
  type MailSignatureLayout,
  type MailTemplate,
} from "@/lib/studio/mail-types";
import { renderSignatureHtml } from "@/lib/studio/mail-signature-render";
import { INITIAL_MAILING_STATE } from "./mailing-types";
import { scheduleEmailAction, sendManualEmailAction } from "../actions";

interface Props {
  templates: MailTemplate[];
  signatures: MailSignature[];
}

const LAYOUT_SHORT: Record<MailSignatureLayout, string> = {
  corporate: "Clásico",
  inline: "Compacto",
  card: "Vertical",
  minimal: "Mínimo",
  image_only: "Foto",
};

const CHANNEL_ICON: Record<MailChannel, (s?: number) => React.ReactNode> = {
  email: (s) => Icon.mail(s),
  whatsapp: (s) => Icon.globe(s),
};

/** Devuelve el value de <input datetime-local> para "ahora + N minutos". */
function datetimeLocalMin(offsetMinutes = 1): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function ComposeView({ templates, signatures }: Props) {
  const [channel, setChannel] = useState<MailChannel>("email");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [ccVisible, setCcVisible] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [signatureUserId, setSignatureUserId] = useState<string>(
    signatures[0]?.user_id ?? "",
  );

  const [error, setError] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);
  const [scheduledIso, setScheduledIso] = useState<string | null>(null);

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === channel),
    [templates, channel],
  );

  const selectedSig = useMemo(
    () => signatures.find((s) => s.user_id === signatureUserId) ?? null,
    [signatures, signatureUserId],
  );

  const previewHtml = selectedSig
    ? renderSignatureHtml({
        layout: selectedSig.layout,
        full_name: selectedSig.full_name,
        role_label: selectedSig.role_label,
        email: selectedSig.email,
        phone: selectedSig.phone,
        photo_url: selectedSig.photo_url,
        company_name: selectedSig.company_name,
        lang: selectedSig.lang,
      })
    : "";

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setChannel(tpl.channel);
    if (tpl.channel === "email") setSubject(tpl.subject);
    setBody(tpl.body_html ?? "");
  };

  const resetForm = () => {
    setSentOk(false);
    setScheduledIso(null);
    setTo("");
    setCc("");
    setBcc("");
    setCcVisible(false);
    setSubject("");
    setBody("");
    setTemplateId("");
    setShowSchedule(false);
    setScheduleAt("");
    setError(null);
  };

  const buildFormData = (): FormData => {
    const fd = new FormData();
    fd.set("to", to.trim());
    fd.set("cc", cc);
    fd.set("bcc", bcc);
    fd.set("subject", subject);
    fd.set("body_html", body);
    fd.set("channel", channel);
    if (templateId) {
      const slug = templates.find((t) => t.id === templateId)?.slug;
      if (slug) fd.set("template_slug", slug);
    }
    if (signatureUserId && channel === "email") {
      fd.set("signature_user_id", signatureUserId);
    }
    return fd;
  };

  const canSend = to.trim().length > 0;

  // ── Pantalla de éxito · programado ─────────────────────────
  if (scheduledIso) {
    const d = new Date(scheduledIso);
    const when = d.toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <SuccessScreen
        icon={Icon.clock(28)}
        tone="wine"
        title="Envío programado"
        onReset={resetForm}
      >
        Se enviará a <b style={{ color: "var(--ink)" }}>{to.split(",")[0].trim()}</b>{" "}
        el <b style={{ color: "var(--ink)" }}>{when}</b>. Lo puedes ver y
        cancelar en la pestaña{" "}
        <b style={{ color: "var(--wine-text)" }}>Programados</b>.
      </SuccessScreen>
    );
  }

  // ── Pantalla de éxito · enviado ────────────────────────────
  if (sentOk) {
    return (
      <SuccessScreen
        icon={Icon.check(28)}
        tone="success"
        title="Correo enviado"
        onReset={resetForm}
      >
        Salió a <b style={{ color: "var(--ink)" }}>{to.split(",")[0].trim()}</b>{" "}
        y quedó registrado en el log de envíos.
      </SuccessScreen>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      {/* IZQUIERDA · redacción */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        {/* Canal + template */}
        <div
          style={{
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span
            className="studio-eyebrow"
            style={{ color: "var(--wine-text)" }}
          >
            Canal
          </span>
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 3,
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
            }}
          >
            {MAIL_CHANNELS.map((c) => {
              const isActive = channel === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: "var(--r-sm)",
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? "var(--bg-surface)" : "transparent",
                    color: isActive ? "var(--ink)" : "var(--ink-soft)",
                    font: `${isActive ? "700" : "500"} 12.5px/1 var(--f-sans)`,
                    boxShadow: isActive ? "var(--shadow-xs)" : "none",
                  }}
                >
                  {CHANNEL_ICON[c](13)} {channelLabel(c)}
                </button>
              );
            })}
          </div>

          <label
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="studio-input"
              style={{ width: 240 }}
            >
              <option value="">Usar template…</option>
              {channelTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ padding: "18px 22px" }}>
          {/* Para */}
          <FieldRow label="Para">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={
                channel === "whatsapp"
                  ? "+58 412 000 0000"
                  : "cliente@empresa.com  (o pega varios separados por coma)"
              }
              style={bareInput}
            />
            {channel === "email" && !ccVisible && (
              <button
                type="button"
                onClick={() => setCcVisible(true)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  font: "600 11.5px/1 var(--f-sans)",
                  color: "var(--wine-text)",
                  whiteSpace: "nowrap",
                }}
              >
                + CC / BCC
              </button>
            )}
          </FieldRow>

          {channel === "email" && ccVisible && (
            <>
              <FieldRow label="CC">
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@empresa.com"
                  style={bareInput}
                />
              </FieldRow>
              <FieldRow label="BCC">
                <input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="oculto@empresa.com"
                  style={bareInput}
                />
              </FieldRow>
            </>
          )}

          {channel === "email" && (
            <FieldRow label="Asunto">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Asunto del correo"
                style={{ ...bareInput, fontWeight: 600, fontSize: 14 }}
              />
            </FieldRow>
          )}

          {/* Cuerpo */}
          <div style={{ marginTop: 14 }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe el mensaje…"
              rows={10}
              className="studio-input"
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: 200,
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Firma adjunta */}
          {channel === "email" && signatures.length > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: 16,
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    font: "700 10.5px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Firma adjunta
                </span>
                <select
                  value={signatureUserId}
                  onChange={(e) => setSignatureUserId(e.target.value)}
                  className="studio-input"
                  style={{ width: 220 }}
                >
                  <option value="">Sin firma</option>
                  {signatures.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name} · {LAYOUT_SHORT[s.layout]}
                    </option>
                  ))}
                </select>
              </div>
              {previewHtml && (
                <div
                  style={{
                    padding: 14,
                    background: "#FBFAF7",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)",
                  }}
                  // HTML generado por renderSignatureHtml (función propia, con
                  // los valores del usuario escapados). No es input externo
                  // sin sanitizar.
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16 }}>
              <Aviso tono="error">{error}</Aviso>
            </div>
          )}

          {/* Programar · panel inline */}
          {showSchedule && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: 12,
              }}
            >
              <label
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span className="studio-label">Fecha y hora de envío</span>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  min={datetimeLocalMin()}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="studio-input"
                  style={{ width: 240 }}
                />
              </label>
              <ActionButton
                variant="dark"
                size="sm"
                idleLabel="Confirmar programación"
                loadingLabel="Programando…"
                successLabel="Programado"
                idleIcon={Icon.clock(13)}
                successIcon={Icon.check(13)}
                disabled={!canSend || !scheduleAt || channel === "whatsapp"}
                onError={setError}
                onSuccess={() => {
                  const iso = new Date(scheduleAt).toISOString();
                  setScheduledIso(iso);
                }}
                onAction={async () => {
                  setError(null);
                  if (!scheduleAt) return { error: "Elige fecha y hora." };
                  const fd = buildFormData();
                  fd.delete("to");
                  fd.set("to_email", to.trim());
                  fd.set("scheduled_for", new Date(scheduleAt).toISOString());
                  return scheduleEmailAction(INITIAL_MAILING_STATE, fd);
                }}
              />
              <button
                type="button"
                onClick={() => setShowSchedule(false)}
                className="studio-btn studio-btn-ghost studio-btn-sm"
              >
                Cancelar
              </button>
              {channel === "whatsapp" && (
                <span
                  style={{
                    font: "500 11.5px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  WhatsApp aún no se puede programar — cambia el canal a email.
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              paddingTop: 16,
              marginTop: 16,
              borderTop: "1px solid var(--border)",
            }}
          >
            <ActionButton
              variant="primary"
              size="sm"
              idleLabel="Enviar ahora"
              loadingLabel="Enviando…"
              successLabel={null}
              idleIcon={Icon.arrowR(13)}
              disabled={!canSend}
              onError={setError}
              onSuccess={() => setSentOk(true)}
              onAction={async () => {
                setError(null);
                return sendManualEmailAction(
                  INITIAL_MAILING_STATE,
                  buildFormData(),
                );
              }}
            />
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowSchedule((v) => !v);
                if (!scheduleAt) setScheduleAt(datetimeLocalMin(15));
              }}
              disabled={!canSend}
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ opacity: canSend ? 1 : 0.5 }}
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {Icon.clock(13)} Programar
              </span>
            </button>

            <div
              style={{
                marginLeft: "auto",
                font: "500 11.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {channel === "email" ? (
                <>Sale desde la cuenta configurada en Configuración</>
              ) : (
                <>WhatsApp aún no está conectado</>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DERECHA · helpers */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SideCard eyebrow="Destinatario rápido">
          <div
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginBottom: 12,
            }}
          >
            Pronto vas a poder elegir un cliente o lead y autocompletar el
            destinatario. Por ahora escribe el correo a mano en el campo Para.
          </div>
          <select
            disabled
            className="studio-input"
            style={{ width: "100%", opacity: 0.6, cursor: "not-allowed" }}
          >
            <option>Cliente… · próximamente</option>
          </select>
        </SideCard>

        <SideCard>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color: "var(--info)", flexShrink: 0 }}>
              {Icon.info(14)}
            </span>
            <div
              style={{
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              El correo se registra en el log de envíos. Si programas, queda en
              cola en la pestaña Programados hasta su fecha de envío.
            </div>
          </div>
        </SideCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────

const bareInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  font: "500 13.5px/1.5 var(--f-sans)",
  color: "var(--ink)",
};

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid var(--border)",
        padding: "10px 0",
      }}
    >
      <span
        style={{
          font: "600 11px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          minWidth: 40,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function SideCard({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 18,
      }}
    >
      {eyebrow && (
        <div
          className="studio-eyebrow"
          style={{ color: "var(--wine-text)", marginBottom: 10 }}
        >
          {eyebrow}
        </div>
      )}
      {children}
    </div>
  );
}

function SuccessScreen({
  icon,
  tone,
  title,
  children,
  onReset,
}: {
  icon: React.ReactNode;
  tone: "success" | "wine";
  title: string;
  children: React.ReactNode;
  onReset: () => void;
}) {
  const bg = tone === "success" ? "var(--success-bg)" : "var(--wine-tint)";
  const fg = tone === "success" ? "var(--success)" : "var(--wine)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: bg,
          color: fg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          font: "900 22px/1.2 var(--f-display)",
          color: "var(--ink)",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 10,
          maxWidth: "42ch",
        }}
      >
        {children}
      </div>
      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={onReset}
          className="studio-btn studio-btn-ghost studio-btn-sm"
        >
          Redactar otro
        </button>
      </div>
    </div>
  );
}

"use client";

/**
 * ConversationThread — hilo de una conversación (SDD-0056 · Fase 1).
 *
 * Header (cliente + canal + caso + MARKBOX link) + acciones (asignar · estado ·
 * marcar caso) + burbujas in/out + composer con quick replies + panel de
 * contexto del cliente. Carga mensajes + contexto lazy vía
 * /api/studio/conversaciones/[id]. Las mutaciones van por server actions
 * (useActionState) + toast de trazabilidad.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  assignAction,
  markCaseAction,
  sendReplyAction,
  setStatusAction,
} from "../actions";
import {
  QUICK_REPLIES,
  STATUS_OPTIONS,
  channelLabel,
  channelTone,
  relativeAge,
  statusLabel,
  statusTone,
  type ConversationActionState,
  type ConversationAgent,
  type ConversationClientContext,
  type ConversationMessage,
  type ConversationRow,
  type ConversationStatus,
} from "@/lib/studio/conversaciones/conversations-types";
import type { ConversationDigest } from "@/lib/studio/conversaciones/conversations-queries";

const EMPTY_STATE: ConversationActionState = {};

const selectStyle: React.CSSProperties = {
  height: 32,
  padding: "0 10px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-md)",
  font: "600 12px/1 var(--f-sans)",
  color: "var(--ink)",
  outline: "none",
  cursor: "pointer",
};

interface Props {
  conv: ConversationRow;
  agents: ConversationAgent[];
  /** Cambia en cada evento Realtime de conversation_messages del tenant (ver ConversacionesClient). */
  realtimeTick?: number;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** "YYYY-MM-DD" (primer día del mes) → "Julio de 2026". */
function fmtPeriod(iso: string): string {
  try {
    const s = new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("es-VE", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return iso;
  }
}

export function ConversationThread({ conv, agents, realtimeTick = 0 }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [context, setContext] = useState<ConversationClientContext | null>(null);
  const [digests, setDigests] = useState<ConversationDigest[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carga lazy del hilo + contexto al cambiar de conversación o al reenviar
  // (refreshToken) — sendReplyAction inserta el mensaje en el servidor pero
  // este componente no se remonta al enviar, así que sin este segundo
  // disparador la respuesta recién enviada queda invisible hasta cambiar de hilo.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/studio/conversaciones/${conv.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(
        (data: {
          messages: ConversationMessage[];
          context: ConversationClientContext | null;
          digests?: ConversationDigest[];
        }) => {
          if (cancelled) return;
          setMessages(data.messages ?? []);
          setContext(data.context ?? null);
          setDigests(data.digests ?? []);
        },
      )
      .catch(() => {
        if (!cancelled) {
          setMessages([]);
          setContext(null);
          setDigests([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conv.id, refreshToken, realtimeTick]);

  // Scroll al fondo cuando llegan mensajes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, loading]);

  // ── Server actions ──
  const [replyState, replyAction, replyPending] = useActionState(
    sendReplyAction,
    EMPTY_STATE,
  );
  const [, doStatus] = useActionState(setStatusAction, EMPTY_STATE);
  const [, doAssign] = useActionState(assignAction, EMPTY_STATE);
  const [, doCase] = useActionState(markCaseAction, EMPTY_STATE);
  const [handledReplyState, setHandledReplyState] = useState(replyState);
  if (handledReplyState !== replyState) {
    setHandledReplyState(replyState);
    if (replyState.ok) {
      setDraft("");
      setShowQuick(false);
      setRefreshToken((current) => current + 1);
    }
  }

  useEffect(() => {
    if (replyState.ok) {
      toast.success("Respuesta enviada");
      router.refresh();
    } else if (replyState.error) {
      toast.error(replyState.error);
    }
  }, [replyState, router, toast]);

  const submitReply = (formData: FormData) => {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    replyAction(formData);
  };

  const onChangeStatus = (status: ConversationStatus) => {
    const fd = new FormData();
    fd.set("conversation_id", conv.id);
    fd.set("status", status);
    doStatus(fd);
    toast.info(`Estado: ${statusLabel(status)}`);
  };

  const onChangeAssign = (assignedTo: string) => {
    const fd = new FormData();
    fd.set("conversation_id", conv.id);
    fd.set("assigned_to", assignedTo);
    doAssign(fd);
    toast.info(assignedTo ? "Conversación asignada" : "Conversación sin asignar");
  };

  const onToggleCase = () => {
    const next = !conv.is_case;
    const fd = new FormData();
    fd.set("conversation_id", conv.id);
    fd.set("is_case", String(next));
    doCase(fd);
    toast.info(next ? "Marcada como caso" : "Caso desmarcado");
  };

  const ch = conv.channel;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 250px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Columna principal: header + mensajes + composer */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ font: "900 16px/1.1 var(--f-display)", color: "var(--ink)" }}>
                {conv.client_name}
              </span>
              <Badge tone={channelTone(ch)} size="sm">
                {channelLabel(ch)}
              </Badge>
              {conv.is_case && (
                <Badge tone="danger" size="sm">
                  Caso
                </Badge>
              )}
              <Badge tone={statusTone(conv.status)} size="sm">
                {statusLabel(conv.status)}
              </Badge>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginTop: 5 }}>
              <Link
                href={`/studio/clientes?q=${encodeURIComponent(conv.markbox)}`}
                style={{ font: "600 11.5px/1 var(--f-mono)", color: "var(--wine-text)" }}
              >
                {conv.markbox}
              </Link>
              {conv.ref && (
                <>
                  <span style={{ color: "var(--ink-mute)" }}>·</span>
                  <code style={{ font: "500 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                    {conv.ref}
                  </code>
                </>
              )}
              <span style={{ color: "var(--ink-mute)" }}>·</span>
              <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
                {relativeAge(conv.last_message_at)}
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
            <button
              type="button"
              onClick={onToggleCase}
              title={conv.is_case ? "Quitar marca de caso" : "Marcar como caso"}
              aria-label={conv.is_case ? "Quitar marca de caso" : "Marcar como caso"}
              aria-pressed={conv.is_case}
              style={{
                height: 32,
                padding: "0 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                font: "600 12px/1 var(--f-sans)",
                background: conv.is_case ? "var(--danger-bg)" : "var(--bg-elevated)",
                color: conv.is_case ? "var(--danger)" : "var(--ink-soft)",
                border: `1px solid ${conv.is_case ? "var(--danger)" : "var(--border)"}`,
              }}
            >
              {Icon.warn(14)} Caso
            </button>
            <select
              value={conv.assigned_to ?? ""}
              onChange={(e) => onChangeAssign(e.target.value)}
              style={selectStyle}
              aria-label="Asignar agente"
            >
              <option value="">Sin asignar</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={conv.status}
              onChange={(e) => onChangeStatus(e.target.value as ConversationStatus)}
              style={selectStyle}
              aria-label="Estado de la conversación"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mensajes */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 18,
            background: "var(--bg-base)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-3)",
          }}
        >
          {loading && (
            <div
              style={{
                textAlign: "center",
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "auto",
              }}
            >
              Cargando hilo…
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                font: "500 12.5px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "auto",
              }}
            >
              Sin mensajes todavía.
            </div>
          )}
          {messages.map((m) => {
            const out = m.direction === "out";
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: out ? "flex-end" : "flex-start",
                  gap: 3,
                }}
              >
                <div
                  style={{
                    maxWidth: "74%",
                    padding: "10px 14px",
                    borderRadius: out
                      ? "var(--r-lg) var(--r-lg) var(--r-xs) var(--r-lg)"
                      : "var(--r-lg) var(--r-lg) var(--r-lg) var(--r-xs)",
                    background: out ? "var(--wine)" : "var(--bg-surface)",
                    border: out ? "none" : "1px solid var(--border)",
                    color: out ? "var(--ink-inv)" : "var(--ink)",
                    font: "500 13px/1.5 var(--f-sans)",
                    boxShadow: "var(--shadow-xs)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.body}
                </div>
                <div
                  style={{
                    font: "500 10px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    padding: "0 4px",
                  }}
                >
                  {out ? `${m.author_name ?? "Agente"} · ` : ""}
                  {fmtTime(m.sent_at)}
                  {!out ? ` · ${m.author_name ?? conv.client_name}` : ""}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick replies */}
        {showQuick && (
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {QUICK_REPLIES.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setDraft(q.text);
                  setShowQuick(false);
                }}
                title={q.text}
                style={{
                  padding: "6px 11px",
                  borderRadius: "var(--r-pill)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  font: "600 11.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          action={submitReply}
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <input type="hidden" name="conversation_id" value={conv.id} />
          <button
            type="button"
            onClick={() => setShowQuick((s) => !s)}
            title="Respuestas rápidas"
            aria-label="Respuestas rápidas"
            aria-expanded={showQuick}
            style={{
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: "var(--r-md)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: showQuick ? "var(--wine-tint)" : "var(--bg-elevated)",
              color: showQuick ? "var(--wine)" : "var(--ink-soft)",
              border: `1px solid ${showQuick ? "var(--wine)" : "var(--border)"}`,
            }}
          >
            {Icon.spark(16)}
          </button>
          <textarea
            name="body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Responder por ${channelLabel(ch)}…`}
            rows={1}
            disabled={replyPending}
            style={{
              flex: 1,
              resize: "none",
              minHeight: 38,
              maxHeight: 120,
              padding: "9px 12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              font: "500 13px/1.4 var(--f-sans)",
              color: "var(--ink)",
              outline: "none",
              opacity: replyPending ? 0.6 : 1,
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || replyPending}
            style={{
              height: 38,
              padding: "0 16px",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              borderRadius: "var(--r-md)",
              border: "none",
              cursor: !draft.trim() || replyPending ? "not-allowed" : "pointer",
              opacity: !draft.trim() || replyPending ? 0.55 : 1,
              background: "var(--wine)",
              color: "var(--ink-side-strong)",
              font: "700 13px/1 var(--f-sans)",
            }}
          >
            {Icon.arrowR(14)} {replyPending ? "Enviando…" : "Enviar"}
          </button>
        </form>
      </div>

      {/* Panel de contexto del cliente */}
      <ClientContextPanel
        context={context}
        loading={loading}
        clientName={conv.client_name}
        digests={digests}
      />
    </div>
  );
}

function ClientContextPanel({
  context,
  loading,
  clientName,
  digests,
}: {
  context: ConversationClientContext | null;
  loading: boolean;
  clientName: string;
  digests: ConversationDigest[];
}) {
  return (
    <aside
      style={{
        borderLeft: "1px solid var(--border)",
        background: "var(--bg-surface)",
        padding: "var(--s-4) var(--s-4)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-4)",
      }}
    >
      <div>
        <div
          style={{
            font: "700 9.5px/1 var(--f-sans)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            marginBottom: "var(--s-2)",
          }}
        >
          Cliente
        </div>
        <div style={{ font: "700 13.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
          {context?.client_name ?? clientName}
        </div>
        {context?.markbox && (
          <code style={{ font: "600 11px/1.4 var(--f-mono)", color: "var(--ink-soft)" }}>
            {context.markbox}
          </code>
        )}
        {context?.email && (
          <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: "var(--s-1)" }}>
            {context.email}
          </div>
        )}
        {context?.phone && (
          <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {context.phone}
          </div>
        )}
      </div>

      {/* Envíos activos */}
      <div>
        <div
          style={{
            font: "700 9.5px/1 var(--f-sans)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            marginBottom: "var(--s-2)",
          }}
        >
          Envíos activos
        </div>
        {loading ? (
          <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>—</span>
        ) : context && context.activeShipments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {context.activeShipments.map((s) => (
              <Link
                key={s.id}
                href={`/studio/tracking?q=${encodeURIComponent(s.code)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  font: "600 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {Icon.box(12)} {s.code}
              </Link>
            ))}
          </div>
        ) : (
          <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            Sin envíos en curso
          </span>
        )}
      </div>

      {/* Saldo CxC */}
      <div>
        <div
          style={{
            font: "700 9.5px/1 var(--f-sans)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            marginBottom: "var(--s-2)",
          }}
        >
          Saldo pendiente
        </div>
        {loading ? (
          <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>—</span>
        ) : (
          <Link
            href="/studio/cobranzas"
            style={{
              font: "800 18px/1 var(--f-display)",
              color:
                context && context.outstandingBalance > 0 ? "var(--danger)" : "var(--ink)",
              textDecoration: "none",
            }}
          >
            {context
              ? `${context.outstandingBalance.toLocaleString("es-VE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${context.outstandingCurrency}`
              : "—"}
          </Link>
        )}
        <div style={{ font: "500 10.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 3 }}>
          Ver en Cobranzas →
        </div>
      </div>

      {/* Historial de resúmenes mensuales (SDD-0149 · Fase 2). Solo lectura; cada
          uno con su período. Vacío hasta que el cron mensual genere el primero. */}
      {digests.length > 0 && (
        <div style={{ marginTop: "var(--s-4)", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              font: "700 10.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Historial de resúmenes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {digests.map((d) => (
              <div
                key={d.id}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "var(--s-2)",
                    marginBottom: 5,
                  }}
                >
                  <span style={{ font: "700 12px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                    {fmtPeriod(d.period)}
                  </span>
                  <span style={{ font: "500 10px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                    {d.messageCount} msg
                  </span>
                </div>
                <p
                  style={{
                    font: "500 11.5px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {d.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

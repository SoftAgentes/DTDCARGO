"use client";

/**
 * BugDrawer · drawer 720px con 3 tabs (Conversación · Técnicos · Acciones).
 * SDD-0036 Fase 3.
 *
 * Al abrirse fetcha el detalle completo (tech_data + messages + timeline)
 * via GET /api/studio/bugs/[id]. Server actions disparan onMutated() para
 * que el padre haga router.refresh().
 */

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  BUG_CATEGORY_LABELS,
  BUG_CATEGORY_TONES,
  BUG_SEVERITY_LABELS,
  BUG_STATE_LABELS,
  BUG_STATE_TONES,
  BUG_STATE_TRANSITIONS,
  type BugActionState,
  type BugAttachment,
  type BugMessage,
  type BugReport,
  type BugSeverity,
  type BugState,
  type BugTechData,
  type BugTimelineEvent,
} from "@/lib/studio/bug-types";
import { moduleLabelFromSlug } from "@/lib/studio/bug-module-name";
import { BugReplayPlayer } from "./BugReplayPlayer";
import {
  advanceBugStateAction,
  replyBugMessageAction,
  takeBugAction,
  updateBugAdminAction,
} from "../actions";
import type { ReporterProfile } from "../page";

interface Props {
  bug: BugReport;
  reporter: ReporterProfile | null;
  currentUserId: string;
  onClose: () => void;
  onMutated: () => void;
}

type Tab = "conv" | "tech" | "act";

type DetailData = {
  attachments: BugAttachment[];
  tech_data: BugTechData | null;
  messages: BugMessage[];
  timeline: BugTimelineEvent[];
};

const INITIAL_STATE: BugActionState = {};

const TONE_BG: Record<string, string> = {
  success: "var(--success-bg, #E5F4ED)",
  warning: "var(--warning-bg, #FBF1DF)",
  danger: "var(--danger-bg, #FCEDED)",
  info: "var(--info-bg, #E5EEF9)",
  wine: "var(--wine-tint, #FBE9EC)",
  neutral: "var(--neutral-bg, #F2F0EC)",
};

const TONE_FG: Record<string, string> = {
  success: "var(--success, #1F8A5B)",
  warning: "var(--warning, #B8893A)",
  danger: "var(--danger, #A8323E)",
  info: "var(--info, #2A6FDB)",
  wine: "var(--wine, #7F0F1A)",
  neutral: "var(--ink-soft, #6B6B6B)",
};

export function BugDrawer({
  bug,
  reporter,
  onClose,
  onMutated,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("conv");
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "ok" | "err">("idle");

  // Action states
  const [replyState, replyAction, replyPending] = useActionState<BugActionState, FormData>(
    replyBugMessageAction,
    INITIAL_STATE,
  );
  const [stateState, stateAction, statePending] = useActionState<BugActionState, FormData>(
    advanceBugStateAction,
    INITIAL_STATE,
  );
  const [takeState, takeAction, takePending] = useActionState<BugActionState, FormData>(
    takeBugAction,
    INITIAL_STATE,
  );
  const [updState, updAction, updPending] = useActionState<BugActionState, FormData>(
    updateBugAdminAction,
    INITIAL_STATE,
  );

  const anyPending = replyPending || statePending || takePending || updPending;

  const reloadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/studio/bugs/${bug.id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as {
        attachments: BugAttachment[];
        tech_data: BugTechData | null;
        messages: BugMessage[];
        timeline: BugTimelineEvent[];
      };
      setDetail({
        attachments: data.attachments,
        tech_data: data.tech_data,
        messages: data.messages,
        timeline: data.timeline,
      });
    } catch {
      setDetail({ attachments: [], tech_data: null, messages: [], timeline: [] });
    } finally {
      setLoading(false);
    }
  }, [bug.id]);

  useEffect(() => {
    reloadDetail();
  }, [reloadDetail]);

  // Reload + parent refresh after mutations
  useEffect(() => {
    if (replyState.ok || stateState.ok || takeState.ok || updState.ok) {
      reloadDetail();
      onMutated();
    }
  }, [replyState.ok, stateState.ok, takeState.ok, updState.ok, reloadDetail, onMutated]);

  const copyPrompt = async () => {
    setCopyStatus("copying");
    try {
      const res = await fetch(`/api/studio/bugs/${bug.id}/prompt`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { prompt: string };
      await navigator.clipboard.writeText(data.prompt);
      setCopyStatus("ok");
      window.setTimeout(() => setCopyStatus("idle"), 2400);
    } catch {
      setCopyStatus("err");
      window.setTimeout(() => setCopyStatus("idle"), 2400);
    }
  };

  const catTone = BUG_CATEGORY_TONES[bug.category];
  const stateTone = BUG_STATE_TONES[bug.state];
  const validNextStates = BUG_STATE_TRANSITIONS[bug.state];

  return (
    <DrawerShell
      title={bug.folio}
      subtitle={`${BUG_CATEGORY_LABELS[bug.category]} · ${moduleLabelFromSlug(bug.module)}`}
      onClose={onClose}
      pending={anyPending}
      width={720}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Top summary */}
        <div
          style={{
            padding: "16px 22px",
            background: "var(--bg-elevated, #F2F0EC)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Pill bg={TONE_BG[stateTone]} fg={TONE_FG[stateTone]}>
                {BUG_STATE_LABELS[bug.state]}
              </Pill>
              <Pill bg={TONE_BG[catTone]} fg={TONE_FG[catTone]}>
                {BUG_CATEGORY_LABELS[bug.category]}
              </Pill>
              {bug.severity && (
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  Severidad: <strong style={{ color: "var(--ink)" }}>{BUG_SEVERITY_LABELS[bug.severity]}</strong>
                </span>
              )}
              {bug.duplicate_count > 0 && (
                <Pill bg="var(--neutral-bg)" fg="var(--ink-soft)">
                  ×{bug.duplicate_count + 1} duplicados
                </Pill>
              )}
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--ink-soft)",
                fontSize: 11,
              }}
            >
              {bug.progress_pct}%
            </span>
          </div>
          <h3
            style={{
              margin: "4px 0 0",
              fontSize: 16,
              color: "var(--ink)",
              fontWeight: 600,
            }}
          >
            {bug.title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--ink-soft)",
            }}
          >
            Reportado por{" "}
            <strong style={{ color: "var(--ink)" }}>
              {reporter ? formatReporterName(reporter) : bug.reporter_id.slice(0, 8)}
            </strong>{" "}
            · {formatAbsoluteDate(bug.created_at)}
          </p>
        </div>

        {/* Tab strip */}
        <div
          role="tablist"
          style={{
            display: "flex",
            gap: 2,
            padding: "8px 22px 0",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          {(["conv", "tech", "act"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                color: tab === t ? "var(--wine)" : "var(--ink-soft)",
                borderBottom:
                  tab === t ? "2px solid var(--wine)" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: tab === t ? 600 : 500,
                marginBottom: -1,
              }}
            >
              {t === "conv" ? "Conversación" : t === "tech" ? "Datos técnicos" : "Acciones"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 22,
          }}
        >
          {tab === "conv" && (
            <ConversationTab
              bug={bug}
              messages={detail?.messages ?? []}
              loading={loading}
              replyAction={replyAction}
              replyState={replyState}
              replyPending={replyPending}
            />
          )}
          {tab === "tech" && (
            <TechTab
              bug={bug}
              tech={detail?.tech_data ?? null}
              attachments={detail?.attachments ?? []}
              loading={loading}
            />
          )}
          {tab === "act" && (
            <ActionsTab
              bug={bug}
              validNextStates={validNextStates}
              stateAction={stateAction}
              statePending={statePending}
              stateState={stateState}
              takeAction={takeAction}
              takePending={takePending}
              takeState={takeState}
              updAction={updAction}
              updPending={updPending}
              updState={updState}
              copyPrompt={copyPrompt}
              copyStatus={copyStatus}
            />
          )}
        </div>
      </div>
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Conversación tab
// ─────────────────────────────────────────────────────────────

function ConversationTab({
  bug,
  messages,
  loading,
  replyAction,
  replyState,
  replyPending,
}: {
  bug: BugReport;
  messages: BugMessage[];
  loading: boolean;
  replyAction: (formData: FormData) => void;
  replyState: BugActionState;
  replyPending: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Descripción original */}
      <section>
        <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
          Descripción original
        </h4>
        <div
          style={{
            padding: 14,
            background: "var(--bg-elevated, #F2F0EC)",
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--ink)",
            whiteSpace: "pre-wrap",
          }}
        >
          {bug.description}
        </div>
      </section>

      {/* Mensajes */}
      <section>
        <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
          Hilo ({messages.length})
        </h4>
        {loading ? (
          <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>Cargando…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: 13, padding: 12, background: "var(--bg-elevated)", borderRadius: 6 }}>
            Todavía nadie respondió. Sé el primero.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => (
              <li
                key={m.id}
                style={{
                  padding: "10px 14px",
                  background:
                    m.author_type === "admin"
                      ? "var(--wine-tint, #FBE9EC)"
                      : "var(--bg-elevated, #F2F0EC)",
                  borderLeft:
                    m.author_type === "admin"
                      ? "3px solid var(--wine, #7F0F1A)"
                      : "3px solid var(--ink-soft, #6B6B6B)",
                  borderRadius: 4,
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: "var(--ink)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--ink-soft)",
                    marginBottom: 4,
                  }}
                >
                  {m.author_type === "admin"
                    ? "Admin"
                    : m.author_type === "user"
                      ? "Reporter"
                      : "Sistema"}{" "}
                  · {formatAbsoluteDate(m.created_at)}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Composer */}
      <section>
        <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
          Responder
        </h4>
        <form action={replyAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input type="hidden" name="bug_id" value={bug.id} />
          <textarea
            name="body"
            required
            minLength={1}
            maxLength={4000}
            rows={4}
            placeholder="Escribe tu respuesta…"
            disabled={replyPending}
            style={{
              padding: 12,
              border: "1px solid var(--border, #E8E6E2)",
              borderRadius: 6,
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--ink)",
              background: "var(--bg-base)",
              outline: "none",
              resize: "vertical",
            }}
          />
          {replyState.error && (
            <span style={{ color: "var(--danger)", fontSize: 12 }}>{replyState.error}</span>
          )}
          {replyState.ok && (
            <span style={{ color: "var(--success, #1F8A5B)", fontSize: 12 }}>
              Mensaje enviado.
            </span>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="studio-btn studio-btn-primary studio-btn-sm"
              disabled={replyPending}
            >
              {replyPending ? "Enviando…" : "Enviar respuesta"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tech tab
// ─────────────────────────────────────────────────────────────

function TechTab({
  bug,
  tech,
  attachments,
  loading,
}: {
  bug: BugReport;
  tech: BugTechData | null;
  attachments: BugAttachment[];
  loading: boolean;
}) {
  if (loading) {
    return <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>Cargando datos técnicos…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section>
        <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
          Contexto
        </h4>
        <KvList
          items={[
            ["Módulo", moduleLabelFromSlug(bug.module)],
            ["URL", bug.url ?? "—"],
            ["Build", bug.build_sha ? bug.build_sha.slice(0, 12) : "—"],
            ["Folio", bug.folio],
          ]}
        />
      </section>

      {bug.browser_info && Object.keys(bug.browser_info).length > 0 && (
        <section>
          <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
            Browser info
          </h4>
          <CodeBlock value={JSON.stringify(bug.browser_info, null, 2)} />
        </section>
      )}

      {tech?.environment && Object.keys(tech.environment).length > 0 && (
        <section>
          <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
            Environment
          </h4>
          <CodeBlock value={JSON.stringify(tech.environment, null, 2)} />
        </section>
      )}

      {tech && tech.console_logs.length > 0 && (
        <section>
          <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
            Console logs ({tech.console_logs.length})
          </h4>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {tech.console_logs.map((log, i) => (
              <li
                key={i}
                style={{
                  padding: 10,
                  background: "var(--bg-elevated, #F2F0EC)",
                  borderLeft: `3px solid ${log.level === "error" ? "var(--danger)" : "var(--ink-soft)"}`,
                  borderRadius: 4,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12,
                  color: "var(--ink)",
                  overflowWrap: "anywhere",
                }}
              >
                <div style={{ color: "var(--ink-soft)", fontSize: 10, marginBottom: 4 }}>
                  [{log.level.toUpperCase()}] {log.ts}
                </div>
                <div>{log.message}</div>
                {log.stack && (
                  <pre style={{ margin: "6px 0 0", fontSize: 11, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>
                    {log.stack}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tech && tech.network_requests.length > 0 && (
        <section>
          <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
            Network requests ({tech.network_requests.length})
          </h4>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--ink-soft)" }}>Method</th>
                  <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--ink-soft)" }}>URL</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-soft)" }}>Status</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-soft)" }}>ms</th>
                </tr>
              </thead>
              <tbody>
                {tech.network_requests.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px", color: "var(--ink)" }}>{r.method}</td>
                    <td style={{ padding: "6px 8px", color: "var(--ink)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.url}>{r.url}</td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        color: r.status >= 400 ? "var(--danger)" : "var(--ink)",
                        fontWeight: r.status >= 400 ? 700 : 500,
                      }}
                    >
                      {r.status}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-soft)" }}>{r.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tech?.session_replay_url && (
        <section>
          <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
            Session replay
          </h4>
          <BugReplayPlayer bugId={bug.id} />
        </section>
      )}

      {attachments.length > 0 && (
        <section>
          <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
            Adjuntos ({attachments.length})
          </h4>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {attachments.map((a) => (
              <li key={a.id} style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                {a.storage_path} · {(a.size_bytes / 1024).toFixed(1)}KB · {a.mime_type}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!tech || (
        tech.console_logs.length === 0 &&
        tech.network_requests.length === 0 &&
        !tech.session_replay_url
      ) && (
        <p style={{ color: "var(--ink-soft)", fontSize: 13, fontStyle: "italic" }}>
          Sin captura técnica · Fase 4 implementará rrweb + console + network sanitizer.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Actions tab
// ─────────────────────────────────────────────────────────────

function ActionsTab({
  bug,
  validNextStates,
  stateAction,
  statePending,
  stateState,
  takeAction,
  takePending,
  takeState,
  updAction,
  updPending,
  updState,
  copyPrompt,
  copyStatus,
}: {
  bug: BugReport;
  validNextStates: BugState[];
  stateAction: (formData: FormData) => void;
  statePending: boolean;
  stateState: BugActionState;
  takeAction: (formData: FormData) => void;
  takePending: boolean;
  takeState: BugActionState;
  updAction: (formData: FormData) => void;
  updPending: boolean;
  updState: BugActionState;
  copyPrompt: () => void;
  copyStatus: "idle" | "copying" | "ok" | "err";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Take + state transitions */}
      <section>
        <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
          Estado actual: {BUG_STATE_LABELS[bug.state]}
        </h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {bug.state === "nuevo" && (
            <form action={takeAction} style={{ display: "inline" }}>
              <input type="hidden" name="bug_id" value={bug.id} />
              <button
                type="submit"
                className="studio-btn studio-btn-primary studio-btn-sm"
                disabled={takePending}
              >
                {takePending ? "Tomando…" : "Tomar bug"}
              </button>
            </form>
          )}
          {validNextStates.length > 0 ? (
            validNextStates.map((target) => (
              <form key={target} action={stateAction} style={{ display: "inline" }}>
                <input type="hidden" name="bug_id" value={bug.id} />
                <input type="hidden" name="new_state" value={target} />
                <button
                  type="submit"
                  className={
                    target === "resuelto"
                      ? "studio-btn studio-btn-primary studio-btn-sm"
                      : target === "descartado"
                        ? "studio-btn studio-btn-danger studio-btn-sm"
                        : "studio-btn studio-btn-ghost studio-btn-sm"
                  }
                  disabled={statePending}
                >
                  {statePending ? "…" : `→ ${BUG_STATE_LABELS[target]}`}
                </button>
              </form>
            ))
          ) : (
            <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
              Estado terminal · no hay más transiciones.
            </span>
          )}
        </div>
        {(stateState.error || takeState.error) && (
          <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>
            {stateState.error || takeState.error}
          </p>
        )}
      </section>

      {/* Copiar prompt Claude Code */}
      <section>
        <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
          Claude Code
        </h4>
        <button
          type="button"
          onClick={copyPrompt}
          disabled={copyStatus === "copying"}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ minWidth: 200 }}
        >
          {copyStatus === "copying" && "Generando…"}
          {copyStatus === "ok" && "✓ Copiado al clipboard"}
          {copyStatus === "err" && "Error · reintenta"}
          {copyStatus === "idle" && "Copiar prompt para Claude Code"}
        </button>
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--ink-soft)" }}>
          Pega el prompt en Claude Code (otra ventana), revisa el fix que te propone
          y aplícalo tú. Cuando lo commitees usa{" "}
          <code style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--wine)" }}>
            fix: {bug.folio}
          </code>{" "}
          como convención de trazabilidad. <strong>Después</strong> cambia el estado a
          “Resuelto” a mano desde acá — no hay cierre automático.
        </p>
      </section>

      {/* Editable admin fields */}
      <section>
        <h4 className="studio-eyebrow" style={{ fontSize: 11, margin: "0 0 8px", color: "var(--ink-soft)" }}>
          Campos editables
        </h4>
        <form
          action={updAction}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input type="hidden" name="bug_id" value={bug.id} />

          {/* Severity (solo si categoría error) */}
          {bug.category === "error" && (
            <FormField label="Severidad">
              <select
                name="severity"
                defaultValue={bug.severity ?? ""}
                disabled={updPending}
                style={inputStyle()}
              >
                <option value="">— sin severidad —</option>
                {(["baja", "media", "alta", "critica"] as BugSeverity[]).map((s) => (
                  <option key={s} value={s}>
                    {BUG_SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
              {updState.fieldErrors?.severity && (
                <span style={{ color: "var(--danger)", fontSize: 12 }}>
                  {updState.fieldErrors.severity}
                </span>
              )}
            </FormField>
          )}

          <FormField label="ETA (días)">
            <input
              type="number"
              name="eta_days"
              min={0}
              max={365}
              defaultValue={bug.eta_days ?? ""}
              placeholder="ej. 3"
              disabled={updPending}
              style={inputStyle()}
            />
            {updState.fieldErrors?.eta_days && (
              <span style={{ color: "var(--danger)", fontSize: 12 }}>
                {updState.fieldErrors.eta_days}
              </span>
            )}
          </FormField>

          <FormField label="Commit URL">
            <input
              type="url"
              name="commit_url"
              defaultValue={bug.commit_url ?? ""}
              placeholder="https://github.com/…"
              disabled={updPending}
              style={inputStyle()}
            />
            {updState.fieldErrors?.commit_url && (
              <span style={{ color: "var(--danger)", fontSize: 12 }}>
                {updState.fieldErrors.commit_url}
              </span>
            )}
          </FormField>

          <FormField label="Mensaje de agradecimiento (opcional)">
            <textarea
              name="admin_thanks"
              defaultValue={bug.admin_thanks ?? ""}
              rows={3}
              maxLength={1000}
              placeholder="Gracias por reportarlo · ya está resuelto…"
              disabled={updPending}
              style={{ ...inputStyle(), resize: "vertical", minHeight: 60 }}
            />
          </FormField>

          {updState.error && (
            <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{updState.error}</p>
          )}
          {updState.ok && (
            <p style={{ color: "var(--success, #1F8A5B)", fontSize: 12, margin: 0 }}>
              Guardado.
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="submit"
              className="studio-btn studio-btn-primary studio-btn-sm"
              disabled={updPending}
            >
              {updPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    height: 36,
    padding: "0 10px",
    border: "1px solid var(--border, #E8E6E2)",
    borderRadius: 6,
    background: "var(--bg-base)",
    color: "var(--ink)",
    fontFamily: "inherit",
    fontSize: 13,
    outline: "none",
  };
}

function Pill({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        background: bg,
        color: fg,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function KvList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl
      style={{
        margin: 0,
        display: "grid",
        gridTemplateColumns: "minmax(80px, auto) 1fr",
        gap: "6px 16px",
        padding: 12,
        background: "var(--bg-elevated, #F2F0EC)",
        borderRadius: 6,
      }}
    >
      {items.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-soft)",
            }}
          >
            {k}
          </dt>
          <dd
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--ink)",
              fontFamily: "var(--font-mono, monospace)",
              overflowWrap: "anywhere",
            }}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        background: "var(--ink, #0F1E3D)",
        color: "var(--ink-inv, #FBFAF7)",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "var(--font-mono, monospace)",
        overflow: "auto",
        maxHeight: 240,
      }}
    >
      {value}
    </pre>
  );
}

function formatReporterName(p: ReporterProfile): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || p.user_id.slice(0, 8);
}

function formatAbsoluteDate(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

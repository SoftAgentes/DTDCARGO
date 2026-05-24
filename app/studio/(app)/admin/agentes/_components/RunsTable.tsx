"use client";

/**
 * RunsTable + RunDetailModal · SDD-0020 Fase 2D.3
 *
 * Tabla de historial de runs con detalle on-click. Client component
 * porque mantenemos state del modal (run seleccionado) — el data se
 * fetcha server-side y pasa como prop (no refresh sin recargar página).
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  formatCostUsd,
  formatLatency,
  formatTokens,
  runStatusBadgeTone,
  runStatusLabel,
  triggerLabel,
  type AgentRunWithAgent,
} from "@/lib/studio/agent-types";

export function RunsTable({ runs }: { runs: AgentRunWithAgent[] }) {
  const [selected, setSelected] = useState<AgentRunWithAgent | null>(null);

  return (
    <>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            font: "500 13px/1.4 var(--f-sans)",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--bg-elevated)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <Th>Cuándo</Th>
              <Th>Agente</Th>
              <Th>Trigger</Th>
              <Th>Status</Th>
              <Th align="right">Tokens</Th>
              <Th align="right">Costo</Th>
              <Th align="right">Latencia</Th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r, idx) => {
              const tone = runStatusBadgeTone(r.status);
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "background var(--dur-fast) var(--ease)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Td>
                    <span
                      style={{
                        font: "500 12px/1.3 var(--f-mono)",
                        color: "var(--ink)",
                      }}
                    >
                      {formatRelativeOrDate(r.created_at)}
                    </span>
                  </Td>
                  <Td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span
                        style={{
                          font: "600 13px/1.3 var(--f-sans)",
                          color: "var(--ink)",
                        }}
                      >
                        {r.agent?.name ?? "—"}
                      </span>
                      <span
                        style={{
                          font: "500 11px/1 var(--f-mono)",
                          color: "var(--ink-mute)",
                        }}
                      >
                        {r.agent?.slug ?? "—"}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span style={{ color: "var(--ink-soft)" }}>
                      {triggerLabel(r.trigger)}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={tone} size="sm">
                      {runStatusLabel(r.status)}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <span style={{ font: "500 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                      {formatTokens(r.tokens_in)}↘ {formatTokens(r.tokens_out)}↗
                    </span>
                  </Td>
                  <Td align="right">
                    <span style={{ font: "600 13px/1 var(--f-mono)", color: "var(--ink)" }}>
                      {formatCostUsd(r.cost_usd)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span style={{ font: "500 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                      {formatLatency(r.latency_ms)}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <RunDetailModal
          run={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function RunDetailModal({
  run,
  onClose,
}: {
  run: AgentRunWithAgent;
  onClose: () => void;
}) {
  const tone = runStatusBadgeTone(run.status);
  const message =
    typeof run.output?.message === "string"
      ? run.output.message
      : run.output
        ? JSON.stringify(run.output, null, 2)
        : null;
  const citations =
    Array.isArray(run.output?.citations) ? (run.output!.citations as string[]) : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-pop)",
          width: "100%",
          maxWidth: 760,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="studio-eyebrow"
              style={{ color: "var(--wine)", marginBottom: 4 }}
            >
              Run · {triggerLabel(run.trigger)}
              {run.trigger_source ? ` · ${run.trigger_source}` : ""}
            </div>
            <div
              className="studio-display"
              style={{
                fontSize: 17,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                marginBottom: 4,
              }}
            >
              {run.agent?.name ?? "Agent eliminado"}
            </div>
            <div
              style={{
                font: "500 11px/1 var(--f-mono)",
                color: "var(--ink-mute)",
              }}
            >
              {run.agent?.slug} · {new Date(run.created_at).toLocaleString("es-VE")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge tone={tone} size="md">
              {runStatusLabel(run.status)}
            </Badge>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="studio-btn studio-btn-ghost studio-btn-xs"
            >
              Cerrar
            </button>
          </div>
        </header>

        {/* Stats strip */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <Stat label="Tokens in" value={formatTokens(run.tokens_in)} mono />
          <Stat label="Tokens out" value={formatTokens(run.tokens_out)} mono />
          <Stat label="Costo" value={formatCostUsd(run.cost_usd)} mono />
          <Stat label="Latencia" value={formatLatency(run.latency_ms)} mono />
          <Stat
            label="Tool calls"
            value={String(run.tool_calls?.length ?? 0)}
            mono
          />
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {run.error && (
            <Section title="Error">
              <pre
                role="alert"
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  background: "var(--danger-bg)",
                  border: "1px solid var(--danger)",
                  borderRadius: "var(--r-sm)",
                  color: "var(--danger)",
                  font: "500 12px/1.4 var(--f-mono)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {run.error}
              </pre>
            </Section>
          )}

          <Section title="Input">
            <CodeBlock>{JSON.stringify(run.input, null, 2)}</CodeBlock>
          </Section>

          {message && (
            <Section title="Output">
              <div
                style={{
                  font: "400 13px/1.5 var(--f-sans)",
                  color: "var(--ink)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {message}
              </div>
              {citations.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    font: "500 11px/1.4 var(--f-mono)",
                    color: "var(--ink-mute)",
                  }}
                >
                  Fuentes: {citations.join(" · ")}
                </div>
              )}
            </Section>
          )}

          {run.tool_calls && run.tool_calls.length > 0 && (
            <Section title={`Tool calls (${run.tool_calls.length})`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {run.tool_calls.map((tc, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--r-sm)",
                      border: tc.error
                        ? "1px solid var(--danger)"
                        : "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                        gap: 8,
                      }}
                    >
                      <code
                        style={{
                          font: "700 12px/1 var(--f-mono)",
                          color: tc.error ? "var(--danger)" : "var(--ink)",
                        }}
                      >
                        {tc.tool_key}
                      </code>
                      {tc.latency_ms !== undefined && (
                        <span
                          style={{
                            font: "500 11px/1 var(--f-mono)",
                            color: "var(--ink-mute)",
                          }}
                        >
                          {formatLatency(tc.latency_ms)}
                        </span>
                      )}
                    </div>
                    <CodeBlock small>
                      {JSON.stringify(
                        tc.error ? { input: tc.input, error: tc.error } : { input: tc.input, output: tc.output },
                        null,
                        2,
                      )}
                    </CodeBlock>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {run.output && !message && (
            <Section title="Output (raw)">
              <CodeBlock>{JSON.stringify(run.output, null, 2)}</CodeBlock>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers UI ─────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-mute)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function CodeBlock({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: small ? "8px 10px" : "12px 14px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-sm)",
        font: small
          ? "500 11px/1.4 var(--f-mono)"
          : "500 12px/1.4 var(--f-mono)",
        color: "var(--ink-soft)",
        maxHeight: 280,
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {children}
    </pre>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          font: "700 9px/1 var(--f-sans)",
          color: "var(--ink-mute)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: mono ? "700 13px/1 var(--f-mono)" : "700 13px/1 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 14px",
        font: "700 10px/1 var(--f-sans)",
        color: "var(--ink-mute)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "12px 14px",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

// ─── Helpers de fecha ───────────────────────────────────────

function formatRelativeOrDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "hace <1m";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  // > 24h → fecha corta
  return date.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

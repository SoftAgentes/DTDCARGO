"use client";

/**
 * RunAgentModal · SDD-0020 Fase 2D.1
 *
 * Modal simple para ejecutar un agente manualmente. UI:
 *  - Textarea JSON con un ejemplo default según skill
 *  - Botón "Ejecutar" → POST /api/studio/agents/run
 *  - Muestra resultado (output + tool_calls + tokens + cost + latency)
 *  - O error si HTTP != 200
 *
 * No usa DrawerShell — es un modal centrado más liviano, apropiado para
 * un flujo ad-hoc de testing manual. La versión "drawer pro" llega
 * cuando aparezcan más patrones de input por skill (Fase 2D.2+).
 */

import { useState } from "react";

interface RunResponse {
  run_id: string;
  status: string;
  output: Record<string, unknown> | null;
  tool_calls: Array<{
    tool_key: string;
    input: unknown;
    output?: unknown;
    error?: string;
    latency_ms?: number;
  }>;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
}

const DEFAULT_INPUT = JSON.stringify(
  { query: "¿dónde está mi pedido S-2026-0001?" },
  null,
  2,
);

export function RunAgentModal({
  agentId,
  agentName,
  onClose,
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
}) {
  const [inputJson, setInputJson] = useState(DEFAULT_INPUT);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(inputJson);
    } catch (e) {
      setError(
        `Input no es JSON válido: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/studio/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          trigger: "manual",
          trigger_source: "studio-ui",
          idempotency_key: `manual:${Date.now()}`,
          input: parsed,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
      } else {
        setResult(body as RunResponse);
      }
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPending(false);
    }
  };

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
          maxWidth: 720,
          maxHeight: "85vh",
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
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              className="studio-eyebrow"
              style={{ color: "var(--wine)", marginBottom: 4 }}
            >
              Ejecutar manualmente
            </div>
            <div
              className="studio-display"
              style={{
                fontSize: 16,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
              }}
            >
              {agentName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="studio-btn studio-btn-ghost studio-btn-xs"
          >
            Cerrar
          </button>
        </header>

        {/* Body: input + result */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <label className="studio-label" htmlFor="run-input">
              Input (JSON)
            </label>
            <textarea
              id="run-input"
              className="studio-input studio-input-mono"
              rows={6}
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              style={{ resize: "vertical", minHeight: 100 }}
              spellCheck={false}
            />
            <p
              style={{
                font: "400 11px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: "4px 0 0",
              }}
            >
              Para Tracking Concierge: <code style={{ fontFamily: "var(--f-mono)" }}>{`{"query": "..."}`}</code>{" "}
              con código S-YYYY-NNNN o MARKBOX DTD-NNNN dentro.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: "10px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
                color: "var(--danger)",
                font: "500 12px/1.4 var(--f-sans)",
              }}
            >
              {error}
            </div>
          )}

          {result && <RunResultView result={result} />}
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="studio-btn studio-btn-ghost studio-btn-sm"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="studio-btn studio-btn-primary studio-btn-sm"
          >
            {pending ? "Ejecutando…" : "Ejecutar"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function RunResultView({ result }: { result: RunResponse }) {
  const message =
    typeof result.output?.message === "string"
      ? result.output.message
      : JSON.stringify(result.output, null, 2);
  const citations = Array.isArray(result.output?.citations)
    ? (result.output.citations as string[])
    : [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "14px 16px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "baseline",
          paddingBottom: 8,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Stat label="Status" value={result.status} />
        <Stat
          label="Latencia"
          value={`${result.latency_ms}ms`}
          mono
        />
        <Stat
          label="Tokens"
          value={`${result.tokens_in}↘ ${result.tokens_out}↗`}
          mono
        />
        <Stat
          label="Costo"
          value={`$${result.cost_usd.toFixed(4)}`}
          mono
        />
        <Stat
          label="Tool calls"
          value={String(result.tool_calls.length)}
          mono
        />
      </div>

      <div>
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--ink-mute)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Respuesta
        </div>
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
              marginTop: 8,
              font: "500 11px/1.4 var(--f-mono)",
              color: "var(--ink-mute)",
            }}
          >
            Fuentes: {citations.join(" · ")}
          </div>
        )}
      </div>

      {result.tool_calls.length > 0 && (
        <details>
          <summary
            style={{
              cursor: "pointer",
              font: "600 11px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.04em",
            }}
          >
            Ver tool calls ({result.tool_calls.length})
          </summary>
          <pre
            style={{
              marginTop: 8,
              padding: "10px 12px",
              background: "var(--bg-surface)",
              borderRadius: "var(--r-sm)",
              font: "500 11px/1.4 var(--f-mono)",
              color: "var(--ink-soft)",
              maxHeight: 220,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {JSON.stringify(result.tool_calls, null, 2)}
          </pre>
        </details>
      )}
    </div>
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
          font: mono
            ? "700 13px/1 var(--f-mono)"
            : "700 13px/1 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

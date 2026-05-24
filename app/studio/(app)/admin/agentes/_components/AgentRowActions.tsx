"use client";

/**
 * AgentRowActions · SDD-0020 Fase 2D.1
 *
 * Botones inline en cada row de la tabla Instalados:
 *  - Activar / Pausar / Apagar (toggleAgentStatusAction)
 *  - Ejecutar ahora (abre RunAgentModal — solo si status='active')
 *
 * Optimistic UI: no hace state local del status — confía en el
 * revalidatePath del action para refrescar la tabla server-rendered.
 */

import { useState, useTransition } from "react";
import { toggleAgentStatusAction } from "../actions";
import type { AgentStatus } from "@/lib/studio/agent-types";
import { RunAgentModal } from "./RunAgentModal";

export function AgentRowActions({
  agentId,
  agentName,
  currentStatus,
}: {
  agentId: string;
  agentName: string;
  currentStatus: AgentStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [runOpen, setRunOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStatus = (next: AgentStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleAgentStatusAction(agentId, next);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      {currentStatus !== "active" && (
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-xs"
          onClick={() => setStatus("active")}
          disabled={pending}
          title="Pasar a status 'active' — habilita ejecutar runs"
        >
          Activar
        </button>
      )}
      {currentStatus === "active" && (
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-xs"
          onClick={() => setStatus("paused")}
          disabled={pending}
          title="Pasar a status 'paused'"
        >
          Pausar
        </button>
      )}
      {currentStatus !== "off" && (
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-xs"
          onClick={() => setStatus("off")}
          disabled={pending}
          title="Pasar a status 'off'"
        >
          Apagar
        </button>
      )}
      {currentStatus === "active" && (
        <button
          type="button"
          className="studio-btn studio-btn-dark studio-btn-xs"
          onClick={() => setRunOpen(true)}
          disabled={pending}
          title="Ejecutar el agente con input manual"
        >
          Ejecutar ↗
        </button>
      )}

      {error && (
        <span
          role="alert"
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--danger)",
            marginLeft: 6,
          }}
        >
          {error}
        </span>
      )}

      {runOpen && (
        <RunAgentModal
          agentId={agentId}
          agentName={agentName}
          onClose={() => setRunOpen(false)}
        />
      )}
    </div>
  );
}

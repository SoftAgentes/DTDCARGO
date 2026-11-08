"use client";

/**
 * ConversacionesClient — orquestador de la bandeja (SDD-0056 · Fase 1).
 *
 * KPIs + grid 360px|1fr (lista | hilo). Realtime: se subscribe a
 * conversation_messages + conversations del tenant y refresca server data
 * (joins/preview/KPIs consistentes sin replicarlos en el client).
 * El detalle del hilo (mensajes + contexto) se carga lazy al seleccionar.
 */

import { useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { RealtimeIndicator } from "@/app/studio/_components/ui/RealtimeIndicator";
import { useRealtimeRefresh } from "@/lib/studio/hooks/use-realtime-refresh";
import { Icon } from "@/app/studio/_components/icons";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import {
  filterConversations,
  type ConversationAgent,
  type ConversationChannelFilter,
  type ConversationKpis,
  type ConversationRow,
  type ConversationStatusFilter,
} from "@/lib/studio/conversaciones/conversations-types";
import type { EstadoTrabaPortal } from "@/lib/studio/chatwoot/portal-solo-lectura";

interface Props {
  conversations: ConversationRow[];
  kpis: ConversationKpis;
  agents: ConversationAgent[];
  tenantId: string | null;
  /** Deep-link (SDD-0148 #1): hilo a preseleccionar (viene de `?c=<id>`). */
  initialSelectedId?: string | null;
  /** SDD-0586 1c-1: traba de los hilos del portal en el tenant (la calcula la page). */
  trabaPortal?: EstadoTrabaPortal;
}

export function ConversacionesClient({
  conversations,
  kpis,
  agents,
  tenantId,
  initialSelectedId = null,
  trabaPortal = "apagada",
}: Props) {
  // Realtime: cualquier cambio en mensajes o hilos del tenant → refresh server.
  // msgTick además repuebla el hilo abierto (ConversationThread mantiene su
  // propio state de mensajes — el router.refresh() del hook no lo alcanza).
  const [msgTick, setMsgTick] = useState(0);
  const msgRealtime = useRealtimeRefresh({
    table: "conversation_messages",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    disabled: !tenantId,
    onChange: () => setMsgTick((t) => t + 1),
  });
  useRealtimeRefresh({
    table: "conversations",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    disabled: !tenantId,
  });

  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("todos");
  const [channelFilter, setChannelFilter] = useState<ConversationChannelFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    // Deep-link primero (si el hilo existe en la lista), si no el primero.
    (initialSelectedId && conversations.some((c) => c.id === initialSelectedId)
      ? initialSelectedId
      : conversations[0]?.id) ?? null,
  );

  const filtered = useMemo(
    () =>
      filterConversations(conversations, {
        status: statusFilter,
        channel: channelFilter,
        search,
      }),
    [conversations, statusFilter, channelFilter, search],
  );

  // Si el seleccionado dejó de existir (refresh/filtro), caer al primero visible.
  useEffect(() => {
    if (selectedId && conversations.some((c) => c.id === selectedId)) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setSelectedId(filtered[0]?.id ?? conversations[0]?.id ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [conversations, filtered, selectedId]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  return (
    <div>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard
          label="Abiertas"
          value={kpis.open}
          sub={`${kpis.unread} mensaje${kpis.unread === 1 ? "" : "s"} sin leer`}
          valueColor={kpis.open > 0 ? "var(--warning)" : "var(--ink)"}
        />
        <KpiCard
          label="Sin asignar"
          value={kpis.unassigned}
          sub="requieren agente"
          valueColor={kpis.unassigned > 0 ? "var(--danger)" : "var(--success)"}
        />
        <KpiCard
          label="Casos abiertos"
          value={kpis.openCases}
          sub="prioridad alta"
          valueColor={kpis.openCases > 0 ? "var(--danger)" : "var(--ink)"}
        />
        <KpiCard
          label="Resueltas hoy"
          value={kpis.resolvedToday}
          sub="cerradas con cliente"
          valueColor={kpis.resolvedToday > 0 ? "var(--success)" : "var(--ink)"}
        />
      </div>

      {/* Indicador realtime */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <RealtimeIndicator status={msgRealtime.status} />
      </div>

      {/* Bandeja */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: "var(--s-4)",
          alignItems: "stretch",
          height: "calc(100vh - 380px)",
          minHeight: 480,
        }}
      >
        <ConversationList
          list={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          channelFilter={channelFilter}
          setChannelFilter={setChannelFilter}
          search={search}
          setSearch={setSearch}
        />
        {selected ? (
          <ConversationThread
            key={selected.id}
            conv={selected}
            agents={agents}
            realtimeTick={msgTick}
            trabaPortal={trabaPortal}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
            }}
          >
            <EmptyState
              eyebrow="Bandeja"
              title="Sin conversación seleccionada"
              description="Elige una conversación de la lista para ver el hilo completo. Cuando un cliente escriba desde el portal, aparecerá acá."
              action={<span style={{ color: "var(--ink-mute)" }}>{Icon.mail(22)}</span>}
            />
          </div>
        )}
      </div>
    </div>
  );
}

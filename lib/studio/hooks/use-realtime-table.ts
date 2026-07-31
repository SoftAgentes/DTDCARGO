"use client";

/**
 * Hook genérico para subscribir a cambios realtime de una tabla Postgres.
 *
 * Implementa el bridge approach decidido en memoria
 * [[bridge-approach-supabase-realtime]] (2026-05-27): Supabase Realtime
 * vs polling vs SSE.
 *
 * Uso:
 *
 * ```ts
 * const { data, status } = useRealtimeTable<DispatchOrder>({
 *   table: "dispatch_orders",
 *   filter: `tenant_id=eq.${tenantId}`,
 *   initial: serverOds,
 * });
 * ```
 *
 * Supabase Realtime soporta UN solo filter `column=op.value` por subscribe.
 * Para sub-filtros (status, hub) filtrar client-side en el caller con
 * `useMemo` sobre `data`.
 *
 * El initial fetch lo hace el server component que pasa `initial`. Cuando
 * `initial` cambia (router.refresh), el hook re-syncea su state.
 *
 * RLS se respeta automáticamente: el cliente solo recibe payloads de rows
 * que las policies permiten leer.
 */

import { useEffect, useEffectEvent, useState } from "react";
import { createClient } from "@/lib/db/client";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "closed";

interface UseRealtimeTableOptions<T> {
  /** Nombre de la tabla en public schema (ej: "dispatch_orders"). */
  table: string;
  /**
   * Filter Postgres realtime · formato `column=op.value`. Ejemplos:
   *   - `tenant_id=eq.uuid-xxx`
   *   - `od_id=eq.uuid-yyy`
   *   - `status=neq.cerrada`
   *
   * Si querés combinar múltiples filtros (ej: tenant + hub), aplicá el
   * segundo client-side con `useMemo` sobre `data`.
   */
  filter?: string;
  /** Data inicial (typically del server component). */
  initial: T[];
  /**
   * Si true, no se subscribe al channel. Útil cuando el componente padre
   * no tiene aún los datos necesarios (ej: tenantId todavía null).
   */
  disabled?: boolean;
}

interface UseRealtimeTableResult<T> {
  data: T[];
  status: RealtimeStatus;
}

export function useRealtimeTable<T extends { id: string }>({
  table,
  filter,
  initial,
  disabled = false,
}: UseRealtimeTableOptions<T>): UseRealtimeTableResult<T> {
  const subscriptionKey = disabled ? null : `${table}-${filter ?? "all"}`;
  const [snapshot, setSnapshot] = useState<{ source: T[]; data: T[] }>(() => ({
    source: initial,
    data: initial,
  }));
  if (snapshot.source !== initial) {
    setSnapshot({ source: initial, data: initial });
  }
  const data = snapshot.source === initial ? snapshot.data : initial;
  const [connection, setConnection] = useState<{
    key: string | null;
    status: RealtimeStatus;
  }>(() => ({
    key: subscriptionKey,
    status: subscriptionKey ? "connecting" : "idle",
  }));
  if (connection.key !== subscriptionKey) {
    setConnection({
      key: subscriptionKey,
      status: subscriptionKey ? "connecting" : "idle",
    });
  }
  const status =
    connection.key === subscriptionKey
      ? connection.status
      : subscriptionKey
        ? "connecting"
        : "idle";
  const applyChange = useEffectEvent((payload: PgChangePayload<T>) => {
    setSnapshot((current) => {
      const currentData = current.source === initial ? current.data : initial;
      return {
        source: initial,
        data: applyPayload(currentData, payload),
      };
    });
  });

  useEffect(() => {
    if (!subscriptionKey) return;

    const supabase = createClient();

    const channel = supabase
      .channel(subscriptionKey)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          applyChange(payload as unknown as PgChangePayload<T>);
        },
      )
      .subscribe((subStatus) => {
        if (subStatus === "SUBSCRIBED")
          setConnection({ key: subscriptionKey, status: "connected" });
        else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT")
          setConnection({ key: subscriptionKey, status: "error" });
        else if (subStatus === "CLOSED")
          setConnection({ key: subscriptionKey, status: "closed" });
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [table, filter, subscriptionKey]);

  return { data, status };
}

// ─────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────

type PgChangePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | Record<string, never>;
  old: T | Record<string, never>;
};

function applyPayload<T extends { id: string }>(
  current: T[],
  payload: PgChangePayload<T>,
): T[] {
  switch (payload.eventType) {
    case "INSERT":
    case "UPDATE": {
      const row = payload.new as T;
      if (!row || !row.id) return current;
      const idx = current.findIndex((r) => r.id === row.id);
      if (idx >= 0) {
        const next = [...current];
        next[idx] = row;
        return next;
      }
      return [row, ...current];
    }
    case "DELETE": {
      // payload.old en DELETE solo trae PKs (id). Suficiente para filter.
      const old = payload.old as Partial<T>;
      if (!old.id) return current;
      return current.filter((r) => r.id !== old.id);
    }
    default:
      return current;
  }
}

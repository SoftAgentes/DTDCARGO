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

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  const [data, setData] = useState<T[]>(initial);
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Cuando el server refresca y pasa nuevo `initial`, lo absorbemos.
  // (Comparación por reference: el server siempre devuelve array nuevo).
  useEffect(() => {
    setData(initial);
  }, [initial]);

  useEffect(() => {
    if (disabled) return;

    const supabase = createClient();
    setStatus("connecting");

    const channelName = `${table}-${filter ?? "all"}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          setData((current) =>
            applyPayload<T>(current, payload as unknown as PgChangePayload<T>),
          );
        },
      )
      .subscribe((subStatus) => {
        if (subStatus === "SUBSCRIBED") setStatus("connected");
        else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT")
          setStatus("error");
        else if (subStatus === "CLOSED") setStatus("closed");
      });

    channelRef.current = channel;

    return () => {
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [table, filter, disabled]);

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

"use client";

/**
 * useRealtimeRefresh — subscribe a Realtime + trigger router.refresh()
 *
 * Pattern "Realtime ligero" (memoria [[bridge-approach-supabase-realtime]]):
 * Realtime nos avisa que algo cambió, Next re-fetcha server data fresh.
 * Ventaja: joins/scoring/aggregaciones se mantienen consistentes sin
 * tener que replicarlas en el client.
 *
 * Trade-off: 1 server roundtrip extra (~500ms) vs latency near-zero del
 * approach state-local. Aceptable para use cases con joins o computación
 * server-side compleja (Despacho cola, KPIs).
 *
 * Para use cases simples (lista plana de rows sin joins), preferir
 * `useRealtimeTable` que mantiene state local sin server roundtrip.
 */

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RealtimeStatus } from "./use-realtime-table";

interface UseRealtimeRefreshOptions {
  /** Nombre de la tabla en public schema. */
  table: string;
  /** Filter Postgres realtime · formato `column=op.value`. */
  filter?: string;
  /** Debounce ms entre refreshes (evita storms si cambian varias rows seguidas). */
  debounceMs?: number;
  disabled?: boolean;
  /** Se dispara junto al router.refresh() debounceado — para state local que el refresh de server no repuebla (ej. hilo abierto de un detail view). */
  onChange?: () => void;
}

export function useRealtimeRefresh({
  table,
  filter,
  debounceMs = 300,
  disabled = false,
  onChange,
}: UseRealtimeRefreshOptions): { status: RealtimeStatus } {
  const router = useRouter();
  const subscriptionKey = disabled ? null : `${table}-${filter ?? "all"}`;
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyChange = useEffectEvent(() => onChange?.());

  useEffect(() => {
    if (!subscriptionKey) return;

    const supabase = createClient();

    const channel: RealtimeChannel = supabase
      .channel(`refresh-${subscriptionKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          // Debounce: si vienen varios changes seguidos, refresh solo una vez
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            router.refresh();
            notifyChange();
          }, debounceMs);
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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void channel.unsubscribe();
    };
  }, [table, filter, debounceMs, subscriptionKey, router]);

  return { status };
}

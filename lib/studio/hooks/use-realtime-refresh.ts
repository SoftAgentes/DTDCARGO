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

import { useEffect, useRef, useState } from "react";
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
}

export function useRealtimeRefresh({
  table,
  filter,
  debounceMs = 300,
  disabled = false,
}: UseRealtimeRefreshOptions): { status: RealtimeStatus } {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled) return;

    const supabase = createClient();
    setStatus("connecting");

    const channel: RealtimeChannel = supabase
      .channel(`refresh-${table}-${filter ?? "all"}`)
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
          }, debounceMs);
        },
      )
      .subscribe((subStatus) => {
        if (subStatus === "SUBSCRIBED") setStatus("connected");
        else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT")
          setStatus("error");
        else if (subStatus === "CLOSED") setStatus("closed");
      });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void channel.unsubscribe();
    };
  }, [table, filter, debounceMs, disabled, router]);

  return { status };
}

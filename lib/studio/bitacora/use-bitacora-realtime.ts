"use client";

/**
 * Realtime del tablero/Hoy de Bitácora (SDD-0146 · Fase 6).
 *
 * Reusa `useRealtimeTable` sobre `bitacora_tasks` (filtrado por tenant, RLS de
 * por medio) y, cuando llega un cambio, dispara `router.refresh()` (debounced).
 *
 * ¿Por qué refresh y no usar la data del hook directo? El payload de
 * `postgres_changes` de `bitacora_tasks` trae SOLO las columnas de esa tabla —
 * NO las relaciones embebidas (`assignees`, `checklist`) que el tablero
 * necesita. El server component re-fetchea la lista con esas relaciones y el
 * consumidor re-syncea su estado local vía `useEffect([tasks])`. Así el avance
 * de una tarea en desktop se refleja en el teléfono en <2s sin reload.
 *
 * `initial` es un array constante (EMPTY) para que `router.refresh()` NO
 * resetee el channel ni cause un loop: la data del hook solo cambia por eventos
 * realtime, jamás por el re-render del refresh.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeTable, type RealtimeStatus } from "@/lib/studio/hooks/use-realtime-table";

/** Referencia estable — nunca cambia entre renders (evita el reset-loop). */
const EMPTY: { id: string }[] = [];

/** Ventana de coalescencia: junta ráfagas (ej: confirmar N tareas → 1 refresh). */
const DEBOUNCE_MS = 400;

export function useBitacoraTasksRealtime(
  tenantId: string | null,
): RealtimeStatus {
  const router = useRouter();
  const { data, status } = useRealtimeTable<{ id: string }>({
    table: "bitacora_tasks",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    initial: EMPTY,
    disabled: !tenantId,
  });

  const seenFirst = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // El primer valor de `data` es el estado inicial (mount), no un evento.
    if (!seenFirst.current) {
      seenFirst.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, router]);

  return status;
}

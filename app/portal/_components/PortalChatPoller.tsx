"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Near-realtime del chat de Soporte (SDD-0148 #3a). El cliente del portal NO tiene
 * RLS sobre `conversation_messages`, así que Supabase Realtime no le puede empujar
 * las respuestas del equipo (respeta RLS). En vez de abrir la RLS de esas tablas,
 * refrescamos el server component cada `intervalMs` mientras la pestaña está visible
 * → las respuestas nuevas aparecen sin recargar a mano. `router.refresh()` re-corre
 * `getPortalThread` en el server y conserva el estado del textarea (client state).
 *
 * También refresca al volver a la pestaña (visibilitychange) para no esperar el tick.
 * Renderiza null.
 */
export function PortalChatPoller({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(refreshIfVisible, intervalMs);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, intervalMs]);

  return null;
}

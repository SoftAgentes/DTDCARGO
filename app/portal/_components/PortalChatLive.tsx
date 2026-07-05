"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeRefresh } from "@/lib/studio/hooks/use-realtime-refresh";

/**
 * Actualización en vivo del chat de Soporte (SDD-0148 #3). Dos capas:
 *
 *  1. **Realtime "de verdad"** (Supabase): se suscribe a `conversation_messages`
 *     del hilo del cliente → cuando el equipo responde, refresca el server
 *     component al instante. Requiere la policy RLS de lectura del cliente sobre
 *     su hilo (migr 0217) — sin ella, el subscribe no recibe filas.
 *  2. **Fallback lento** (poll cada `fallbackMs` con la pestaña visible): red de
 *     seguridad por si realtime cae o la policy 0217 todavía no está aplicada. Así
 *     el cliente ve las respuestas igual, sin depender de un solo mecanismo.
 *
 * `router.refresh()` re-corre `getPortalThread` en el server (lectura admin,
 * fuente de verdad) y conserva el estado del textarea. Renderiza null.
 */
export function PortalChatLive({
  conversationId,
  fallbackMs = 45000,
}: {
  conversationId: string | null;
  fallbackMs?: number;
}) {
  const router = useRouter();

  useRealtimeRefresh({
    table: "conversation_messages",
    filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
    disabled: !conversationId,
  });

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(refreshIfVisible, fallbackMs);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, fallbackMs]);

  return null;
}

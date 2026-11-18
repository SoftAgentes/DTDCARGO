/**
 * SDD-0650 F2 · La columna de conversaciones de la ficha, en el servidor.
 *
 * Va dentro de un `<Suspense>`: la lectura en vivo de Chatwoot no frena el resto de
 * la ficha (la spec pide cargarlo aparte si pasa de 400 ms; se hace siempre).
 *
 * Si la F2 está apagada (sin la 0554, sin la cuenta de servicio o sin la bandeja del
 * Archivo Kommo) o la ficha todavía no tiene chats unidos, se ve la tarjeta de la F1,
 * como hoy, sin error.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConversacionDeCliente } from "@/lib/studio/chatwoot/conversations-queries";
import { cargarPanelConversaciones, type AccesoFicha } from "@/lib/studio/chatwoot/ficha-panel";

import { ChatwootConversacionesCard } from "./ChatwootConversacionesCard";
import { ConversacionesFichaCard, ConversacionesFichaNoResponde } from "./ConversacionesFichaCard";

export async function PanelConversacionesFicha({
  supabase,
  tenantId,
  clientId,
  markbox,
  acceso,
  puedeVerDatos,
  fichaSinNombre,
  conversacionesF1,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  clientId: string;
  markbox: string;
  acceso: AccesoFicha;
  puedeVerDatos: boolean;
  fichaSinNombre: boolean;
  conversacionesF1: ConversacionDeCliente[];
}) {
  let estado: Awaited<ReturnType<typeof cargarPanelConversaciones>>;
  try {
    estado = await cargarPanelConversaciones({ supabase, tenantId, clientId, acceso, puedeVerDatos, fichaSinNombre });
  } catch {
    // Nunca tumba la ficha: lo de siempre.
    estado = { estado: "apagado" };
  }

  if (estado.estado === "chatwoot_no_responde") return <ConversacionesFichaNoResponde />;
  if (estado.estado !== "listo") return <ChatwootConversacionesCard conversaciones={conversacionesF1} />;
  return (
    <ConversacionesFichaCard
      panel={estado.panel}
      uniones={estado.uniones}
      puedeUnir={estado.puedeUnir}
      puedeVerTexto={puedeVerDatos}
      clientId={clientId}
      markbox={markbox}
    />
  );
}

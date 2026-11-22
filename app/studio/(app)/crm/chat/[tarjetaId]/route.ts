/**
 * GET /studio/crm/chat/[tarjetaId] — abre el chat de una tarjeta a pantalla
 * completa (SDD-0648 §4, D7).
 *
 * Candados: sesión del Studio (proxy) + acceso al módulo del CRM (`kommo`, el
 * mismo de `CrmEmbudosSlot`; sin él, al inicio con `?denied=kommo`) + entrada a
 * la Bandeja (rol + flag; sin ella, aviso `?chat=sin_bandeja`) + RLS de la 0506/0539 al leer la tarjeta y el
 * espejo de conversaciones. El token del enrutador solo se usa para listar los
 * ids de conversación de un contacto que la RLS ya dejó ver; la Bandeja y
 * Chatwoot vuelven a decidir si el agente puede abrir esa conversación.
 *
 * No lee mensajes. En los logs, solo códigos.
 */

import { createClient } from "@/lib/db/server";
import { localRedirect } from "@/lib/http/local-redirect";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import { chatwootRouterConfig } from "@/lib/studio/chatwoot/config";
import { puedeAbrirBandeja } from "@/lib/studio/crm-chat-acceso";
import { listarConversacionesContacto } from "@/lib/studio/chatwoot/router-api";
import { destinoChat, resolverConversacion, type TarjetaParaChat } from "@/lib/studio/crm-chat";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ tarjetaId: string }> }) {
  const { tarjetaId } = await params;
  const supabase = await createClient();
  const access = await getStudioAccess(supabase);
  // Sin sesión o sin el módulo del CRM: lo mismo que `requireModuleView("kommo")`.
  if (!canAccessModule(access.role, "kommo", access.overrides, access.grants) || !access.tenantId) {
    return localRedirect("/studio/dashboard?denied=kommo");
  }
  // Sin Bandeja (rol o flag): se avisa en el tablero en vez de rebotar al inicio.
  if (!(await puedeAbrirBandeja(supabase))) {
    return localRedirect(destinoChat({ ok: false, motivo: "sin_bandeja" }));
  }
  if (!UUID.test(tarjetaId)) return localRedirect(destinoChat({ ok: false, motivo: "sin_chat" }));

  const tarjeta = await supabase
    .from("crm_tarjetas")
    .select("client_id, chatwoot_contact_id")
    .eq("id", tarjetaId)
    .maybeSingle<TarjetaParaChat>();
  if (tarjeta.error) {
    console.warn(`[crm-chat] tarjeta: ${tarjeta.error.code ?? "sin código"}`);
    return localRedirect(destinoChat({ ok: false, motivo: "error" }));
  }
  if (!tarjeta.data) return localRedirect(destinoChat({ ok: false, motivo: "sin_chat" }));

  const cfg = chatwootRouterConfig();
  const r = await resolverConversacion(tarjeta.data, {
    ultimaDeFicha: async (clientId) => {
      const { data, error } = await supabase
        .from("chatwoot_conversations")
        .select("conversation_id")
        .eq("client_id", clientId)
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle<{ conversation_id: number }>();
      if (error) console.warn(`[crm-chat] espejo: ${error.code ?? "sin código"}`);
      return data?.conversation_id ?? null;
    },
    delContacto: async (contactId) => {
      if (!cfg) return null;
      const res = await listarConversacionesContacto(cfg, contactId);
      if (!res.ok) {
        console.warn(`[crm-chat] contacto: ${res.error}`);
        return null;
      }
      return res.data.map((c) => c.id);
    },
  });
  return localRedirect(destinoChat(r));
}

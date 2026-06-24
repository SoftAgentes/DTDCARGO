/**
 * /studio/conversaciones — Bandeja unificada de atención al cliente (SDD-0056 · Fase 1).
 *
 * KPIs + grid 360px|1fr (lista filtrable | hilo). Fetch server (conversaciones +
 * agentes asignables + tenant para el filtro Realtime). El detalle del hilo
 * (mensajes + contexto del cliente) lo carga el cliente vía
 * /api/studio/conversaciones cuando se selecciona (lazy, no N+1 en el server).
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  computeConversationKpis,
  listAssignableAgents,
  listConversations,
} from "@/lib/studio/conversaciones/conversations-queries";
import { ConversacionesClient } from "./_components/ConversacionesClient";

export const metadata = { title: "Conversaciones · DTD Studio" };

export default async function ConversacionesPage() {
  await requireModuleView("conversaciones");

  const supabase = await createClient();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = link?.tenant_id ?? null;

  const [conversations, kpis, agents] = await Promise.all([
    listConversations(supabase),
    computeConversationKpis(supabase),
    listAssignableAgents(supabase),
  ]);

  return (
    <div style={{ maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Comercial · Atención al cliente</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Conversaciones
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          Bandeja unificada de atención: el mensaje del cliente desde el portal entra
          a un hilo por cliente. Responde, cambia el estado, asigna un agente y abre
          casos. Cuando el cliente tiene email, tu respuesta también le llega por
          correo.
        </p>
      </div>

      <ConversacionesClient
        conversations={conversations}
        kpis={kpis}
        agents={agents}
        tenantId={tenantId}
      />
    </div>
  );
}

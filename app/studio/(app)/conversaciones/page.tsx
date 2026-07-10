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
import { canEditModule } from "@/lib/studio/rbac";
import {
  computeConversationKpis,
  listAssignableAgents,
  listConversations,
} from "@/lib/studio/conversaciones/conversations-queries";
import { ConversacionesClient } from "./_components/ConversacionesClient";
import { GenerateDigestsPanel } from "./_components/GenerateDigestsPanel";

export const metadata = { title: "Conversaciones · DTD Studio" };

export default async function ConversacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const role = await requireModuleView("conversaciones");
  const canGenerateDigests = canEditModule(role, "conversaciones");

  // Deep-link al hilo (SDD-0148 #1): el aviso de Telegram trae `?c=<id>` → la
  // bandeja abre directo en esa conversación.
  const { c: initialSelectedId } = await searchParams;

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
          casos. Todo lo dialogado queda registrado acá; el cliente lo ve en su
          portal (sin correos).
        </p>
      </div>

      {canGenerateDigests && <GenerateDigestsPanel />}

      <ConversacionesClient
        conversations={conversations}
        kpis={kpis}
        agents={agents}
        tenantId={tenantId}
        initialSelectedId={initialSelectedId ?? null}
      />
    </div>
  );
}

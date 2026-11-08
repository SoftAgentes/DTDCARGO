/**
 * /studio/conversaciones — Bandeja unificada de atención al cliente (SDD-0056 · Fase 1).
 *
 * KPIs + grid 360px|1fr (lista filtrable | hilo). Fetch server (conversaciones +
 * agentes asignables + tenant para el filtro Realtime). El detalle del hilo
 * (mensajes + contexto del cliente) lo carga el cliente vía
 * /api/studio/conversaciones cuando se selecciona (lazy, no N+1 en el server).
 */

import { createClient } from "@/lib/db/server";
import { moduleViewDenial, requireModuleView } from "@/lib/studio/rbac-guard";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { canEditModule } from "@/lib/studio/rbac";
import {
  computeConversationKpis,
  listAssignableAgents,
  listConversations,
} from "@/lib/studio/conversaciones/conversations-queries";
import { trabaPortal } from "@/lib/studio/chatwoot/portal-solo-lectura";
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

  // SDD-0586 1c-1: con `chatwoot_portal` encendido, los hilos del portal se responden desde la
  // Bandeja de Chatwoot. Se calcula una vez por tenant; las acciones lo vuelven a comprobar.
  // SDD-0586 1c-1b: «Responder en la Bandeja →» solo si se puede entrar a la Bandeja: las dos
  // capas de su layout, el rol (requireModuleView) y el flag `chatwoot_inbox` (requireFeatureEnabled).
  const [conversations, kpis, agents, trabaPortalTenant, denialBandeja, flags] = await Promise.all([
    listConversations(supabase),
    computeConversationKpis(supabase),
    listAssignableAgents(supabase),
    trabaPortal(supabase, tenantId),
    moduleViewDenial(supabase, "bandeja"),
    listFeatureFlags(supabase),
  ]);

  return (
    <div style={{ maxWidth: 1480 }}>
      <div style={{ marginBottom: "var(--s-6)" }}>
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
        trabaPortal={trabaPortalTenant}
        puedeVerBandeja={!denialBandeja && flags.chatwoot_inbox === true}
      />
    </div>
  );
}

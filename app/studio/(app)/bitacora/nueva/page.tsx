/**
 * /studio/bitacora/nueva — ingesta de conversación (SDD-0146 · Fase 2).
 *
 * SOLO gestores: gate de módulo (RBAC SDD-0085) + `support` es read-only →
 * redirect al tablero. Pegar transcripción → analizar con IA → revisar →
 * confirmar (RPC transaccional). Audio/grabadora = Fase 3.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { listAssignableProfiles } from "@/lib/studio/bitacora/bitacora-queries";
import { NuevaReunionClient } from "./_components/NuevaReunionClient";

export const metadata = { title: "Nueva conversación · Bitácora · DTD Studio" };

export const dynamic = "force-dynamic";

export default async function NuevaReunionPage() {
  const role = await requireModuleView("bitacora");
  if (role === "support") redirect("/studio/bitacora");

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  const myUserId = userResp.user?.id ?? null;

  // Tenant del caller: el cliente lo necesita para armar el path del audio
  // ({tenant}/bitacora_meeting/…) ANTES de subir (Fase 3). Server-side vía RPC.
  const { data: tenantRaw } = await supabase.rpc("get_user_tenant_id");
  const tenantId = tenantRaw ? String(tenantRaw) : null;

  const profiles = await listAssignableProfiles(supabase);

  return (
    <NuevaReunionClient
      profiles={profiles}
      myUserId={myUserId}
      tenantId={tenantId}
    />
  );
}

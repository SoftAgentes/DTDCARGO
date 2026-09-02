import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { listMyClaims } from "@/lib/portal/portal-claims";
import {
  getPortalAdvisor,
  getPortalClient,
  listMyShipments,
} from "@/lib/portal/portal-queries";
import {
  getPortalConversationId,
  getPortalThread,
  listPortalConversationDigests,
  type PortalConversationDigest,
  type PortalThreadMessage,
} from "@/lib/portal/portal-conversation-queries";
import {
  listClaimEvidence,
  type ClaimEvidenceItem,
} from "@/lib/studio/reclamos/claim-evidence";

type PortalClaims = Awaited<ReturnType<typeof listMyClaims>>;
type PortalShipments = Awaited<ReturnType<typeof listMyShipments>>;
type PortalClient = NonNullable<Awaited<ReturnType<typeof getPortalClient>>>;
type PortalAdvisor = Awaited<ReturnType<typeof getPortalAdvisor>>;

export type PortalSupportPrivateContext = {
  client: PortalClient;
  claims: PortalClaims;
  shipments: PortalShipments;
  evidence: Record<string, ClaimEvidenceItem[]>;
  thread: PortalThreadMessage[];
  conversationId: string | null;
  advisor: PortalAdvisor;
  digests: PortalConversationDigest[];
};

function sessionOnlyContext(
  client: PortalClient,
  claims: PortalClaims,
  shipments: PortalShipments,
  advisor: PortalAdvisor,
): PortalSupportPrivateContext {
  return {
    client,
    claims,
    shipments,
    advisor,
    evidence: {},
    thread: [],
    conversationId: null,
    digests: [],
  };
}

/**
 * Arma el contexto privado de Soporte sin aceptar ids ni clientes privilegiados.
 * Primero deriva principal y datos RLS; sólo después consulta evidencia y
 * conversaciones internas. Un fallo de elevación conserva los reclamos/envíos
 * visibles por RLS, pero no expone datos privados incompletos.
 */
export async function getPortalSupportPrivateContext(
  db: SupabaseClient,
): Promise<PortalSupportPrivateContext | null> {
  const client = await getPortalClient(db);
  if (!client) return null;

  const [claims, shipments, advisor] = await Promise.all([
    listMyClaims(db).catch(() => [] as PortalClaims),
    listMyShipments(db).catch(() => [] as PortalShipments),
    getPortalAdvisor(db).catch(() => null),
  ]);
  const base = sessionOnlyContext(client, claims, shipments, advisor);

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return base;
  }

  const [evidenceMap, thread, conversationId, digests] = await Promise.all([
    listClaimEvidence(
      db,
      admin,
      claims.map((claim) => claim.id),
    ).catch(() => new Map<string, ClaimEvidenceItem[]>()),
    getPortalThread(admin, client.id).catch(() => [] as PortalThreadMessage[]),
    getPortalConversationId(admin, client.id).catch(() => null),
    listPortalConversationDigests(admin, client.id).catch(
      () => [] as PortalConversationDigest[],
    ),
  ]);

  const evidence: Record<string, ClaimEvidenceItem[]> = {};
  for (const [claimId, items] of evidenceMap) evidence[claimId] = items;

  return { ...base, evidence, thread, conversationId, digests };
}

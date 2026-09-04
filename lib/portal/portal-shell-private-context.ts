import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalLastReplyAt } from "@/lib/portal/portal-conversation-queries";
import {
  daysUntil,
  getNextOpenSailing,
  type PortalSailing,
} from "@/lib/portal/next-sailing-queries";
import { getPortalClient } from "@/lib/portal/portal-queries";

type PortalClient = NonNullable<Awaited<ReturnType<typeof getPortalClient>>>;

export type PortalShellPrivateContext = {
  client: PortalClient;
  soporteLastReplyAt: string | null;
  sailing: PortalSailing | null;
  sailingDaysToCutoff: number | null;
};

function emptyContext(client: PortalClient): PortalShellPrivateContext {
  return {
    client,
    soporteLastReplyAt: null,
    sailing: null,
    sailingDaysToCutoff: null,
  };
}

async function tenantForClient(
  admin: SupabaseClient,
  clientId: string,
): Promise<string> {
  try {
    const { data } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", clientId)
      .maybeSingle<{ tenant_id: string }>();
    return String(data?.tenant_id ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Resuelve el principal con la sesión antes de elevar. El RSC no entrega ids ni
 * tenant; recibe sólo los derivados mínimos que necesita el shell.
 */
export async function getPortalShellPrivateContext(
  db: SupabaseClient,
  now: Date = new Date(),
): Promise<PortalShellPrivateContext | null> {
  const client = await getPortalClient(db);
  if (!client) return null;

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return emptyContext(client);
  }

  const [soporteLastReplyAt, tenantId] = await Promise.all([
    getPortalLastReplyAt(admin, client.id).catch(() => null),
    tenantForClient(admin, client.id),
  ]);
  if (!tenantId) return { ...emptyContext(client), soporteLastReplyAt };

  const todayIso = now.toISOString().slice(0, 10);
  const sailing = await getNextOpenSailing(admin, tenantId, todayIso).catch(() => null);
  return {
    client,
    soporteLastReplyAt,
    sailing,
    sailingDaysToCutoff: sailing ? daysUntil(sailing.cutoff, todayIso) : null,
  };
}

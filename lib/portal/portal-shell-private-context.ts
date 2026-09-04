import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalLastReplyAt } from "@/lib/portal/portal-conversation-queries";
import {
  daysUntil,
  getNextOpenSailing,
  type PortalSailing,
} from "@/lib/portal/next-sailing-queries";
import {
  getPortalClientPrincipal,
  type PortalClientPrincipal,
} from "@/lib/portal/portal-queries";

type PortalClient = PortalClientPrincipal["client"];

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

/**
 * Resuelve el principal con la sesión antes de elevar. El RSC no entrega ids ni
 * tenant; recibe sólo los derivados mínimos que necesita el shell.
 */
export async function getPortalShellPrivateContext(
  db: SupabaseClient,
  now: Date = new Date(),
): Promise<PortalShellPrivateContext | null> {
  const principal = await getPortalClientPrincipal(db);
  if (!principal) return null;
  const { client, tenantId } = principal;

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return emptyContext(client);
  }

  const soporteLastReplyAt = await getPortalLastReplyAt(admin, client.id).catch(
    () => null,
  );

  const todayIso = now.toISOString().slice(0, 10);
  const sailing = await getNextOpenSailing(admin, tenantId, todayIso).catch(() => null);
  return {
    client,
    soporteLastReplyAt,
    sailing,
    sailingDaysToCutoff: sailing ? daysUntil(sailing.cutoff, todayIso) : null,
  };
}

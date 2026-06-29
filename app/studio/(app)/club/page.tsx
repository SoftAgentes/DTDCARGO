/**
 * Club DTD (SDD-0116) — el "motor de dinero recurrente" de la Academia. Server
 * component: gate de rol (requireModuleView) + carga de datos (queries puras) →
 * ClubClient (pestañas Miembros + Compras grupales).
 *
 * Slice A = membresía (anclada a persons por cédula). Slice B = compra grupal
 * (rondas de consolidación comunitaria; solo miembros, 100% intención).
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { listClubMembers, clubStats } from "@/lib/studio/club/club-member-queries";
import {
  listGroupBuysWithDetail,
  groupBuyStats,
  listEligibleMembers,
} from "@/lib/studio/club/group-buy-queries";
import { ClubClient } from "./_components/ClubClient";

export const metadata = { title: "Club DTD" };

export default async function ClubPage() {
  await requireModuleView("club");
  const supabase = await createClient();

  const [stats, members, gbStats, groupBuys, eligibleMembers] = await Promise.all([
    clubStats(supabase),
    listClubMembers(supabase),
    groupBuyStats(supabase),
    listGroupBuysWithDetail(supabase),
    listEligibleMembers(supabase),
  ]);

  return (
    <div style={{ padding: "var(--s-6)" }}>
      <ClubClient
        stats={stats}
        members={members}
        gbStats={gbStats}
        groupBuys={groupBuys}
        eligibleMembers={eligibleMembers}
      />
    </div>
  );
}

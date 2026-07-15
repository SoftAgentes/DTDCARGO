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
  listEligibleMembers,
} from "@/lib/studio/club/group-buy-queries";
import { groupBuyStatsFrom } from "@/lib/studio/club/group-buy-types";
import { listClubEvents } from "@/lib/studio/club/club-event-queries";
import { clubEventStatsFrom } from "@/lib/studio/club/club-event-types";
import { listEventRegistrationsByEvent } from "@/lib/studio/club/club-event-registration-queries";
import {
  listFeaturedSuppliers,
  listEligibleInspections,
} from "@/lib/studio/club/featured-supplier-queries";
import { featuredSupplierStatsFrom } from "@/lib/studio/club/featured-supplier-types";
import type { EventRegistration } from "@/lib/studio/club/club-event-registration-types";
import { ClubClient } from "./_components/ClubClient";

export const metadata = { title: "Club DTD" };

export default async function ClubPage() {
  await requireModuleView("club");
  const supabase = await createClient();

  const [stats, members, groupBuys, eligibleMembers, events, suppliers, eligibleInspections] =
    await Promise.all([
      clubStats(supabase),
      listClubMembers(supabase),
      listGroupBuysWithDetail(supabase),
      listEligibleMembers(supabase),
      listClubEvents(supabase),
      listFeaturedSuppliers(supabase),
      listEligibleInspections(supabase),
    ]);

  // Inscripciones de los eventos vivos (C.2), agrupadas por evento.
  const regMap = await listEventRegistrationsByEvent(
    supabase,
    events.map((e) => e.id),
  );
  const registrationsByEvent: Record<string, EventRegistration[]> = {};
  for (const [eventId, regs] of regMap) registrationsByEvent[eventId] = regs;

  // KPIs derivados de los detalles ya traídos (evita re-consultar la lista pesada).
  const gbStats = groupBuyStatsFrom(groupBuys);
  const eventStats = clubEventStatsFrom(events);
  const supplierStats = featuredSupplierStatsFrom(suppliers);

  return (
    <div style={{ padding: "var(--s-6)" }}>
      <ClubClient
        stats={stats}
        members={members}
        gbStats={gbStats}
        groupBuys={groupBuys}
        eligibleMembers={eligibleMembers}
        eventStats={eventStats}
        events={events}
        registrationsByEvent={registrationsByEvent}
        supplierStats={supplierStats}
        suppliers={suppliers}
        eligibleInspections={eligibleInspections}
      />
    </div>
  );
}

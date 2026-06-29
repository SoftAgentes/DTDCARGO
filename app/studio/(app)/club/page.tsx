/**
 * Club DTD (SDD-0116, Slice A · membresía) — el "motor de dinero recurrente" de
 * la Academia. Server component: gate de rol (requireModuleView) + carga de datos
 * (queries puras) → ClubClient (lista de miembros + KPIs + drawer de alta/edición).
 *
 * Slice A modela SOLO la membresía (anclada a persons por cédula, SDD-0106/0107).
 * Compra grupal, eventos, proveedor del mes y portal del miembro = Slices B–E.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { listClubMembers, clubStats } from "@/lib/studio/club/club-member-queries";
import { ClubClient } from "./_components/ClubClient";

export const metadata = { title: "Club DTD" };

export default async function ClubPage() {
  await requireModuleView("club");
  const supabase = await createClient();

  const [stats, members] = await Promise.all([
    clubStats(supabase),
    listClubMembers(supabase),
  ]);

  return (
    <div style={{ padding: "var(--s-6)" }}>
      <ClubClient stats={stats} members={members} />
    </div>
  );
}

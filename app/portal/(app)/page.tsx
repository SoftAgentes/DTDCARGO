import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import {
  getPortalClient,
  getPortalActivation,
  getDashboardKpis,
  getNextArrival,
  listMyShipments,
} from "@/lib/portal/portal-queries";
import { PortalPending } from "../_components/PortalPending";
import { PortalDashboard } from "./_components/PortalDashboard";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio del portal (SDD-0042 · Fase 5 · Norte PortalHome).
 *
 * Gate de activación (5.1): si la cuenta NO está activada (ni aprobada por asesor
 * ni con ≥1 envío) → pantalla de espera `<PortalPending>`. Si está activada →
 * dashboard `<PortalDashboard>` (5.2). El layout `(app)` ya garantizó la sesión
 * del portal (redirect al login si null); acá `client` es defensa extra.
 */
export default async function PortalHomePage() {
  const supabase = await createClient();

  const client = await getPortalClient(supabase);
  if (!client) return null;

  const activation = await getPortalActivation(supabase);
  if (!activation.activated) {
    return <PortalPending name={client.name} markbox={client.markbox} />;
  }

  const [kpis, nextArrival, shipments] = await Promise.all([
    getDashboardKpis(supabase),
    getNextArrival(supabase),
    listMyShipments(supabase),
  ]);

  return (
    <PortalDashboard
      client={client}
      kpis={kpis}
      nextArrival={nextArrival}
      shipments={shipments}
    />
  );
}

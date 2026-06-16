/**
 * Configuración de servicios (SDD-0076 Fase 2).
 *
 * Server component: lista los 20 servicios canónicos (estructura de código +
 * contenido de DB) y delega la edición/publicación al ServiciosClient.
 *
 * La estructura (claves, grupo, tipo, timeline) sale de lib/shared/service-catalog.ts;
 * el contenido editable, de service_configs (migración 0130). Tras aplicar la
 * migración, el founder edita y publica acá sin deploy.
 */

import { createClient } from "@/lib/db/server";
import {
  listServiceConfigs,
  listServiceFaqs,
  listServiceAddons,
  listAllPriceHistory,
  getOfferMatrixConfigs,
} from "@/lib/studio/service-catalog/queries";
import { ServiciosClient } from "./_components/ServiciosClient";

export const metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const supabase = await createClient();
  const [items, faqs, addons, priceEntries, offerConfigs] = await Promise.all([
    listServiceConfigs(supabase),
    listServiceFaqs(supabase),
    listServiceAddons(supabase),
    listAllPriceHistory(supabase),
    getOfferMatrixConfigs(supabase), // query AISLADA: si 0142 no está, devuelve []
  ]);
  return (
    <ServiciosClient
      items={items}
      faqs={faqs}
      addons={addons}
      priceEntries={priceEntries}
      offerConfigs={offerConfigs}
    />
  );
}

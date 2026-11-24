import { getStudioAccess, requireModuleView } from "@/lib/studio/rbac-guard";
import { createClient } from "@/lib/db/server";
import { getShipmentById } from "@/lib/studio/shipment-queries";
import { canSpecial } from "@/lib/studio/rbac";
import { readCanSeeClientNames } from "@/lib/studio/privacidad-cn";
import { ClienteDelEmbarque, esSinCliente } from "@/app/studio/(app)/tracking/[id]/_components/ClienteDelEmbarque";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import Link from "next/link";
import { ClientDetailContent } from "@/app/studio/(app)/clientes/_components/ClientDetailContent";
import { ClientDetailPanel } from "@/app/studio/(app)/clientes/_components/ClientDetailPanel";
import { Suspense } from "react";

export default async function FichaInterceptada({ params, searchParams }: {
  params: Promise<{ markbox: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("shipments");
  const query = await searchParams;
  if (query?.embarque !== undefined) {
    // Mismo acceso de Tracking: la fila no depende de una ficha ni de sus 200 envíos.
    await requireModuleView("tracking");
    const id = typeof query.embarque === "string" ? query.embarque : "";
    const supabase = await createClient();
    const acceso = await getStudioAccess(supabase);
    const shipment = id && acceso.tenantId ? await getShipmentById(supabase, id) : null;
    // La RLS no excluye soft-deleted: el detalle también comprueba deleted_at.
    if (!shipment || shipment.id !== id || shipment.tenant_id !== acceso.tenantId || shipment.deleted_at) {
      return <ClientDetailPanel listadoHref="/studio/embarques" title="Cliente del embarque">
        <Aviso tono="info" titulo="Embarque no disponible">Vuelve al listado y elige un embarque disponible para tu sesión.</Aviso>
      </ClientDetailPanel>;
    }
    const puedeVerNombres = await readCanSeeClientNames(supabase);
    return <ClientDetailPanel listadoHref="/studio/embarques" title="Cliente del embarque">
      <h1 className="studio-display">{shipment.code}</h1>
      {esSinCliente(shipment.client_markbox) ? <ClienteDelEmbarque
        shipmentId={shipment.id} shipmentCode={shipment.code} markbox={shipment.client_markbox}
        puedeVerNombres={puedeVerNombres} puedeReasignar={canSpecial(acceso.role, "reassign_shipment_owner")}
      /> : <Aviso tono="info">Este embarque ya tiene cliente asignado. Consulta su estado actual en Tracking.</Aviso>}
      <Link href={`/studio/tracking/${encodeURIComponent(shipment.id)}`} target="_blank" rel="noopener"
        className="studio-btn studio-btn-ghost" style={{ minHeight: 44 }}>Abrir este embarque en Tracking (otra pestaña)</Link>
    </ClientDetailPanel>;
  }
  await requireModuleView("clients");
  const { markbox } = await params;
  const ficha = ClientDetailContent({ markbox, enPanel: true });
  return <ClientDetailPanel listadoHref="/studio/embarques"><Suspense fallback={<p role="status">Cargando ficha…</p>}>{ficha}</Suspense></ClientDetailPanel>;
}

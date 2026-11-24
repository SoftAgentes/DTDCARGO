import { requireModuleView } from "@/lib/studio/rbac-guard";
import { ClientDetailContent } from "@/app/studio/(app)/clientes/_components/ClientDetailContent";
import { ClientDetailPanel } from "@/app/studio/(app)/clientes/_components/ClientDetailPanel";
import { Suspense } from "react";

export default async function FichaInterceptada({ params, searchParams }: {
  params: Promise<{ markbox: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("shipments");
  await requireModuleView("clients");
  const { markbox } = await params;
  const query = await searchParams;
  // Un identificador inválido no se transforma en «todos los embarques».
  const seleccion = query?.embarque === undefined ? {} : {
    shipmentId: typeof query.embarque === "string" ? query.embarque : "",
  };
  const ficha = ClientDetailContent({ markbox, enPanel: true, ...seleccion });
  return <ClientDetailPanel listadoHref="/studio/embarques"><Suspense fallback={<p role="status">Cargando ficha…</p>}>{ficha}</Suspense></ClientDetailPanel>;
}

import { requireModuleView } from "@/lib/studio/rbac-guard";
import { ClientDetailContent } from "@/app/studio/(app)/clientes/_components/ClientDetailContent";
import { ClientDetailPanel } from "@/app/studio/(app)/clientes/_components/ClientDetailPanel";
import { Suspense } from "react";

export default async function FichaInterceptada({ params }: { params: Promise<{ markbox: string }> }) {
  await requireModuleView("clients");
  const { markbox } = await params;
  const ficha = ClientDetailContent({ markbox, enPanel: true });
  return <ClientDetailPanel><Suspense fallback={<p role="status">Cargando ficha…</p>}>{ficha}</Suspense></ClientDetailPanel>;
}

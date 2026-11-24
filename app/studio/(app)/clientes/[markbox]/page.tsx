import { ClientDetailContent } from "../_components/ClientDetailContent";

export const metadata = { title: "Detalle cliente" };

/** SDD-0715: el acceso directo conserva la composición server de la ficha. */
export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ markbox: string }>;
}) {
  const { markbox } = await params;
  return ClientDetailContent({ markbox });
}

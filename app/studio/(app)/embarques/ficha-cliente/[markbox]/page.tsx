import { redirect } from "next/navigation";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { PESTANAS_FICHA, pestanaDeLaFicha } from "@/lib/studio/ficha-cliente";

/** Una carga directa conserva la ficha completa, con el gate del destino. */
export default async function FichaDirecta({ params, searchParams }: {
  params: Promise<{ markbox: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  if (raw?.embarque !== undefined) {
    await requireModuleView("tracking");
    if (typeof raw.embarque === "string" && raw.embarque) {
      return redirect(`/studio/tracking/${encodeURIComponent(raw.embarque)}`);
    }
    return redirect("/studio/embarques");
  }
  await requireModuleView("clients");
  const { markbox } = await params;
  const pestana = pestanaDeLaFicha(raw?.pestana ?? null, PESTANAS_FICHA);
  redirect(`/studio/clientes/${encodeURIComponent(markbox)}${pestana === "resumen" ? "" : `?pestana=${pestana}`}`);
}

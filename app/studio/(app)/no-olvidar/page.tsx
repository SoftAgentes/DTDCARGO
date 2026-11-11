import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export const metadata = { title: "No-Olvidar" };

export default async function NoOlvidarPage() {
  // SDD-0624: el gate va también en la página, no sólo en el layout: un
  // layout compartido no se vuelve a ejecutar en la navegación parcial.
  await requireModuleView("no-olvidar");

  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0025"
      title="No-Olvidar"
      description="Caja fuerte con master password — cifrado y mecanismo de recovery."
    />
  );
}

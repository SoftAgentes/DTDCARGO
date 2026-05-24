import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Almacén VE" };

export default function AlmacenVePage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0017"
      title="Almacén VE"
      description="Recepción de contenedor en Venezuela con scope (acceso por almacén)."
    />
  );
}

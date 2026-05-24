import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Costing & Margen" };

export default function CostingPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0022"
      title="Costing & Margen"
      description="Editor + templates por ruta + USD/VES + forecast + comparativas."
    />
  );
}

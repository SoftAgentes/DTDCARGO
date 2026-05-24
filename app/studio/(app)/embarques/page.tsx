import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Embarques" };

export default function EmbarquesPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0012"
      title="Embarques"
      description="Vista comercial agrupada por cliente, con tabs Tabla y Kanban, y drawer de detalle."
    />
  );
}

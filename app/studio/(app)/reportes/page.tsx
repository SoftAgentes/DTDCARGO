import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Reportes" };

export default function ReportesPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0023"
      title="Reportes"
      description="7 tabs: Overview, Clientes, Agentes, Rutas, Navieras, Servicios y Operación."
    />
  );
}

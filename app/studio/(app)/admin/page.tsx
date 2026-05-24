import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Administración" };

export default function AdminPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0030"
      title="Administración"
      description="Casos de uso ON/OFF y 11 secciones de configuración del Studio."
    />
  );
}

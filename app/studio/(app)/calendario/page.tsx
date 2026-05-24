import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Calendario" };

export default function CalendarioPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0015"
      title="Calendario"
      description="Mes, semana y agenda con feriados CN + VE y eventos operativos."
    />
  );
}

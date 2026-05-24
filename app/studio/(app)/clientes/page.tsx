import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Clientes" };

export default function ClientesPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0010"
      title="Clientes"
      description="Tabla clients con MARKBOX como ID, tiers comerciales y RIF venezolano."
    />
  );
}

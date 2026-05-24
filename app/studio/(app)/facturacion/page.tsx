import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Facturación" };

export default function FacturacionPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0021"
      title="Facturación"
      description="Generación de facturas con links a embarques y clientes."
    />
  );
}

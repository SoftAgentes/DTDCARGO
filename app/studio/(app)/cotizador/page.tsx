import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Cotizador" };

export default function CotizadorPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0011"
      title="Cotizador"
      description="Cotizaciones guardables como entidad, conectadas a Tarifas y Clientes."
    />
  );
}

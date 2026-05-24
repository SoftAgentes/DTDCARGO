import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Tarifas" };

export default function TarifasPage() {
  return (
    <EmptyState
      eyebrow="Próximo SDD ⭐ · SDD-0008"
      title="Tarifas"
      description="Tabla rates: servicio, origen, destino, perCBM o flatRate, mínimo, días de tránsito, vigencia. Bloquea Cambio de destino, Cotizador y Facturación."
    />
  );
}

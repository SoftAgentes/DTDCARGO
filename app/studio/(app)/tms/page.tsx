import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "TMS · Transporte" };

export default function TmsPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0019"
      title="TMS · Transporte"
      description="Flota, choferes, rutas, GPS e incidencias del transporte terrestre."
    />
  );
}

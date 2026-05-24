import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Documentos" };

export default function DocumentosPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0021"
      title="Documentos"
      description="BL, AWB, packing list, certificados — repositorio por envío."
    />
  );
}

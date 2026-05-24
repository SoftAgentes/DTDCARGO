import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Almacén CN" };

export default function AlmacenCnPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0016"
      title="Almacén CN"
      description="Recepción de mercadería en China, scope por almacén, traductor CN/ES y manejo de envíos parciales."
    />
  );
}

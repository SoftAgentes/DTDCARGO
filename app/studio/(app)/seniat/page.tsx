import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Aduana SENIAT" };

export default function SeniatPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0018"
      title="Aduana SENIAT"
      description="Workflow aduanal VE: impuestos, agentes, HS codes y sincronización AES."
    />
  );
}

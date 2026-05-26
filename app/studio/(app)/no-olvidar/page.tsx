import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "No-Olvidar" };

export default function NoOlvidarPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0025"
      title="No-Olvidar"
      description="Caja fuerte con master password — cifrado y mecanismo de recovery."
    />
  );
}

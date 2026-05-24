import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Vault" };

export default function VaultPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0025"
      title="Vault"
      description="Caja fuerte con master password — cifrado y mecanismo de recovery."
    />
  );
}

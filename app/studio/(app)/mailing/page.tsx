import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Mailing" };

export default function MailingPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0026 y siguientes"
      title="Mailing"
      description="Sistema de correo completo: compose, config, logs, reglas, firmas y templates."
    />
  );
}

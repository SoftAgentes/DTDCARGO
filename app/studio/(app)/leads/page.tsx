import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "CRM · Leads" };

export default function LeadsPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD futuro"
      title="CRM · Leads"
      description="Pipeline comercial con kanban, tabla, timeline y drawer de detalle."
    />
  );
}

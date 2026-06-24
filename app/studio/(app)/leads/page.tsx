import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export const metadata = { title: "CRM · Leads" };

export default async function LeadsPage() {
  await requireModuleView("leads");
  return (
    <EmptyState
      eyebrow="Próximamente · SDD futuro"
      title="CRM · Leads"
      description="Pipeline comercial con kanban, tabla, timeline y drawer de detalle."
    />
  );
}

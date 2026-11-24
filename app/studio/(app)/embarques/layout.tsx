import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function EmbarquesLayout({ children, ficha }: { children: React.ReactNode; ficha: React.ReactNode }) {
  await requireModuleView("shipments");
  return <>{children}{ficha}</>;
}

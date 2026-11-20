/**
 * Gate de la revisión de la oficina (SDD-0626 Paso 3b, D4): SOLO el superadministrador (`is_platform_admin`).
 * Un admin del tenant que no es superadmin no la ve. La base lo vuelve a exigir en cada función (0549).
 */
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { isPlatformAdmin } from "@/lib/studio/platform-admin";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function OficinaGateLayout({ children }: { children: React.ReactNode }) {
  await requireModuleView("admin");
  if (!(await isPlatformAdmin(await createClient()))) notFound();
  return <>{children}</>;
}

/**
 * Gate de la pantalla «IA» (SDD-0704 F1-A): SOLO el superadministrador (`is_platform_admin`), como la revisión de la
 * Oficina. La base lo vuelve a exigir en cada lectura (RLS de la 0570) y en cada escritura. El módulo `ia` concedible
 * por persona (0639 D-6) llega en su propia PR.
 */
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { isPlatformAdmin } from "@/lib/studio/platform-admin";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function IaGateLayout({ children }: { children: React.ReactNode }) {
  await requireModuleView("admin");
  if (!(await isPlatformAdmin(await createClient()))) notFound();
  return <>{children}</>;
}

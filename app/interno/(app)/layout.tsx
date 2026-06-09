/**
 * Layout autenticado de la zona interna (`/interno/(app)/*`).
 *
 * Guard: reusa la sesión del Studio (mismo cookie de Supabase). Cualquier usuario
 * del ERP (con row en `user_tenants`) entra; el resto va al login del Studio con
 * `?next=` para volver acá tras autenticarse. Patrón idéntico al de
 * `app/studio/(app)/layout.tsx`.
 */

import { redirect } from "next/navigation";
import { getUser, getUserTenantId } from "@/lib/auth/session";
import { InternoHeader } from "../_components/InternoHeader";

const NEXT = "/studio/login?next=/interno";

export default async function InternoAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect(NEXT);

  // Cualquier usuario del ERP (tiene tenant) tiene acceso al hub interno.
  const tenantId = await getUserTenantId();
  if (!tenantId) redirect(NEXT);

  return (
    <div className="min-h-screen bg-paper flex flex-col text-ink">
      <InternoHeader email={user.email ?? undefined} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-grey-200 py-6">
        <div className="wrap text-[12px] text-grey-500 flex flex-wrap items-center justify-between gap-2">
          <span>Recursos internos de DTD Cargo · solo equipo.</span>
          <span>© {new Date().getFullYear()} DTD Cargo</span>
        </div>
      </footer>
    </div>
  );
}
